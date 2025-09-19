export function log(message: string, char: string = "·"): void {
  const timestamp = new Date().toISOString();

  // eslint-disable-next-line no-console
  console.log(`${timestamp} ${char} ${message}`);
}

export function logWarning(message: string): void {
  log(`WARNING: ${message}`, "!");
}

export function logError(message: string): void {
  log(`ERROR: ${message}`, "✖");
}

export function loggedError(message: string): Error {
  logError(message);
  return new Error(message);
}
