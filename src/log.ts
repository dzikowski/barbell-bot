export function log(message: string, char: string = "·"): void {
  const timestamp = new Date().toISOString();

  message.split("\n").forEach(line => {
    // eslint-disable-next-line no-console
    console.log(`${timestamp} ${char} ${line}`);
  });
}

export function logWarning(message: string): void {
  message.split("\n").forEach(line => {
    log(`WARNING: ${line}`, "!");
  });
}

export function logError(message: string): void {
  message.split("\n").forEach(line => {
    log(`ERROR: ${line}`, "✖");
  });
}

export function loggedError(message: string): Error {
  logError(message);
  return new Error(message);
}
