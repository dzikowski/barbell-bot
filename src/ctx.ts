export interface Ctx {
  now(): Date;
  log(message: string, char?: string): void;
  logWarning(message: string): void;
  logError(message: string): void;
  loggedError(message: string): Error;
}

export class DefaultCtx implements Ctx {
  now(): Date {
    return new Date();
  }

  log(message: string, char: string = "·"): void {
    const timestamp = new Date().toISOString();

    message.split("\n").forEach(line => {
      // eslint-disable-next-line no-console
      console.log(`${timestamp} ${char} ${line}`);
    });
  }

  logWarning(message: string): void {
    message.split("\n").forEach(line => {
      this.log(`WARNING: ${line}`, "!");
    });
  }

  logError(message: string): void {
    message.split("\n").forEach(line => {
      this.log(`ERROR: ${line}`, "✖");
    });
  }

  loggedError(message: string): Error {
    this.logError(message);
    return new Error(message);
  }
}

export class TestCtx extends DefaultCtx {
  private readonly logs: string[] = [];

  now(): Date {
    return new Date("2025-09-23T09:40:48.565Z");
  }

  log(message: string, char: string = "·"): void {
    this.logs.push(`${char} ${message}`);
  }

  getLogs(): string {
    return this.logs.join("\n");
  }
}
