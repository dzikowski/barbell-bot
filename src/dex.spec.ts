import { describe, test } from "node:test";
import assert from "node:assert";
import { galaDex } from "./dex";
import { testCrypto } from "./crypto";

void describe("TestDex", () => {
  void test("should fetch price", async () => {
    // Given
    const dex = galaDex(testCrypto());

    // When
    const price = await dex.fetchPrice("GALA", 1, "GUSDT");

    // Then
    assert.strictEqual(typeof price, "number");
    assert.ok(price > 0, `Expected price > 0, got ${price}`);
  });
});
