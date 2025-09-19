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
      pools.map(async ([sell, buy, amount]) => {
        const price = await this.dex.fetchPrice(sell, amount, buy);
        log(`Price for ${sell}/${buy}, ${amount}: ${price}`);
      }),
    );
  }
}
