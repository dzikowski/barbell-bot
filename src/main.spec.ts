import { testCrypto } from "./crypto";
import { Db, testDb } from "./db";
import { TestCtx } from "./ctx";
import { Dex, testDex } from "./dex";
import { TradingService } from "./tradingService";
import { describe, test } from "node:test";
import assert from "node:assert";

void describe("Main", () => {
  void test("should run", async () => {
    // Given
    const ctx = new TestCtx();
    const crypto = testCrypto("eth|c32c3526a28a5424c7c0ED999f2CDDA6028a4C91");
    const db = testDb(undefined as unknown as Db, ctx);
    const dex = testDex(undefined as unknown as Dex, ctx);
    const service = new TradingService(db, dex, ctx);

    db.readMockedData();
    dex.readMockedData();

    // When
    const prices = await service.updatePrices();
    const stats = await service.calculateStats();
    const balances = await service.fetchBalances(prices);
    const trades = await service.rebalance(balances, stats);

    if (trades.length > 0) {
      const newBalances = await service.fetchBalances(prices);
      await service.saveTrades(balances, newBalances, trades);
    }

    // Then
    assert.strictEqual(ctx.getLogs(), "Hello, world!");
  });
});
