import { BalanceResponse, Dex, SwapResponse } from "./dex";
import { Db } from "./db";
import { log, loggedError } from "./log";
import { Price, Trade } from "./types";

const usdt = "GUSDT";
const gala = "GALA";
const otherTokens = ["GWBTC", "GWETH", "GSOL", "GWTRX", "GOSMI"];

const tradeGalaAmount = 1_000;

const targetPercentageGala = 75;
const targetPercentageOther = (100 - targetPercentageGala) / otherTokens.length;
const tolerance = () => 0.05; // 5%

interface BalanceInfo {
  token: string;
  amount: number;
  decimal: number;
  price: {
    [gala]: number;
    [usdt]: number;
  };
  value: {
    [gala]: number;
    [usdt]: number;
  };
  percentageGala: number;
}

interface Stats {
  token: string;
  count: number;
  avg: number;
  lastPrice: number;
  std: number;
  stdPercentage: number;
  lastPercentage: number;
  lastPercentageSign: string;
}

export class TradingService {
  constructor(
    private readonly db: Db,
    private readonly dex: Dex,
  ) {}

  async updatePrices(): Promise<Price[]> {
    log("Prices:");
    const galaUsdt = await this.dex.fetchSwapPrice(
      gala,
      tradeGalaAmount,
      usdt,
      undefined,
    );
    log(`\n${pp(gala, usdt, galaUsdt.price)}\n`);

    const otherPrices = await Promise.all(
      otherTokens.map(async t => {
        const p = await this.dex.fetchSwapPrice(
          t,
          undefined,
          gala,
          tradeGalaAmount,
        );
        const priceUsdt = p.price * galaUsdt.price;
        log(`${pp(t, gala, p.price)} = ${pnum(priceUsdt)} ${usdt}`);
        return p;
      }),
    );
    log("");

    const prices: Price[] = [galaUsdt, ...otherPrices];
    await this.db.savePrices(prices);

    return prices;
  }

  async calculateStats(): Promise<Stats[]> {
    log("Stats:\n");
    const stats: Stats[] = await Promise.all(
      otherTokens.map(async t => {
        const ps24h = await this.db.fetchPrices24h(t);
        const count = ps24h.length;
        const avg = ps24h.reduce((acc, p) => acc + p.price, 0) / count;
        const std = Math.sqrt(
          ps24h.reduce((acc, p) => acc + Math.pow(p.price - avg, 2), 0) / count,
        );
        const stdPercentage = (std / avg) * 100;

        const lastPrice = ps24h[ps24h.length - 1];
        if (lastPrice === undefined) {
          throw loggedError(`Last price is undefined for ${t}`);
        }

        const lastPercentage = ((lastPrice.price - avg) / avg) * 100;
        const lastPercentageSign = lastPercentage > 0 ? "more exp" : "cheaper";

        return {
          token: t,
          count,
          avg,
          lastPrice: lastPrice.price,
          std,
          stdPercentage,
          lastPercentage,
          lastPercentageSign,
        };
      }),
    );

    const labels = [
      " token",
      "cnt",
      " avg (GALA)",
      "last (GALA)",
      "  std%",
      "  last%",
      "    sign",
    ];
    const labelsStr = labels.join(" | ");
    log(labelsStr);
    log(labelsStr.replace(/./g, "="));
    stats.forEach(st => {
      const arr: string[] = [
        st.token,
        st.count.toString(),
        st.avg.toFixed(2),
        st.lastPrice.toFixed(2),
        pperc(st.stdPercentage),
        pperc(st.lastPercentage),
        st.lastPercentageSign,
      ];
      log(
        arr.map((a, i) => a.padStart(labels[i]?.length ?? 16, " ")).join(" | "),
      );
    });
    log("");

    return stats;
  }

