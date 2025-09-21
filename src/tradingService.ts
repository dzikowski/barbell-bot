import { BalanceResponse, Dex } from "./dex";
import { Db } from "./db";
import { Crypto } from "./crypto";
import { log } from "./log";
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
    log(`\n${  pp(gala, usdt, galaUsdt.price)  }\n`);

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

    const prices: Price[] = [galaUsdt, ...otherPrices];

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

    log("Saving prices to database...");
    await this.db.savePrices(prices);
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
