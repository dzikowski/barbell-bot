export interface Ctx {
  now(): Date;
}

export interface Price {
  date: Date;
  tokenIn: string;
  amountIn: number;
  tokenOut: string;
  amountOut: number;
  price: number;
  fee: number;
}

export interface Trade {
  date: Date;
  uniqueId: string;
  tokenIn: string;
  amountIn: number;
  tokenOut: string;
  amountOut: number;
  wasSuccessful: boolean;
}
