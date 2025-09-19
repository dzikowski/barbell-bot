import { ChainCallDTO } from "@gala-chain/api";
import { log, loggedError } from "./log";
import { promises as fs } from "fs";

export interface Crypto {
  ensurePrivateKey(): Promise<void>;
  sign<T extends ChainCallDTO>(dto: T): T;
}

class CryptoFromPath implements Crypto {
  private readonly privateKeyPath: string;
  private privateKey: string | undefined;

  constructor(path: string | undefined) {
    if (path === undefined || path === "") {
      throw loggedError("Private key path is required");
    }

    this.privateKeyPath = path;
    this.privateKey = undefined;
  }

  async ensurePrivateKey(): Promise<void> {
    try {
      this.privateKey = (await fs.readFile(this.privateKeyPath, "utf8")).trim();
    } catch (error) {
      throw loggedError(
        `Failed to read private key from the provided path: ${error}`,
      );
    }

    log("Private key succcessfuly loaded from the provided path");
  }

  sign<T extends ChainCallDTO>(dto: T): T {
    return dto.signed(this.getPrivateKey());
  }

  private getPrivateKey(): string {
    if (this.privateKey === undefined) {
      throw loggedError("Private key is not loaded");
    }
    return this.privateKey;
  }
}

class TestCrypto implements Crypto {
  // intentionally hardcoded random private key for testing
  // https://privatekeys.pw/key/fe323cf47441956c64e0b94dace1e4645d24149f1fe654a05b1099389c7cc7c9
  private readonly privateKey =
    "fe323cf47441956c64e0b94dace1e4645d24149f1fe654a05b1099389c7cc7c9";

  async ensurePrivateKey(): Promise<void> {
    return;
  }

  sign<T extends ChainCallDTO>(dto: T): T {
    return dto.signed(this.privateKey);
  }
}

export function cryptoFromPath(path: string | undefined): Crypto {
  return new CryptoFromPath(path);
}

export function testCrypto(): Crypto {
  return new TestCrypto();
}
