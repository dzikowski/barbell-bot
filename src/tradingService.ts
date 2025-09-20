import { BalanceResponse, Dex, PoolResponse } from "./dex";
import { Db } from "./db";
import { Crypto } from "./crypto";
import { log } from "./log";
import { Price } from "./types";

const usdt = "GUSDT";
const gala = "GALA";
const otherTokens = ["GWBTC", "GWETH", "GSOL", "GWTRX"];

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
    const date = new Date();

    const wallet = this.crypto.getWallet();
    log(`Fetching data from dex for ${wallet}...`);
    const [pools, balances] = (await Promise.all([
      this.dex.fetchPools(),
      this.dex.fetchBalances(),
    ])) as [PoolResponse[], BalanceResponse[]];

    const prices: Price[] = [];

    pools.forEach(pool => {
      // special case - GALA/GUSDT
      if (
        (pool.token0 === gala && pool.token1 === usdt) ||
        (pool.token0 === usdt && pool.token1 === gala)
      ) {
        prices.push(makePrice(date, usdt, pool));
      }

      // regular case when one of the tokens is GALA and the other is the array
      else if (
        (pool.token0 === gala && otherTokens.includes(pool.token1)) ||
        (pool.token1 === gala && otherTokens.includes(pool.token0))
      ) {
        prices.push(makePrice(date, gala, pool));
      }
    });

    const galaUsdtPrice = prices.find(
      p => p.tokenIn === gala && p.tokenOut === usdt,
    );

    if (galaUsdtPrice === undefined) {
      throw new Error(`${gala}/${usdt} price not found`);
    }

    const balanceInfos: BalanceInfo[] = buildBalanceInfos(
      balances,
      prices,
      galaUsdtPrice.price,
    );

    balanceInfos.forEach(b => {
      const message =
        `${b.token}:\t${b.amount.toFixed(8)}\t(${b.value[gala].toFixed(2)} ${gala}, ` +
        `${b.value[usdt].toFixed(2)} ${usdt}, ${b.percentage.toFixed(2)}%)`;
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

export function makePrice(
  date: Date,
  baseToken: string,
  pool: PoolResponse,
): Price {
  if (pool.token0 === baseToken) {
    return {
      date,
      tokenIn: pool.token1,
      tokenOut: baseToken,
      price: pool.token0Price,
      fee: pool.fee,
    };
  } else if (pool.token1 === baseToken) {
    return {
      date,
      tokenIn: pool.token0,
      tokenOut: baseToken,
      price: pool.token1Price,
      fee: pool.fee,
    };
  } else {
    throw new Error(
      `Pool ${pool.token0}/${pool.token1} is not a valid pool for ${baseToken}`,
    );
  }
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
