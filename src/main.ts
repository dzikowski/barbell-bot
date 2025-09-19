import { cryptoFromPath } from "./crypto";
import { Db, prismaDb } from "./db";
import { galaDex } from "./dex";
import { log, logError } from "./log";
import { TradingService } from "./tradingService";

async function main(): Promise<void> {
  let db: Db | undefined;

  try {
    log("Setting up...");
    const crypto = cryptoFromPath(process.env.PRIVATE_KEY_PATH);
    db = prismaDb;
    await Promise.all([crypto.ensurePrivateKey(), db.connect()]);

    const service = new TradingService(crypto, db, galaDex(crypto));

    log("Fetching prices...");
    await service.fetchPrices();
  } finally {
    await db?.disconnect();
  }
}

main().catch(e => {
  const msg = e instanceof Error ? e.message : "Unknown error occurred";
  logError(`Error in main function: ${msg}`);
  process.exit(1);
});
