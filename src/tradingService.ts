import { BalanceResponse, Dex } from "./dex";
import { Db } from "./db";
import { Crypto } from "./crypto";
import { log, loggedError } from "./log";
import { Price } from "./types";

const usdt = "GUSDT";
const gala = "GALA";
const otherTokens = ["GWBTC", "GWETH", "GSOL", "GWTRX"];

const tradeGalaAmount = 1_000;

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
  percentage: number;
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
    private readonly crypto: Crypto,
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
      " last (GALA)",
      "  std%",
      " last%",
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
        `${st.stdPercentage.toFixed(2)}%`,
        `${st.lastPercentage.toFixed(2)}%`,
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
      "         amount",
      " value (GALA)",
      "value (USDT)",
      "percentage",
    ];
    const labelsStr = labels.join(" | ");
    log(labelsStr);
    log(labelsStr.replace(/./g, "="));

    let totalValueGala = 0;
    let totalValueUsdt = 0;

    balanceInfos.forEach(b => {
      totalValueGala += b.value[gala];
      totalValueUsdt += b.value[usdt];
      const arr: string[] = [
        b.token,
        b.amount.toFixed(8).toString(),
        b.value[gala].toFixed(2).toString(),
        b.value[usdt].toFixed(2).toString(),
        `${b.percentage.toFixed(2).toString()}%`,
      ];
      log(
        arr.map((a, i) => a.padStart(labels[i]?.length ?? 16, " ")).join(" | "),
      );
    });

    log(labelsStr.replace(/./g, "-"));

    const totalArr: string[] = [
      "",
      "Total:",
      totalValueGala.toFixed(2).toString(),
      totalValueUsdt.toFixed(2).toString(),
      "100.00%",
    ];
    log(
      totalArr
        .map((a, i) => a.padStart(labels[i]?.length ?? 16, " "))
        .join(" | "),
    );

    log("");

    return balanceInfos;
  }

  async rebalance(balances: BalanceInfo[], stats: Stats[]): Promise<void> {
    log("Rebalancing...");
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
    b.percentage = (b.value[gala] / totalValueGala) * 100;
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
    percentage: 0,
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
