import { Crypto } from "./crypto";

export interface Dex {
  fetchPrice(sell: string, buy: string): Promise<number>;
}

class GalaDex implements Dex {
  constructor(private readonly crypto: Crypto) {}

  async fetchPrice(sell: string, buy: string): Promise<number> {
    throw new Error(`Not implemented: ${sell}/${buy}`);
  }
}

class TestDex implements Dex {
  private readonly prices: Record<string, Record<string, number>> = {};

  setPrice(sell: string, buy: string, price: number) {
    this.prices[sell] = { ...(this.prices[sell] ?? {}), [buy]: price };
  }

  async fetchPrice(sell: string, buy: string): Promise<number> {
    const price = this.prices[sell]?.[buy];
    if (price === undefined) {
      throw new Error(`Price for ${sell}/${buy} not found`);
    }
    return price;
  }
}

export function galaDex(crypto: Crypto): Dex {
  return new GalaDex(crypto);
}

export function testDex(): TestDex {
  return new TestDex();
}
