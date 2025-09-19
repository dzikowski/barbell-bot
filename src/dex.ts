import { Crypto } from "./crypto";
import { loggedError } from "./log";

// Native fetch is available in Node.js 18+ and TypeScript ES2022+
declare const fetch: typeof globalThis.fetch;

export interface Dex {
  fetchPrice(sell: string, amount: number, buy: string): Promise<number>;
}

const GALA_FEE_RATE = 500;

class GalaDex implements Dex {
  constructor(private readonly crypto: Crypto) {}

  async fetchPrice(sell: string, amount: number, buy: string): Promise<number> {
    const tokenIn = `${sell}$Unit$none$none`;
    const tokenOut = `${buy}$Unit$none$none`;
    const amountIn = amount;
    const fee = GALA_FEE_RATE;

    const info = `${sell}/${amount}, ${buy}, ${fee / 10000}%`;

    const url =
      "https://dex-backend-prod1.defi.gala.com/v1/trade/quote" +
      `?tokenIn=${encodeURIComponent(tokenIn)}&tokenOut=${encodeURIComponent(tokenOut)}` +
      `&amountIn=${amountIn}&fee=${fee}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const body = await response.json().catch(e => `${e}`);
        throw loggedError(
          `HTTP error! Fetching price for ${info}: ${response.status}, ${body}`,
        );
      }

      const data = (await response.json()) as { amountOut?: string | number };

      // Extract the price from the response
      // The response should contain amountOut which represents the price
      if (data.amountOut === undefined) {
        throw loggedError(
          `Invalid response format: missing amountOut for ${info}`,
        );
      }

      const price = parseFloat(String(data.amountOut));

      return price;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw loggedError(`Failed to fetch price for ${info}: ${errorMessage}`);
    }
  }
}

class TestDex implements Dex {
  private readonly prices: Record<string, Record<string, number>> = {};

  setPrice(sell: string, buy: string, price: number) {
    this.prices[sell] = { ...(this.prices[sell] ?? {}), [buy]: price };
  }

  async fetchPrice(sell: string, amount: number, buy: string): Promise<number> {
    const price = this.prices[sell]?.[buy];
    if (price === undefined) {
      throw new Error(`Price for ${sell}/${buy} not found`);
    }
    return price * amount;
  }
}

export function galaDex(crypto: Crypto): Dex {
  return new GalaDex(crypto);
}

export function testDex(): TestDex {
  return new TestDex();
}
