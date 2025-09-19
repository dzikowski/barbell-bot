import { Dex } from "./dex";
import { Db } from "./db";
import { Crypto } from "./crypto";
import { logError, logWarning } from "./log";

export class TradingService {
  constructor(
    private readonly crypto: Crypto,
    private readonly db: Db,
    private readonly dex: Dex,
  ) {}

  async fetchPrices(): Promise<void> {
    logWarning("Fetching prices NOT implemented...");
    logError("Fetching prices NOT implemented...");
  }
}
