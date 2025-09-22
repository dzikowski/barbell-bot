import { GSwap, GalaChainTokenClassKey } from "@gala-chain/gswap-sdk";
import { Crypto } from "./crypto";
import { log, loggedError } from "./log";
import { Price } from "./types";

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

export interface SwapResponse {
  date: Date;
  uniqueId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: number | undefined;
  amountOut: number | undefined;
}

export interface Dex {
  fetchSwapPrice(
    tokenIn: string,
    amountIn: number | undefined,
    tokenOut: string,
    amountOut: number | undefined,
  ): Promise<Price>;

  fetchPools(): Promise<PoolResponse[]>;

  fetchBalances(): Promise<BalanceResponse[]>;

  swap(
    tokenIn: string,
    amountIn: number | undefined,
    tokenOut: string,
    amountOut: number | undefined,
  ): Promise<SwapResponse>;
}

const SUPPORTED_FEE_RATE = 10_000;

class GalaDex implements Dex {
  private readonly gswap: GSwap;

  constructor(private readonly crypto: Crypto) {
    this.gswap = new GSwap({ signer: this.crypto.getSigner() });
  }

  async fetchSwapPrice(
    tokenIn: string,
    amountIn: number | undefined,
    tokenOut: string,
    amountOut: number | undefined,
  ): Promise<Price> {
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

      const amountInResp = parseFloat(String(respJson.data.amountIn));
      const amountOutResp = parseFloat(String(respJson.data.amountOut));
      const feeResp = parseFloat(String(respJson.data.fee));

      const price: Price = {
        date: new Date(),
        tokenIn,
        tokenOut,
        amountIn: amountInResp,
        amountOut: amountOutResp,
        price: amountOutResp / amountInResp,
        fee: feeResp,
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

  async swap(
    tokenIn: string,
    amountIn: number | undefined,
    tokenOut: string,
    amountOut: number | undefined,
  ): Promise<SwapResponse> {
    const currency = { category: "Unit", type: "none", additionalKey: "none" };
    const tokenInObj: GalaChainTokenClassKey = {
      collection: tokenIn,
      ...currency,
    };
    const tokenOutObj: GalaChainTokenClassKey = {
      collection: tokenOut,
      ...currency,
    };
    const amount =
      amountIn === undefined
        ? { exactOut: amountOut ?? 0 }
        : { exactIn: amountIn };
    const fee = SUPPORTED_FEE_RATE;
    const wallet = this.crypto.getWallet();

    log(
      `    swapping: ${tokenIn}, ${tokenOut}, ${JSON.stringify(amount)}, ${fee}, ${wallet}`,
    );

    if (process.env.NO_TRADE) {
      log("    skipping swap because NO_TRADE is set");
      return {
        date: new Date(),
        uniqueId: `NO_TRADE_${new Date().toISOString()}`,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
      };
    }

    const response = await this.gswap.swaps.swap(
      tokenInObj,
      tokenOutObj,
      fee,
      amount,
      wallet,
    );
    log(`    uniqueId: ${response.transactionId}`);
    return {
      date: new Date(),
      uniqueId: response.transactionId,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
    };
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
  ): Promise<Price> {
    const price = this.prices[tokenIn]?.[tokenOut];
    if (price === undefined) {
      throw new Error(`Price for ${tokenIn}/${tokenOut} not found`);
    }
    return {
      date: new Date(),
      tokenIn,
      tokenOut,
      amountIn,
      amountOut: price * amountIn,
      price,
      fee: SUPPORTED_FEE_RATE,
    };
  }

  async fetchPools(): Promise<PoolResponse[]> {
    return [];
  }

  async fetchBalances(): Promise<BalanceResponse[]> {
    return [];
  }

  async swap(
    tokenIn: string,
    amountIn: number | undefined,
    tokenOut: string,
    amountOut: number | undefined,
  ): Promise<SwapResponse> {
    log(
      `Placehold for swapping: ${JSON.stringify({ tokenIn, amountIn, tokenOut, amountOut })}`,
    );
    return {
      date: new Date(),
      uniqueId: `NO_TRADE_${new Date().toISOString()}`,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
    };
  }
}

export function galaDex(crypto: Crypto): Dex {
  return new GalaDex(crypto);
}

export function testDex(): TestDex {
  return new TestDex();
}
