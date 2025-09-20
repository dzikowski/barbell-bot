interface Price {
  date: Date;
  tokenIn: string;
  amountIn: number;
  tokenOut: string;
  amountOut: number;
  fee: number;
  amountInReversed: number;
}

export type { Price };
