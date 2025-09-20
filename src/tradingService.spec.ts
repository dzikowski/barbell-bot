import { describe, test } from "node:test";
import assert from "node:assert";
import { makePrice } from "./tradingService";
import { PoolResponse } from "./dex";

void describe("makePrice", () => {
  const testDate = new Date("2024-01-15T10:30:00Z");

  void test("should create price when GUSDT is base token", () => {
    // Given - GALA/GUSDT pool with GUSDT as base
    const pool: PoolResponse = {
      token0: "GALA",
      token0Price: 57.543930136582055, // 1 GUSDT = 57.544 GALA
      token1: "GUSDT",
      token1Price: 0.017378027493542295, // 1 GALA = 0.017378 GUSDT
      fee: 1,
    };
    const currency = "GUSDT";

    // When
    const result = makePrice(testDate, currency, pool);

    // Then
    assert.strictEqual(result.date, testDate);
    assert.strictEqual(result.tokenIn, "GALA");
    assert.strictEqual(result.tokenOut, "GUSDT");
    assert.strictEqual(result.price, 0.017378027493542295); // 1 GALA = 0.017378 GUSDT
    assert.strictEqual(result.fee, 1);
  });

  void test("should create price when GALA is base token", () => {
    // Given - GALA/GUSDT pool with GALA as base
    const pool: PoolResponse = {
      token0: "GALA",
      token0Price: 57.543930136582055, // 1 GUSDT = 57.544 GALA
      token1: "GUSDT",
      token1Price: 0.017378027493542295, // 1 GALA = 0.017378 GUSDT
      fee: 1,
    };
    const currency = "GALA";

    // When
    const result = makePrice(testDate, currency, pool);

    // Then
    assert.strictEqual(result.date, testDate);
    assert.strictEqual(result.tokenIn, "GUSDT");
    assert.strictEqual(result.tokenOut, "GALA");
    assert.strictEqual(result.price, 57.543930136582055); // 1 GUSDT = 57.544 GALA
    assert.strictEqual(result.fee, 1);
  });

  void test("should throw error when base token is not in pool", () => {
    // Given - GALA/GUSDT pool with invalid base token
    const pool: PoolResponse = {
      token0: "GALA",
      token0Price: 57.543930136582055,
      token1: "GUSDT",
      token1Price: 0.017378027493542295,
      fee: 1,
    };
    const currency = "GWBTC"; // Not in this pool

    // When/Then
    assert.throws(() => makePrice(testDate, currency, pool), {
      name: "Error",
      message: "Pool GALA/GUSDT is not a valid pool for GWBTC",
    });
  });
});
