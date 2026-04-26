import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConfigError } from "./errors.js";
import { getDefaultConfigPath, getDefaultEnvPath } from "./paths.js";
import type {
  ConfigBuilderDefaults,
  ConfigBuilderInput,
  ConfigBuilderSaveResult,
  HealthSnapshot,
  RuntimeSecrets,
  SwarmConfig,
} from "./types.js";

export const DEFAULT_CONFIG: SwarmConfig = {
  version: 1,
  clusterName: "example-swarm",
  vip: "198.51.100.10",
  nodes: [
    {
      id: "manager-a",
      host: "198.51.100.11",
      username: "admin",
      roles: ["manager"],
      keepalived: {
        priority: 120,
        state: "MASTER",
      },
    },
  ],
  keepalived: {
    enabled: true,
    interface: "eth0",
    routerId: "SWARMHQ",
    virtualRouterId: 51,
    advertisementInterval: 1,
  },
  ssh: {
    port: 22,
    strictHostKeyChecking: "accept-new",
  },
  redaction: {
    hideIps: false,
    storeCommandHistory: false,
  },
};

function parseDotEnv(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const content = fs.readFileSync(envPath, "utf8");
  const entries: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const key = trimmed.slice(0, trimmed.indexOf("=")).trim();
    let value = trimmed.slice(trimmed.indexOf("=") + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    entries[key] = value;
  }

  return entries;
}

