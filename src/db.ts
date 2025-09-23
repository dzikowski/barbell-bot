import { PrismaClient } from "@prisma/client";
import { Ctx } from "./ctx";
import { Price, Trade } from "./types";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export interface Db {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  savePrices(prices: Price[]): Promise<void>;
  fetchPrices24h(token: string): Promise<Price[]>;
  saveTrades(trades: Trade[]): Promise<void>;
}

class PrismaDb implements Db {
  private prisma: PrismaClient | undefined;
  constructor(private readonly ctx: Ctx) {
    this.prisma = undefined;
  }

  async connect(): Promise<void> {
    if (this.prisma === undefined) {
      this.prisma = new PrismaClient();
      await this.prisma.$connect();
    } else {
      throw this.ctx.loggedError("Prisma client already connected");
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
      throw this.ctx.loggedError("Prisma client not connected");
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

  async fetchPrices24h(token: string): Promise<Price[]> {
    if (this.prisma === undefined) {
      throw this.ctx.loggedError("Prisma client not connected");
    }

    const records = await this.prisma.price.findMany({
      where: {
        tokenIn: token,
        date: {
          gte: new Date(this.ctx.now().getTime() - 24 * 60 * 60 * 1000),
        },
      },
    });

    return records.map(record => ({
      date: record.date,
      tokenIn: record.tokenIn,
      amountIn: record.amountIn,
      tokenOut: record.tokenOut,
      amountOut: record.amountOut,
      fee: record.fee,
      price: record.amountOut / record.amountIn,
    }));
  }

  async saveTrades(trades: Trade[]): Promise<void> {
    if (this.prisma === undefined) {
      throw this.ctx.loggedError("Prisma client not connected");
    }

    await this.prisma.trade.createMany({
      data: trades.map(trade => ({
        date: trade.date,
        uniqueId: trade.uniqueId,
        tokenIn: trade.tokenIn,
        amountIn: trade.amountIn,
        tokenOut: trade.tokenOut,
        amountOut: trade.amountOut,
        wasSuccessful: trade.wasSuccessful,
      })),
    });
  }
}

type DbMockData = {
  [key: string]: Price[] | void;
};

export class TestDb implements Db {
  private dbMock: DbMockData = {};
  private readonly mockFilePath = join(
    process.cwd(),
    "data",
    "db-api-mock.json",
  );

  constructor(
    private readonly db: Db,
    private readonly ctx: Ctx,
  ) {}

  public readMockedData(): void {
    try {
      if (existsSync(this.mockFilePath)) {
        const fileContent = readFileSync(this.mockFilePath, "utf-8");
        this.dbMock = JSON.parse(fileContent) as DbMockData;
      }
    } catch (error) {
      this.ctx.logWarning(`Failed to read mock data: ${error}`);
      this.dbMock = {};
    }
  }

  public updateMockedData(): void {
    try {
      const dir = dirname(this.mockFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.mockFilePath, JSON.stringify(this.dbMock, null, 2));
    } catch (error) {
      this.ctx.logWarning(`Failed to save mock data: ${error}`);
    }
  }

  private getCacheKey(method: string, ...params: unknown[]): string {
    return `${method}(${JSON.stringify(params)})`;
  }

  async connect(): Promise<void> {
    const cacheKey = this.getCacheKey("connect");

    if (this.dbMock[cacheKey] !== undefined) {
      return;
    }

    this.ctx.logWarning("Calling db.connect()");
    await this.db.connect();
    this.dbMock[cacheKey] = undefined;
    this.updateMockedData();
  }

  async disconnect(): Promise<void> {
    const cacheKey = this.getCacheKey("disconnect");

    if (this.dbMock[cacheKey] !== undefined) {
      return;
    }

    this.ctx.logWarning("Calling db.disconnect()");
    await this.db.disconnect();
    this.dbMock[cacheKey] = undefined;
    this.updateMockedData();
  }

  async savePrices(prices: Price[]): Promise<void> {
    this.ctx.logWarning(`Ignoring db.savePrices(${prices.length} prices)`);
  }

  async fetchPrices24h(token: string): Promise<Price[]> {
    const cacheKey = this.getCacheKey("fetchPrices24h", token);

    if (this.dbMock[cacheKey]) {
      return this.dbMock[cacheKey] as Price[];
    }

    this.ctx.logWarning(`Calling db.fetchPrices24h(${token})`);
    const result = await this.db.fetchPrices24h(token);
    this.dbMock[cacheKey] = result;
    this.updateMockedData();
    return result;
  }

  async saveTrades(trades: Trade[]): Promise<void> {
    this.ctx.logWarning(`Ignoring db.saveTrades(${trades.length} trades)`);
  }
}

export function prismaDb(ctx: Ctx): PrismaDb {
  return new PrismaDb(ctx);
}

export function testDb(db: Db, ctx: Ctx): TestDb {
  return new TestDb(db, ctx);
}