  async fetchBalances(prices: Price[]): Promise<BalanceInfo[]> {
    log("Balances:\n");
    const balances = await this.dex.fetchBalances();

    const galaUsdtPrice = prices.find(
      p => p.tokenIn === gala && p.tokenOut === usdt,
    )?.price;
    if (galaUsdtPrice === undefined) {
      throw loggedError("GALA/USDT price not found in provided prices");
    }

    const balanceInfos: BalanceInfo[] = buildBalanceInfos(
      balances,
      prices,
      galaUsdtPrice,
    );

    const labels = [
      " token",
      "           amount",
      " value (GALA)",
      "value (USDT)",
      "  share",
      " target",
    ];
    const labelsStr = labels.join(" | ");
    log(labelsStr);
    log(labelsStr.replace(/./g, "="));

    let totalValueGala = 0;
    let totalValueUsdt = 0;

    balanceInfos.forEach(b => {
      totalValueGala += b.value[gala];
      totalValueUsdt += b.value[usdt];
      const target =
        b.token === gala ? targetPercentageGala : targetPercentageOther;
      const arr: string[] = [
        b.token,
        b.amount.toFixed(8).toString(),
        b.value[gala].toFixed(2).toString(),
        b.value[usdt].toFixed(2).toString(),
        pperc(b.percentageGala),
        pperc(target),
      ];
      log(
        arr.map((a, i) => a.padStart(labels[i]?.length ?? 16, " ")).join(" | "),
      );
    });

    log(labelsStr.replace(/[^|]/g, "-"));

    const totalArr: string[] = [
      "",
      "Total:",
      totalValueGala.toFixed(2).toString(),
      totalValueUsdt.toFixed(2).toString(),
      pperc(100),
    ];
    log(
      totalArr
        .map((a, i) => a.padStart(labels[i]?.length ?? 16, " "))
        .join(" | "),
    );

    log("");

    return balanceInfos;
  }

