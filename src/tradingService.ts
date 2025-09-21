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

export class TradingService {
  constructor(
    private readonly crypto: Crypto,
    private readonly db: Db,
    private readonly dex: Dex,
  ) {}

  async fetchPrices(): Promise<void> {
    const wallet = this.crypto.getWallet();

    log(`Fetching balances from dex for ${wallet}...`);
    const balances = await this.dex.fetchBalances();

    log("Fetching prices...");
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
    log("\n");

    log("Saving prices to database...");
    const prices: Price[] = [galaUsdt, ...otherPrices];
    await this.db.savePrices(prices);

    log("Fetching stats...");
    const stats = await Promise.all(
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
        const lastPercentageSign =
          lastPercentage > 0 ? "more exp" : "cheaper";

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

    log("\n");
    const labels = [
      " token",
      "count",
      "              avg",
      "             last",
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
        st.avg.toFixed(8),
        st.lastPrice.toFixed(8),
        `${st.stdPercentage.toFixed(2)}%`,
        `${st.lastPercentage.toFixed(2)}%`,
        st.lastPercentageSign,
      ];
      log(
        arr.map((a, i) => a.padStart(labels[i]?.length ?? 16, " ")).join(" | "),
      );
    });
    log("\n");

    const balanceInfos: BalanceInfo[] = buildBalanceInfos(
      balances,
      prices,
      galaUsdt.price,
    );

    balanceInfos.forEach(b => {
      const message =
        `${b.token}:\t${b.amount.toFixed(8)}\t$${b.value[usdt].toFixed(2)}\t` +
        `(${b.value[gala].toFixed(2)} ${gala}, ${b.value[usdt].toFixed(2)} ${usdt}, ${b.percentage.toFixed(2)}%)`;
      log(message);
    });
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
