import { cryptoFromPath } from "./crypto";
import { Db, prismaDb } from "./db";
import { galaDex } from "./dex";
import { DefaultCtx } from "./ctx";
import { TradingService } from "./tradingService";

const ctx = new DefaultCtx();

async function main(): Promise<void> {
  let db: Db | undefined;

  try {
    // Setting up
    const crypto = cryptoFromPath(process.env.PRIVATE_KEY_PATH, ctx);
    db = prismaDb(ctx);
    await Promise.all([crypto.ensurePrivateKey(), db.connect()]);

    const service = new TradingService(db, galaDex(crypto, ctx), ctx);

    // Bot logic
    const prices = await service.updatePrices();
    const stats = await service.calculateStats();
    const balances = await service.fetchBalances(prices);
    const trades = await service.rebalance(balances, stats);

    if (trades.length > 0) {
      const newBalances = await service.fetchBalances(prices);
      await service.saveTrades(balances, newBalances, trades);
    }
  } finally {
    await db?.disconnect();
  }
}

main().catch(e => {
  const msg = e instanceof Error ? e.message : "Unknown error occurred";
  ctx.logError(`Error in main function: ${msg}`);
  process.exit(1);
});
