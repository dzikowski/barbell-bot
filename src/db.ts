import { PrismaClient } from "@prisma/client";
import { log, loggedError } from "./log";
import { Price } from "./types";

export interface Db {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  savePrices(prices: Price[]): Promise<void>;
}

class PrismaDb implements Db {
  private prisma: PrismaClient | undefined;
  constructor() {
    this.prisma = undefined;
  }

  async connect(): Promise<void> {
    if (this.prisma === undefined) {
      this.prisma = new PrismaClient();
      await this.prisma.$connect();
    } else {
      throw loggedError("Prisma client already connected");
    }
  }

  async disconnect(): Promise<void> {
    if (this.prisma !== undefined) {
      await this.prisma.$disconnect();
      this.prisma = undefined;
    }
  }

  async savePrices(prices: Price[]): Promise<void> {
    if (this.prisma === undefined) {
      throw loggedError("Prisma client not connected");
    }

    await this.prisma.price.createMany({
      data: prices.map(price => ({
        date: price.date,
        tokenIn: price.tokenIn,
        amountIn: price.amountIn,
        tokenOut: price.tokenOut,
        amountOut: price.amountOut,
        fee: price.fee,
      })),
    });
  }
}

// kept intentionally, even if it is used only for testing
class InMemoryDb implements Db {
  async connect(): Promise<void> {
    return;
  }

  async disconnect(): Promise<void> {
    return;
  }

  async savePrices(prices: Price[]): Promise<void> {
    // In-memory implementation - just log for testing
    log(`InMemoryDb: Would save ${prices.length} prices`);
  }
}

export const prismaDb = new PrismaDb();
export const inMemoryDb = new InMemoryDb();