  async rebalance(
    balances: BalanceInfo[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    stats: Stats[],
  ): Promise<SwapResponse[]> {
    log("Rebalancing:\n");

    const galaBalance = balances.find(b => b.token === gala);
    if (galaBalance === undefined) {
      throw loggedError("GALA balance not found in provided balances");
    }

    let minOther = undefined;
    let maxOther = undefined;

    for (const balance of balances) {
      if (balance.token !== gala) {
        if (
          minOther === undefined ||
          balance.percentageGala < minOther.percentageGala
        ) {
          minOther = balance;
        }
        if (
          maxOther === undefined ||
          balance.percentageGala > maxOther.percentageGala
        ) {
          maxOther = balance;
        }
      }
    }

    if (maxOther === undefined || minOther === undefined) {
      throw loggedError("No other balance found in provided balances");
    }

    const totalValueGala = balances.reduce((acc, b) => acc + b.value[gala], 0);
    const minThereshold = targetPercentageOther * (1 - tolerance());
    const maxThereshold = targetPercentageOther * (1 + tolerance());
    const minStr = `${minOther.token}: ${pperc(minOther.percentageGala)}`;
    const maxStr = `${maxOther.token}: ${pperc(maxOther.percentageGala)}`;
    const trades: SwapResponse[] = [];

    if (minOther.percentageGala < minThereshold) {
      const percToSpend = targetPercentageOther - minOther.percentageGala;
      const toSpend = Math.round((percToSpend / 100) * totalValueGala);
      log(`${minStr} is below the threshold: ${pperc(minThereshold)}`);
      log(` => BUYING ${minOther.token} for ${toSpend} ${gala}`);
      const t = await this.dex.swap(gala, toSpend, minOther.token, undefined);
      trades.push(t);
      log("    done!");
    } else {
      log(`${minStr} is above the threshold: ${pperc(minThereshold)}`);
      log(" => doing nothing");
    }

    log("");

    if (maxOther.percentageGala > maxThereshold) {
      const percToSell = maxOther.percentageGala - targetPercentageOther;
      const toSell = Math.round((percToSell / 100) * totalValueGala);
      log(`${maxStr} is above the threshold: ${pperc(maxThereshold)}`);
      log(` => SELLING ${maxOther.token} for ${toSell} ${gala}`);
      const t = await this.dex.swap(maxOther.token, undefined, gala, toSell);
      trades.push(t);
      log("    done!");
    } else {
      log(`${maxStr} is below the threshold: ${pperc(maxThereshold)}`);
      log(" => doing nothing");
    }

    log("");

    return trades;
  }

  async saveTrades(
    oldBalances: BalanceInfo[],
    newBalances: BalanceInfo[],
    trades: SwapResponse[],
  ): Promise<void> {
    const tradeInfos: Trade[] = trades.map(t => {
      const balanceInOld = oldBalances.find(b => b.token === t.tokenIn);
      const balanceOutOld = oldBalances.find(b => b.token === t.tokenOut);
      const balanceInNew = newBalances.find(b => b.token === t.tokenIn);
      const balanceOutNew = newBalances.find(b => b.token === t.tokenOut);

      if (
        balanceInOld === undefined ||
        balanceOutOld === undefined ||
        balanceInNew === undefined ||
        balanceOutNew === undefined
      ) {
        throw loggedError("Balance not found in provided balances");
      }

      const amountIn = balanceInOld.amount - balanceInNew.amount;
      const amountOut = balanceOutNew.amount - balanceOutOld.amount;

      return {
        date: t.date,
        uniqueId: t.uniqueId,
        tokenIn: t.tokenIn,
        amountIn,
        tokenOut: t.tokenOut,
        amountOut,
        wasSuccessful: amountIn > 0 && amountOut > 0,
      };
    });

    log("Trades made:\n");
    tradeInfos.forEach(t => {
      const price =
        t.tokenOut === gala
          ? t.amountOut / t.amountIn
          : t.amountIn / t.amountOut;
      log(
        `  ${t.wasSuccessful ? "✅" : "❌"} ` +
          `${pnum(t.amountIn)} ${t.tokenIn} -> ${pnum(t.amountOut)} ${t.tokenOut} ` +
          `(price: ${price.toFixed(2).padStart(11, " ")} GALA)`,
      );
    });
    log("");
  }
}

function buildBalanceInfos(
  balances: BalanceResponse[],
  prices: Price[],
  galaUsdtPrice: number,
): BalanceInfo[] {
  const balanceInfos: BalanceInfo[] = [gala, ...otherTokens]
    .map(token => {
      const balance = balances.find(b => b.token === token);
      const price = prices.find(p => p.tokenIn === token);

      if (price === undefined) {
        return undefined;
      }

      return makeBalanceInfo(balance, price, galaUsdtPrice);
    })
    .filter(b => b !== undefined);

  const totalValueGala = balanceInfos.reduce(
    (acc, b) => acc + b.value[gala],
    0,
  );

  balanceInfos.forEach(b => {
    b.percentageGala = (b.value[gala] / totalValueGala) * 100;
  });
  return balanceInfos;
}

function makeBalanceInfo(
  balance: BalanceResponse | undefined,
  price: Price,
  galaUsdtPrice: number,
): BalanceInfo {
  const galaPrice = price.tokenIn === gala ? 1 : price.price;
  const usdtPrice =
    price.tokenOut === usdt ? price.price : price.price * galaUsdtPrice;
  return {
    token: price.tokenIn,
    amount: balance?.amount ?? 0,
    decimal: balance?.decimal ?? 0,
    price: {
      [gala]: galaPrice,
      [usdt]: usdtPrice,
    },
    value: {
      [gala]: (balance?.amount ?? 0) * galaPrice,
      [usdt]: (balance?.amount ?? 0) * usdtPrice,
    },
    percentageGala: 0,
  };
}

function pp(t1: string, t2: string, p: number) {
  const t1s = t1.length > 4 ? t1 : `${t1} `;
  const t2s = t2.length > 4 ? t2 : `${t2} `;
  const pfs = pnum(p);
  return `1 ${t1s} = ${pfs} ${t2s}`;
}

function pnum(n: number) {
  return n.toFixed(8).padStart(16, " ");
}

function pperc(p: number) {
  return `${p.toFixed(2).toString()}%`;
}