function stringifyDotEnv(entries: Record<string, string>): string {
  return `${Object.entries(entries)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
}

function getProjectEnvPath(): string {
  return path.resolve(process.cwd(), ".env");
}

export function resolveEnvPath(explicitPath?: string): string {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  if (process.env.SWARM_ENV_FILE?.trim()) {
    return path.resolve(process.env.SWARM_ENV_FILE);
  }

  const projectEnv = getProjectEnvPath();
  if (fs.existsSync(projectEnv)) {
    return projectEnv;
  }

  return getDefaultEnvPath();
}

export function loadRuntimeSecrets(envPath = resolveEnvPath()): RuntimeSecrets {
  const env = {
    ...parseDotEnv(envPath),
    ...process.env,
  };

  return {
    vrrpPassword: env.SWARM_VRRP_PASSWORD,
    tailscaleAuthKey: env.SWARM_TAILSCALE_AUTHKEY,
  };
}

export function resolveConfigPath(explicitPath?: string, envPath = resolveEnvPath()): string {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  const env = parseDotEnv(envPath);
  const configuredPath = process.env.SWARM_CONFIG_FILE ?? env.SWARM_CONFIG_FILE;

  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return getDefaultConfigPath();
}

export function loadConfigIfPresent(explicitPath?: string): { config: SwarmConfig; path: string } | null {
  try {
    return loadConfig(explicitPath);
  } catch (error) {
    if (error instanceof Error && /^Config file not found at/.test(error.message)) {
      return null;
    }

    throw error;
  }
}

export function validateConfig(config: SwarmConfig): void {
  if (config.version !== 1) {
    throw new ConfigError(
      `Unsupported config version: ${String(config.version)}. Expected version 1. ` +
        `Please regenerate your config with 'swarmhq config init'.`,
    );
  }

  if (!config.clusterName?.trim()) {
    throw new ConfigError("'clusterName' is required in config but is missing or empty.");
  }

  if (!config.vip?.trim()) {
    throw new ConfigError("'vip' (virtual IP address) is required in config but is missing or empty.");
  }

  if (!Array.isArray(config.nodes) || config.nodes.length === 0) {
    throw new ConfigError(
      "At least one node must be defined in the 'nodes' array. Run 'swarmhq config wizard' to add nodes.",
    );
  }

  for (const [index, node] of config.nodes.entries()) {
    const label = node.id?.trim() ? `node '${node.id}'` : `nodes[${index}]`;
    if (!node.id?.trim()) {
      throw new ConfigError(`${label}: 'id' is required and must not be empty.`);
    }
    if (!node.host?.trim()) {
      throw new ConfigError(`Node '${node.id}': 'host' is required and must not be empty.`);
    }
    if (!node.username?.trim()) {
      throw new ConfigError(`Node '${node.id}': 'username' is required and must not be empty.`);
    }
    if (!Array.isArray(node.roles) || node.roles.length === 0) {
      throw new ConfigError(`Node '${node.id}': 'roles' must be a non-empty array (e.g. ["manager"]).`);
    }
  }

  if (!config.nodes.some((node) => node.roles.includes("manager"))) {
    throw new ConfigError(
      "At least one node must have the 'manager' role. Assign roles: [\"manager\"] to one or more nodes.",
    );
  }

  if (!config.ssh) {
    throw new ConfigError("'ssh' configuration block is missing from config.");
  }

  if (config.ssh.port < 1 || config.ssh.port > 65535) {
    throw new ConfigError(`'ssh.port' must be between 1 and 65535, got ${config.ssh.port}.`);
  }

  if (!config.keepalived) {
    throw new ConfigError("'keepalived' configuration block is missing from config.");
  }

  if (!config.keepalived.interface?.trim()) {
    throw new ConfigError("'keepalived.interface' is required (e.g. \"eth0\").");
  }

  if (!config.keepalived.routerId?.trim()) {
    throw new ConfigError("'keepalived.routerId' is required (e.g. \"SWARMHQ\").");
  }

  if (config.keepalived.virtualRouterId < 1 || config.keepalived.virtualRouterId > 255) {
    throw new ConfigError(
      `'keepalived.virtualRouterId' must be between 1 and 255, got ${config.keepalived.virtualRouterId}.`,
    );
  }

  if (config.keepalived.advertisementInterval < 1) {
    throw new ConfigError(
      `'keepalived.advertisementInterval' must be at least 1 second, got ${config.keepalived.advertisementInterval}.`,
    );
  }
}

export function loadConfig(explicitPath?: string): { config: SwarmConfig; path: string } {
  const configPath = resolveConfigPath(explicitPath);

  if (!fs.existsSync(configPath)) {
    throw new ConfigError(
      `Config file not found at ${configPath}. Run 'swarmhq config init' to create one.`,
    );
  }

  let parsed: SwarmConfig;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as SwarmConfig;
  } catch {
    throw new ConfigError(
      `Config file at ${configPath} is not valid JSON. Run 'swarmhq config init --force' to recreate it.`,
    );
  }

  validateConfig(parsed);

  return {
    config: parsed,
    path: configPath,
  };
}

function assertWithinHome(resolvedPath: string, label: string): void {
  const home = os.homedir();
  const normalised = path.normalize(resolvedPath);
  if (!normalised.startsWith(home + path.sep) && normalised !== home) {
    throw new ConfigError(`${label} must be within your home directory (${home}).`);
  }
}

export function saveConfig(config: SwarmConfig, explicitPath?: string): string {
  validateConfig(config);
  const configPath = resolveConfigPath(explicitPath);
  assertWithinHome(configPath, "Config path");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  try {
    fs.chmodSync(configPath, 0o600);
  } catch {
    // Best effort
  }
  return configPath;
}

export function createExampleConfig(): SwarmConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as SwarmConfig;
}

export function createConfigBuilderDefaults(
  explicitConfigPath?: string,
  explicitEnvPath?: string,
): ConfigBuilderDefaults {
  const envPath = resolveEnvPath(explicitEnvPath);
  const configPath = resolveConfigPath(explicitConfigPath, envPath);
  const loaded = loadConfigIfPresent(configPath);
  const config = loaded?.config ?? createExampleConfig();
  const secrets = loadRuntimeSecrets(envPath);

  return {
    hasExistingConfig: Boolean(loaded),
    input: {
      configPath,
      envPath,
      clusterName: config.clusterName,
      vip: config.vip,
      nodes: config.nodes.map((node) => ({
        id: node.id,
        host: node.host,
        username: node.username,
        roles: node.roles,
        keepalivedPriority: node.keepalived?.priority,
        keepalivedState: node.keepalived?.state,
        keepalivedInterface: node.keepalived?.interface,
      })),
      keepalivedEnabled: config.keepalived.enabled,
      keepalivedInterface: config.keepalived.interface,
      keepalivedRouterId: config.keepalived.routerId,
      keepalivedVirtualRouterId: config.keepalived.virtualRouterId,
      keepalivedAdvertisementInterval: config.keepalived.advertisementInterval,
      sshPort: config.ssh.port,
      sshMode: config.ssh.strictHostKeyChecking,
      hideIps: config.redaction.hideIps,
      storeCommandHistory: config.redaction.storeCommandHistory,
      vrrpPassword: secrets.vrrpPassword,
      tailscaleAuthKey: secrets.tailscaleAuthKey,
    },
  };
}

export function buildConfigFromBuilderInput(input: ConfigBuilderInput): SwarmConfig {
  return {
    version: 1,
    clusterName: input.clusterName.trim(),
    vip: input.vip.trim(),
    nodes: input.nodes.map((node) => ({
      id: node.id.trim(),
      host: node.host.trim(),
      username: node.username.trim(),
      roles: node.roles,
      keepalived:
        node.keepalivedPriority !== undefined || node.keepalivedState || node.keepalivedInterface
          ? {
              priority: node.keepalivedPriority,
              state: node.keepalivedState,
              interface: node.keepalivedInterface?.trim() || undefined,
            }
          : undefined,
    })),
    keepalived: {
      enabled: input.keepalivedEnabled,
      interface: input.keepalivedInterface.trim(),
      routerId: input.keepalivedRouterId.trim(),
      virtualRouterId: input.keepalivedVirtualRouterId,
      advertisementInterval: input.keepalivedAdvertisementInterval,
    },
    ssh: {
      port: input.sshPort,
      strictHostKeyChecking: input.sshMode,
    },
    redaction: {
      hideIps: input.hideIps,
      storeCommandHistory: input.storeCommandHistory,
    },
  };
}

export function saveConfigBuilderInput(
  input: ConfigBuilderInput,
  options: { overwrite?: boolean } = {},
): ConfigBuilderSaveResult {
  const configPath = resolveConfigPath(input.configPath, input.envPath);
  const envPath = resolveEnvPath(input.envPath);

  if (!options.overwrite && fs.existsSync(configPath)) {
    throw new Error(`Config already exists at ${configPath}`);
  }

  const config = buildConfigFromBuilderInput({
    ...input,
    configPath,
    envPath,
  });
  saveConfig(config, configPath);

  const envEntries = parseDotEnv(envPath);
  envEntries.SWARM_CONFIG_FILE = configPath;

  const savedSecretKeys: string[] = [];
  if (input.vrrpPassword?.trim()) {
    envEntries.SWARM_VRRP_PASSWORD = input.vrrpPassword.trim();
    savedSecretKeys.push("SWARM_VRRP_PASSWORD");
  }

  if (input.tailscaleAuthKey?.trim()) {
    envEntries.SWARM_TAILSCALE_AUTHKEY = input.tailscaleAuthKey.trim();
    savedSecretKeys.push("SWARM_TAILSCALE_AUTHKEY");
  }

  assertWithinHome(envPath, "Env path");
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, stringifyDotEnv(envEntries), "utf8");
  try {
    fs.chmodSync(envPath, 0o600);
  } catch {
    // Best effort - might fail on some filesystems
  }

  return {
    configPath,
    envPath,
    config,
    savedSecretKeys,
  };
}

export function buildHealthSnapshot(config: SwarmConfig): HealthSnapshot {
  const warnings: string[] = [];

  if (config.redaction.storeCommandHistory) {
    warnings.push("Command history storage is enabled.");
  }

  if (config.ssh.strictHostKeyChecking === "insecure") {
    warnings.push("SSH host key checking is disabled.");
  }

  if (!config.keepalived.enabled) {
    warnings.push("Keepalived failover is disabled.");
  }

  if (config.keepalived.enabled && config.nodes.filter((node) => node.roles.includes("manager")).length < 2) {
    warnings.push("Keepalived is enabled with fewer than two manager nodes.");
  }

  return {
    generatedAt: new Date().toISOString(),
    clusterName: config.clusterName,
    vip: config.vip,
    nodeCount: config.nodes.length,
    warnings,
  };
}
