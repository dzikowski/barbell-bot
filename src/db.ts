import { PrismaClient } from "@prisma/client";
import { logWarning, loggedError } from "./log";
import { Price } from "./types";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export interface Db {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  savePrices(prices: Price[]): Promise<void>;
  fetchPrices24h(token: string): Promise<Price[]>;
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

  async fetchPrices24h(token: string): Promise<Price[]> {
    if (this.prisma === undefined) {
      throw loggedError("Prisma client not connected");
    }

    const records = await this.prisma.price.findMany({
      where: {
        tokenIn: token,
        date: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
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

  constructor(private readonly db: Db) {}

  public readMockedData(): void {
    try {
      if (existsSync(this.mockFilePath)) {
        const fileContent = readFileSync(this.mockFilePath, "utf-8");
        this.dbMock = JSON.parse(fileContent) as DbMockData;
      }
    } catch (error) {
      logWarning(`Failed to read mock data: ${error}`);
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
      logWarning(`Failed to save mock data: ${error}`);
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

    logWarning("Calling db.connect()");
    await this.db.connect();
    this.dbMock[cacheKey] = undefined;
    this.updateMockedData();
  }

  async disconnect(): Promise<void> {
    const cacheKey = this.getCacheKey("disconnect");
    
    if (this.dbMock[cacheKey] !== undefined) {
      return;
    }

    logWarning("Calling db.disconnect()");
    await this.db.disconnect();
    this.dbMock[cacheKey] = undefined;
    this.updateMockedData();
  }

  async savePrices(prices: Price[]): Promise<void> {
    const cacheKey = this.getCacheKey("savePrices", prices);
    
    if (this.dbMock[cacheKey] !== undefined) {
      return;
    }

    logWarning(`Calling db.savePrices(${prices.length} prices)`);
    await this.db.savePrices(prices);
    this.dbMock[cacheKey] = undefined;
    this.updateMockedData();
  }

  async fetchPrices24h(token: string): Promise<Price[]> {
    const cacheKey = this.getCacheKey("fetchPrices24h", token);
    
    if (this.dbMock[cacheKey]) {
      return this.dbMock[cacheKey] as Price[];
    }

    logWarning(`Calling db.fetchPrices24h(${token})`);
    const result = await this.db.fetchPrices24h(token);
    this.dbMock[cacheKey] = result;
    this.updateMockedData();
    return result;
  }
}

export const prismaDb = new PrismaDb();
export function testDb(db: Db): TestDb {
  return new TestDb(db);
}
