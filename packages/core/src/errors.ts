export class ConfigError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class ConnectivityError extends Error {
  readonly exitCode = 3;
  constructor(message: string) {
    super(message);
    this.name = "ConnectivityError";
  }
}
