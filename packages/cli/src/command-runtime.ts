import {
  COMMAND_CATALOG,
  buildHealthSnapshot,
  createExampleConfig,
  loadConfig,
  loadRuntimeSecrets,
  redactText,
  resolveConfigPath,
  saveConfig,
  type CommandDefinition,
  type CommandExecutionRequest,
  type CommandExecutionResult,
  type HostKeyCheckingMode,
} from "@swarm-cli/core";

function getCommandDefinition(commandId: string): CommandDefinition {
  const definition = COMMAND_CATALOG.commands.find((command) => command.id === commandId);
  if (!definition) {
    throw new Error(`Unknown command: ${commandId}`);
  }

  return definition;
}

function readString(
  values: Record<string, string | boolean> | undefined,
  key: string,
  fallback = "",
): string {
  const value = values?.[key];
  return typeof value === "string" ? value : fallback;
}

function readBoolean(
  values: Record<string, string | boolean> | undefined,
  key: string,
  fallback = false,
): boolean {
  const value = values?.[key];
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value === "true";
  }

  return fallback;
}

function formatSummary(lines: string[]): string {
  return lines.filter(Boolean).join("\n");
}

export function executeCommand(request: CommandExecutionRequest): CommandExecutionResult {
  const definition = getCommandDefinition(request.commandId);
  const values = request.values ?? {};

  switch (request.commandId) {
    case "health.report": {
      const format = readString(values, "format", "summary");
      const configPath = readString(values, "configPath");
      const { config, path } = loadConfig(configPath || undefined);
      const snapshot = buildHealthSnapshot(config);

      const output =
        format === "json"
          ? JSON.stringify({ configPath: path, snapshot }, null, 2)
          : formatSummary([
              `Cluster: ${snapshot.clusterName}`,
              `Config: ${path}`,
              `VIP: ${snapshot.vip}`,
              `Nodes: ${snapshot.nodeCount}`,
              `Warnings: ${snapshot.warnings.length ? snapshot.warnings.join(" | ") : "none"}`,
            ]);

      return {
        commandId: definition.id,
        label: definition.label,
        summary: `Built a ${format} health report.`,
        output,
        payload: { configPath: path, snapshot },
      };
    }
    case "config.show": {
      const format = readString(values, "format", "json");
      const configPath = readString(values, "configPath");
      const loaded = loadConfig(configPath || undefined);
      const output =
        format === "summary"
          ? formatSummary([
              `Path: ${loaded.path}`,
              `Cluster: ${loaded.config.clusterName}`,
              `VIP: ${loaded.config.vip}`,
              `Nodes: ${loaded.config.nodes.length}`,
            ])
          : JSON.stringify(loaded, null, 2);

      return {
        commandId: definition.id,
        label: definition.label,
        summary: "Loaded the active config.",
        output,
        payload: loaded,
      };
    }
    case "config.path": {
      const configPath = readString(values, "configPath");
      const resolved = resolveConfigPath(configPath || undefined);

      return {
        commandId: definition.id,
        label: definition.label,
        summary: "Resolved the active config path.",
        output: resolved,
        payload: { path: resolved },
      };
    }
    case "config.init": {
      const configPath = readString(values, "configPath");
      const force = readBoolean(values, "force");
      const clusterName = readString(values, "clusterName", "example-swarm");
      const vip = readString(values, "vip", "198.51.100.10");
      const sshMode = readString(values, "sshMode", "accept-new") as HostKeyCheckingMode;
      const hideIps = readBoolean(values, "hideIps");

      const targetPath = resolveConfigPath(configPath || undefined);
      const example = createExampleConfig();
      example.clusterName = clusterName;
      example.vip = vip;
      example.ssh.strictHostKeyChecking = sshMode;
      example.redaction.hideIps = hideIps;

      if (!force) {
        try {
          loadConfig(targetPath);
          throw new Error(`Config already exists at ${targetPath}. Re-run with force enabled to overwrite.`);
        } catch (error) {
          if (!(error instanceof Error) || !error.message.startsWith("Config file not found")) {
            throw error;
          }
        }
      }

      const writtenPath = saveConfig(example, targetPath);
      const output = formatSummary([
        `Wrote example config to ${writtenPath}`,
        `Cluster: ${example.clusterName}`,
        `VIP: ${example.vip}`,
        `SSH Host Key Checking: ${example.ssh.strictHostKeyChecking}`,
        `Redact IPs: ${example.redaction.hideIps ? "enabled" : "disabled"}`,
      ]);

      return {
        commandId: definition.id,
        label: definition.label,
        summary: "Wrote an example config file.",
        output,
        payload: { path: writtenPath, config: example },
      };
    }
    case "security.redaction-preview": {
      const source = readString(values, "source", "config");
      const hideIps = readBoolean(values, "hideIps");
      const secrets = loadRuntimeSecrets();
      let sampleText = readString(values, "customText");

      if (source === "config") {
        const { config, path } = loadConfig(readString(values, "configPath") || undefined);
        sampleText = JSON.stringify({ path, config }, null, 2);
      } else if (source === "env") {
        sampleText = formatSummary([
          "SWARM_CONFIG_FILE=/path/to/config.json",
          `SWARM_VRRP_PASSWORD=${secrets.vrrpPassword ?? "replace-me"}`,
          `SWARM_TAILSCALE_AUTHKEY=${secrets.tailscaleAuthKey ?? "replace-me"}`,
        ]);
      }

      const output = redactText(sampleText, hideIps);

      return {
        commandId: definition.id,
        label: definition.label,
        summary: "Rendered a redaction preview.",
        output,
        payload: { source, hideIps },
      };
    }
    default:
      throw new Error(`Command is not implemented: ${request.commandId}`);
  }
}
