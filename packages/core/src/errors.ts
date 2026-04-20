export class SwarmHQError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = "SwarmHQError";
  }
}

export class ConfigError extends SwarmHQError {
  constructor(message: string) {
    super(message, 2);
    this.name = "ConfigError";
  }
}

export class ConnectivityError extends SwarmHQError {
  constructor(message: string) {
    super(message, 3);
    this.name = "ConnectivityError";
  }
}
