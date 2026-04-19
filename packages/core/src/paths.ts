import os from "node:os";
import path from "node:path";

export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) {
    return path.join(xdg, "swarm-cli");
  }

  return path.join(os.homedir(), ".config", "swarm-cli");
}

export function getDefaultConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

export function getDefaultEnvPath(): string {
  return path.join(getConfigDir(), ".env");
}
