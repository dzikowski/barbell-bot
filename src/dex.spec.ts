import { describe, test } from "node:test";
import assert from "node:assert";
import { galaDex } from "./dex";
import { testCrypto } from "./crypto";

void describe("TestDex", () => {
  // one from https://swap.gala.com/leaderboard/
  const wallet = "eth|c32c3526a28a5424c7c0ED999f2CDDA6028a4C91";

  void test("should fetch price", async () => {
    // Given
    const dex = galaDex(testCrypto(wallet));

    // When
    const p = await dex.fetchSwapPrice("GALA", 1, "GUSDT", undefined);

    // Then
    assert.strictEqual(typeof p.amountOut, "number");
    assert.ok(p.amountOut > 0, `Expected amountOut > 0, got ${p.amountOut}`);
  });

  void test("should check the reverse price", async () => {
    // Given
    const dex = galaDex(testCrypto(wallet));
    const amount = 100;
    const p1 = await dex.fetchSwapPrice("GUSDC", amount, "GALA", undefined);
    console.log(p1);

    // When
    const p2 = await dex.fetchSwapPrice("GALA", undefined, "GUSDC", amount);
    console.log(p2);

    // Then - allow for fees and slippage (within 5%)
    const diff = Math.abs(p1.amountIn - p2.amountOut) / p1.amountIn;
    assert.ok(
      diff < 0.05,
      `Expected within 5% of ${p1.amountIn / amount}, got ${p2.amountOut / amount} (${(diff * 100).toFixed(2)}% diff)`,
    );
  });

  void test("should fetch balances", async () => {
    // Given
    const dex = galaDex(testCrypto(wallet));

    // When
    const balances = await dex.fetchBalances();

    // Then
    assert.ok(
      balances.some(b => b.token === "GALA" && b.amount > 0 && b.decimal === 8),
      `Expected some GALA in ${JSON.stringify(balances)}`,
    );
  });
});
