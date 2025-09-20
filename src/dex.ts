import { Crypto } from "./crypto";
import { loggedError } from "./log";

// Native fetch is available in Node.js 18+ and TypeScript ES2022+
declare const fetch: typeof globalThis.fetch;

export interface PriceResponse {
  amountIn: number;
  amountOut: number;
  fee: number;
  currentSqrtPrice: number;
  newSqrtPrice: number;
}

export interface PoolResponse {
  token0: string;
  token0Price: number;
  token1: string;
  token1Price: number;
  fee: number;
}

export interface BalanceResponse {
  token: string;
  amount: number;
  decimal: number;
}

export interface Dex {
  fetchSwapPrice(
    tokenIn: string,
    amountIn: number | undefined,
    tokenOut: string,
    amountOut: number | undefined,
  ): Promise<PriceResponse>;

  fetchPools(): Promise<PoolResponse[]>;

  fetchBalances(): Promise<BalanceResponse[]>;
}

const SUPPORTED_FEE_RATE = 10_000;

class GalaDex implements Dex {
  constructor(private readonly crypto: Crypto) {}

  async fetchSwapPrice(
    tokenIn: string,
    amountIn: number | undefined,
    tokenOut: string,
    amountOut: number | undefined,
  ): Promise<PriceResponse> {
    if (amountIn === undefined && amountOut === undefined) {
      throw loggedError("Either amountIn or amountOut must be provided");
    }

    const tokenInQuery = `tokenIn=${encodeURIComponent(`${tokenIn}$Unit$none$none`)}`;
    const tokenOutQuery = `tokenOut=${encodeURIComponent(`${tokenOut}$Unit$none$none`)}`;
    const feeQuery = `fee=${SUPPORTED_FEE_RATE}`;
    const amountQuery =
      amountIn === undefined
        ? `amountOut=${amountOut}`
        : `amountIn=${amountIn}`;

    const info = `${tokenIn}/${amountIn}, ${amountIn ?? "-"}/${amountOut ?? "-"}, ${SUPPORTED_FEE_RATE / 10_000}%`;

    const url =
      "https://dex-backend-prod1.defi.gala.com/v1/trade/quote" +
      `?${tokenInQuery}&${tokenOutQuery}&${amountQuery}&${feeQuery}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const body = await response.text();
        throw loggedError(
          `HTTP error! Fetching price for ${info}: ${response.status}, ${body}`,
        );
      }

      const respJson = (await response.json()) as {
        status: number;
        message: string;
        error: boolean;
        data?: {
          fee?: string | number;
          amountIn?: string | number;
          amountOut?: string | number;
          currentSqrtPrice?: string | number;
          newSqrtPrice?: string | number;
        };
      };

      // Extract the price from the response
      // The response should contain amountOut which represents the price
      if (respJson.data?.amountOut === undefined) {
        throw loggedError(
          `Invalid response format: missing amountOut for ${info}`,
        );
      }

      const price = {
        amountIn: parseFloat(String(respJson.data.amountIn)),
        amountOut: parseFloat(String(respJson.data.amountOut)),
        fee: parseFloat(String(respJson.data.fee)),
        currentSqrtPrice: parseFloat(String(respJson.data.currentSqrtPrice)),
        newSqrtPrice: parseFloat(String(respJson.data.newSqrtPrice)),
      };

      return price;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw loggedError(`Failed to fetch price for ${info}: ${errorMessage}`);
    }
  }

  async fetchPools(): Promise<PoolResponse[]> {
    const url =
      "https://dex-backend-prod1.defi.gala.com/explore/pools" +
      "?limit=20&page=1&sortBy=volume1d&sortOrder=desc";
    const response = await fetch(url);
    const respJson = (await response.json()) as {
      status: number;
      message: string;
      error: boolean;
      data: {
        pools: {
          token0: string;
          token0Price: string | number;
          token1: string;
          token1Price: string | number;
          fee: string | number;
        }[];
      };
    };

    return respJson.data.pools
      .map(pool => ({
        token0: pool.token0,
        token0Price: parseFloat(String(pool.token0Price)),
        token1: pool.token1,
        token1Price: parseFloat(String(pool.token1Price)),
        fee: parseFloat(String(pool.fee)),
      }))
      .filter(pool => pool.fee === 1); // different value in the API
  }

  async fetchBalances(): Promise<BalanceResponse[]> {
    const url =
      "https://dex-backend-prod1.defi.gala.com/user/assets" +
      `?address=${this.crypto.getWallet()}&page=1&limit=20`;
    const response = await fetch(url);
    const respJson = (await response.json()) as {
      status: number;
      message: string;
      error: boolean;
      data: {
        token: {
          image: string;
          name: string;
          decimals: string;
          verify: boolean;
          symbol: string;
          quantity: string;
        }[];
        count: number;
      };
    };

    return respJson.data.token.map(token => ({
      token: token.symbol,
      amount: parseFloat(token.quantity),
      decimal: parseInt(token.decimals),
    }));
  }
}

class TestDex implements Dex {
  private readonly prices: Record<string, Record<string, number>> = {};

  setPrice(tokenIn: string, tokenOut: string, price: number) {
    this.prices[tokenIn] = {
      ...(this.prices[tokenIn] ?? {}),
      [tokenOut]: price,
    };
  }

  async fetchSwapPrice(
    tokenIn: string,
    amountIn: number,
    tokenOut: string,
  ): Promise<PriceResponse> {
    const price = this.prices[tokenIn]?.[tokenOut];
    if (price === undefined) {
      throw new Error(`Price for ${tokenIn}/${tokenOut} not found`);
    }
    return {
      amountIn,
      amountOut: price * amountIn,
      fee: SUPPORTED_FEE_RATE,
      currentSqrtPrice: Math.sqrt(price),
      newSqrtPrice: Math.sqrt(price * 0.97),
    };
  }

  async fetchPools(): Promise<PoolResponse[]> {
    return [];
  }

  async fetchBalances(): Promise<BalanceResponse[]> {
    return [];
  }
}

export function galaDex(crypto: Crypto): Dex {
  return new GalaDex(crypto);
}

export function testDex(): TestDex {
  return new TestDex();
}
