import { Dex, PoolResponse } from "./dex";
import { Db } from "./db";
import { Crypto } from "./crypto";
import { log } from "./log";
import { Price } from "./types";

const usdt = "GUSDT";
const gala = "GALA";
const otherTokens = ["GWBTC", "GWETH", "GSOL", "GWTRX"];

export class TradingService {
  constructor(
    private readonly crypto: Crypto,
    private readonly db: Db,
    private readonly dex: Dex,
  ) {}

  async fetchPrices(): Promise<void> {
    const date = new Date();

    log("Fetching prices from pools...");
    const pools = await this.dex.fetchPools();
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

    prices.forEach(price => {
      log(`${price.tokenIn}/${price.tokenOut}: ${price.price}`);
    });

    log("Saving prices to database...");
    await this.db.savePrices(prices);
  }
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
