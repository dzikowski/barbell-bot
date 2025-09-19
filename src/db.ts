import { PrismaClient } from "@prisma/client";
import { loggedError } from "./log";

export interface Db {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
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
}

// kept intentionally, even if it is used only for testing
class InMemoryDb implements Db {
  async connect(): Promise<void> {
    return;
  }

  async disconnect(): Promise<void> {
    return;
  }
}

export const prismaDb = new PrismaDb();
export const inMemoryDb = new InMemoryDb();
