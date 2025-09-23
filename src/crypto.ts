import { ChainCallDTO, signatures } from "@gala-chain/api";
import { PrivateKeySigner } from "@gala-chain/gswap-sdk";
import { Ctx } from "./ctx";
import { promises as fs } from "fs";

export interface Crypto {
  ensurePrivateKey(): Promise<void>;
  getWallet(): string;
  getSigner(): PrivateKeySigner;
}

class CryptoFromPath implements Crypto {
  private readonly privateKeyPath: string;
  private wallet: string | undefined;
  private signer: PrivateKeySigner | undefined;

  constructor(
    path: string | undefined,
    private readonly ctx: Ctx,
  ) {
    if (path === undefined || path === "") {
      throw this.ctx.loggedError("Private key path is required");
    }

    this.privateKeyPath = path;
    this.wallet = undefined;
  }

  async ensurePrivateKey(): Promise<void> {
    try {
      const privateKey = (
        await fs.readFile(this.privateKeyPath, "utf8")
      ).trim();
      this.signer = new PrivateKeySigner(privateKey);

      const publicKey = signatures.getPublicKey(privateKey);
      const ethAddress = signatures.getEthAddress(publicKey);
      this.wallet = `eth|${ethAddress}`;
    } catch (error) {
      throw this.ctx.loggedError(
        `Failed to read private key from the provided path: ${error}`,
      );
    }

    this.ctx.log(`Wallet: ${this.wallet}\n`);
  }

  public getSigner(): PrivateKeySigner {
    if (this.signer === undefined) {
      throw this.ctx.loggedError("Private key is not loaded");
    }
    return this.signer;
  }

  getWallet(): string {
    // override for local run
    if (process.env.DEV_WALLET) {
      return process.env.DEV_WALLET;
    }

    if (this.wallet === undefined) {
      throw this.ctx.loggedError("Wallet is not loaded");
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

  public getSigner(): PrivateKeySigner {
    return new PrivateKeySigner(this.privateKey);
  }

  sign<T extends ChainCallDTO>(dto: T): T {
    return dto.signed(this.privateKey);
  }

  getWallet(): string {
    return this.wallet;
  }
}

export function cryptoFromPath(path: string | undefined, ctx: Ctx): Crypto {
  return new CryptoFromPath(path, ctx);
}

export function testCrypto(wallet: string): Crypto {
  return new TestCrypto(wallet);
}
