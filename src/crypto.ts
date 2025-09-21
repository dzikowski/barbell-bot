import { ChainCallDTO, signatures } from "@gala-chain/api";
import { log, loggedError } from "./log";
import { promises as fs } from "fs";

export interface Crypto {
  ensurePrivateKey(): Promise<void>;
  sign<T extends ChainCallDTO>(dto: T): T;
  getWallet(): string;
}

class CryptoFromPath implements Crypto {
  private readonly privateKeyPath: string;
  private privateKey: string | undefined;
  private wallet: string | undefined;

  constructor(path: string | undefined) {
    if (path === undefined || path === "") {
      throw loggedError("Private key path is required");
    }

    this.privateKeyPath = path;
    this.privateKey = undefined;
    this.wallet = undefined;
  }

  async ensurePrivateKey(): Promise<void> {
    try {
      this.privateKey = (await fs.readFile(this.privateKeyPath, "utf8")).trim();
      const publicKey = signatures.getPublicKey(this.privateKey);
      const ethAddress = signatures.getEthAddress(publicKey);
      this.wallet = `eth|${ethAddress}`;
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

  getWallet(): string {
    // override for local run
    if (process.env.DEV_WALLET) {
      return process.env.DEV_WALLET;
    }

    if (this.wallet === undefined) {
      throw loggedError("Wallet is not loaded");
    }
    return this.wallet;
  }
}

class TestCrypto implements Crypto {
  // intentionally hardcoded random private key for testing
  // https://privatekeys.pw/key/fe323cf47441956c64e0b94dace1e4645d24149f1fe654a05b1099389c7cc7c9
  private readonly privateKey =
    "fe323cf47441956c64e0b94dace1e4645d24149f1fe654a05b1099389c7cc7c9";

  private readonly wallet: string;

  constructor(wallet: string) {
    this.wallet = wallet;
  }

  async ensurePrivateKey(): Promise<void> {
    return;
  }

  sign<T extends ChainCallDTO>(dto: T): T {
    return dto.signed(this.privateKey);
  }

  getWallet(): string {
    return this.wallet;
  }
}

export function cryptoFromPath(path: string | undefined): Crypto {
  return new CryptoFromPath(path);
}

export function testCrypto(wallet: string): Crypto {
  return new TestCrypto(wallet);
}
