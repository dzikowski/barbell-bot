import { Dex } from "./dex";
import { Db } from "./db";
import { Crypto } from "./crypto";
import { log } from "./log";

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
      }),
    );
  }
}
