interface Price {
  date: Date;
  tokenIn: string;
  amountIn: number;
  tokenOut: string;
  amountOut: number;
  price: number;
  fee: number;
}

export type { Price };
