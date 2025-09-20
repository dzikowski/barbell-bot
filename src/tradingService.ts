import { Dex } from "./dex";
import { Db } from "./db";
import { Crypto } from "./crypto";
import { log } from "./log";
import { Price } from "./types";

const pools: [string, string, number][] = [
  ["GALA", "GUSDT", 100],
  ["GALA", "GUSDC", 100],
  ["GUSDT", "GWETH", 10],
  ["GALA", "GWBTC", 100],
  ["GUSDC", "GWETH", 10],
  ["GSOL", "GWBTC", 0.1],
];

export class TradingService {
  constructor(
    private readonly crypto: Crypto,
    private readonly db: Db,
    private readonly dex: Dex,
  ) {}

  async fetchPrices(): Promise<void> {
    const date = new Date();
    const prices: Price[] = [];

    log("Fetching prices...");
    await Promise.all(
      pools.map(async ([tokenIn, tokenOut, amountIn]) => {
        const [p1, p2] = await Promise.all([
          this.dex.fetchPrice(tokenIn, amountIn, tokenOut, undefined),
          this.dex.fetchPrice(tokenOut, undefined, tokenIn, amountIn),
        ]);

        const spread = (p2.amountIn - p1.amountOut) / p1.amountOut;

        const message =
          `Sell ${amountIn} ${tokenIn} for ${p1.amountOut} ${tokenOut}, ` +
          `buy ${amountIn} ${tokenIn} for ${p2.amountIn} ${tokenOut}, ` +
          `(fee: ${p2.fee / 10000}%, ${spread.toFixed(4)}% spread)`;

        log(message);

        // Collect prices for database storage
        prices.push({ ...p1, date, amountIn, tokenIn, tokenOut });
        prices.push({
          ...p2,
          date,
          amountOut: amountIn,
          tokenIn: tokenOut,
          tokenOut: tokenIn,
        });
      }),
    );

    log(`Prices fetched in ${new Date().getTime() - date.getTime()}ms`);

    log("Saving prices to database...");
    await this.db.savePrices(prices);
  }
}
