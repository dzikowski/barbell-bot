import { Db, testDb } from "./db";
import { TestCtx } from "./ctx";
import { Dex, testDex } from "./dex";
import { TradingService } from "./tradingService";
import { describe, test } from "node:test";
import assert from "node:assert";

void describe("Main", () => {
  const expectedLogs = [
    "· Prices:",
    "· ",
    "· 1 GALA  =       0.01512571 GUSDT",
    "· ",
    "· 1 GWBTC = 7308338.81458744 GALA  =  110543.82810787 GUSDT",
    "· 1 GWETH =  268277.70923854 GALA  =    4057.89136596 GUSDT",
    "· 1 GSOL  =   14227.69516759 GALA  =     215.20401953 GUSDT",
    "· 1 GWTRX =      21.73902268 GALA  =       0.32881820 GUSDT",
    "· 1 GOSMI =       0.74017276 GALA  =       0.01119564 GUSDT",
    "· ",
    "! WARNING: Ignoring db.savePrices(6 prices)",
    "· Stats:",
    "· ",
    "·  token | cnt |  avg (GALA) | last (GALA) |   std% |   last% |     sign",
    "· ======================================================================",
    "·  GWBTC |  18 |  7243617.50 |  7308338.81 |  1.03% |   0.89% | more exp",
    "·  GWETH |  18 |   267408.22 |   268228.31 |  0.43% |   0.31% | more exp",
    "·   GSOL |  18 |    14184.95 |    14227.70 |  0.31% |   0.30% | more exp",
    "·  GWTRX |  18 |       21.53 |       21.74 |  1.37% |   0.97% | more exp",
    "·  GOSMI |  16 |        0.67 |        0.74 | 11.87% |  10.18% | more exp",
    "· ",
    "· Balances:",
    "· ",
    "·  token |            amount |  value (GALA) | value (USDT) |   share |  target",
    "· =============================================================================",
    "·   GALA |    15358.00000000 |      15358.00 |       232.30 |  74.91% |  75.00%",
    "·  GWBTC |        0.00014137 |       1033.18 |        15.63 |   5.04% |   5.00%",
    "·  GWETH |        0.00385622 |       1034.54 |        15.65 |   5.05% |   5.00%",
    "·   GSOL |        0.07231013 |       1028.81 |        15.56 |   5.02% |   5.00%",
    "·  GWTRX |       47.05091400 |       1022.84 |        15.47 |   4.99% |   5.00%",
    "·  GOSMI |     1383.58228654 |       1024.09 |        15.49 |   5.00% |   5.00%",
    "· -------|-------------------|---------------|--------------|---------|--------",
    "·        |            Total: |      20501.46 |       310.10 | 100.00%",
    "· ",
    "· Rebalancing:",
    "· ",
    "· GWTRX: 4.99% is above the threshold: 4.75%",
    "·  => doing nothing",
    "· ",
    "· GWETH: 5.05% is below the threshold: 5.25%",
    "·  => doing nothing",
    "· ",
  ].join("\n");

  void test("should run", async () => {
    // Given
    const ctx = new TestCtx();
    const db = testDb(undefined as unknown as Db, ctx);
    const dex = testDex(undefined as unknown as Dex, ctx);
    const service = new TradingService(db, dex, ctx);

    db.readMockedData();
    dex.readMockedData();

    // When (all logic from main.ts)
    const prices = await service.updatePrices();
    const stats = await service.calculateStats();
    const balances = await service.fetchBalances(prices);
    const trades = await service.rebalance(balances, stats);

    if (trades.length > 0) {
      const newBalances = await service.fetchBalances(prices);
      await service.saveTrades(balances, newBalances, trades);
    }

    // Then
    assert.strictEqual(ctx.getLogs(), expectedLogs);
  });
});
