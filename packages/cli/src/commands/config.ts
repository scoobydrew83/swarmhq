import readline from "node:readline/promises";
import {
  createConfigBuilderDefaults,
  saveConfigBuilderInput,
  type ConfigBuilderInput,
  type ConfigBuilderNodeInput,
  type HostKeyCheckingMode,
  type KeepalivedState,
  type NodeRole,
} from "@swarmhq/core";
import { executeCommand } from "../command-runtime.js";

function readFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function readText(
  override: string | undefined,
  fallback: string,
): string {
  return override && override.trim() ? override.trim() : fallback;
}

function parseRoles(input: string): NodeRole[] {
  const roles = input
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean) as NodeRole[];

  return roles.length ? roles : ["worker"];
}

function parseNumber(input: string, fallback: number): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function promptNode(
  rl: readline.Interface,
  index: number,
  existing?: ConfigBuilderNodeInput,
): Promise<ConfigBuilderNodeInput> {
  const id = readText(
    await rl.question(`Node ${index + 1} id [${existing?.id ?? `node-${index + 1}`}]: `),
    existing?.id ?? `node-${index + 1}`,
  );
  const host = readText(
    await rl.question(`Node ${index + 1} host [${existing?.host ?? ""}]: `),
    existing?.host ?? "",
  );
  const username = readText(
    await rl.question(`Node ${index + 1} ssh username [${existing?.username ?? "admin"}]: `),
    existing?.username ?? "admin",
  );
  const rolesInput = readText(
    await rl.question(`Node ${index + 1} roles (comma-separated) [${(existing?.roles ?? ["worker"]).join(",")}]: `),
    (existing?.roles ?? ["worker"]).join(","),
  );
  const roles = parseRoles(rolesInput);

  const priorityDefault =
    existing?.keepalivedPriority !== undefined ? String(existing.keepalivedPriority) : "";
  const stateDefault = existing?.keepalivedState ?? "";
  const interfaceDefault = existing?.keepalivedInterface ?? "";
  const nextPriority =
    roles.includes("manager")
      ? parseNumber(
          await rl.question(`Node ${index + 1} keepalived priority [${priorityDefault || "100"}]: `),
          existing?.keepalivedPriority ?? 100,
        )
      : undefined;
  const nextStateRaw = roles.includes("manager")
    ? readText(
        await rl.question(`Node ${index + 1} keepalived state (MASTER/BACKUP) [${stateDefault}]: `),
        stateDefault,
      )
    : "";
  const nextInterface = roles.includes("manager")
    ? readText(
        await rl.question(`Node ${index + 1} keepalived interface override [${interfaceDefault}]: `),
        interfaceDefault,
      )
    : "";

  return {
    id,
    host,
    username,
    roles,
    keepalivedPriority: nextPriority,
    keepalivedState: nextStateRaw ? (nextStateRaw as KeepalivedState) : undefined,
    keepalivedInterface: nextInterface || undefined,
  };
}

function normalizeNode(node: ConfigBuilderNodeInput): ConfigBuilderNodeInput {
  return {
    id: node.id,
    host: node.host,
    username: node.username,
    roles: node.roles,
    keepalivedPriority: node.keepalivedPriority,
    keepalivedState: node.keepalivedState || undefined,
    keepalivedInterface: node.keepalivedInterface?.trim() || undefined,
  };
}

async function runConfigWizard(args: string[]): Promise<void> {
  const configPath = readFlagValue(args, "--config");
  const envPath = readFlagValue(args, "--env");
  const defaults = createConfigBuilderDefaults(configPath, envPath);
  const force = args.includes("--force");
  const yes = args.includes("--yes");

  let input: ConfigBuilderInput = {
    ...defaults.input,
  };

  if (!yes) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      input.configPath = readText(
        await rl.question(`Config path [${input.configPath}]: `),
        input.configPath,
      );
      input.envPath = readText(
        await rl.question(`Secrets env path [${input.envPath}]: `),
        input.envPath,
      );
      input.clusterName = readText(
        await rl.question(`Cluster name [${input.clusterName}]: `),
        input.clusterName,
      );
      input.vip = readText(await rl.question(`Virtual IP [${input.vip}]: `), input.vip);

      const nodeCount = parseNumber(
        await rl.question(`How many nodes? [${input.nodes.length}]: `),
        input.nodes.length,
      );
      const nextNodes: ConfigBuilderNodeInput[] = [];
      for (let index = 0; index < nodeCount; index += 1) {
        nextNodes.push(normalizeNode(await promptNode(rl, index, input.nodes[index])));
      }
      input.nodes = nextNodes;

      input.keepalivedEnabled =
        readText(
          await rl.question(`Enable keepalived? [${input.keepalivedEnabled ? "yes" : "no"}]: `),
          input.keepalivedEnabled ? "yes" : "no",
        ) === "yes";
      input.keepalivedInterface = readText(
        await rl.question(`Keepalived interface [${input.keepalivedInterface}]: `),
        input.keepalivedInterface,
      );
      input.keepalivedRouterId = readText(
        await rl.question(`Keepalived router id [${input.keepalivedRouterId}]: `),
        input.keepalivedRouterId,
      );
      input.keepalivedVirtualRouterId = parseNumber(
        await rl.question(`Keepalived virtual router id [${input.keepalivedVirtualRouterId}]: `),
        input.keepalivedVirtualRouterId,
      );
      input.keepalivedAdvertisementInterval = parseNumber(
        await rl.question(`Keepalived advertisement interval [${input.keepalivedAdvertisementInterval}]: `),
        input.keepalivedAdvertisementInterval,
      );
      input.vrrpPassword = readText(
        await rl.question(`VRRP password [${input.vrrpPassword ?? ""}]: `),
        input.vrrpPassword ?? "",
      );
      input.tailscaleAuthKey = readText(
        await rl.question(`Tailscale auth key [${input.tailscaleAuthKey ?? ""}]: `),
        input.tailscaleAuthKey ?? "",
      );
      input.sshPort = parseNumber(await rl.question(`SSH port [${input.sshPort}]: `), input.sshPort);
      input.sshMode = readText(
        await rl.question(`SSH mode (strict/accept-new/insecure) [${input.sshMode}]: `),
        input.sshMode,
      ) as HostKeyCheckingMode;
      input.hideIps =
        readText(
          await rl.question(`Hide IPs by default? [${input.hideIps ? "yes" : "no"}]: `),
          input.hideIps ? "yes" : "no",
        ) === "yes";
      input.storeCommandHistory =
        readText(
          await rl.question(
            `Store command history in config? [${input.storeCommandHistory ? "yes" : "no"}]: `,
          ),
          input.storeCommandHistory ? "yes" : "no",
        ) === "yes";
    } finally {
      rl.close();
    }
  } else {
    input = {
      ...input,
      configPath: readText(readFlagValue(args, "--config"), input.configPath),
      envPath: readText(readFlagValue(args, "--env"), input.envPath),
      clusterName: readText(readFlagValue(args, "--cluster-name"), input.clusterName),
      vip: readText(readFlagValue(args, "--vip"), input.vip),
      keepalivedInterface: readText(readFlagValue(args, "--keepalived-interface"), input.keepalivedInterface),
      keepalivedRouterId: readText(readFlagValue(args, "--router-id"), input.keepalivedRouterId),
      keepalivedVirtualRouterId: parseNumber(
        readFlagValue(args, "--vrid") ?? String(input.keepalivedVirtualRouterId),
        input.keepalivedVirtualRouterId,
      ),
      keepalivedAdvertisementInterval: parseNumber(
        readFlagValue(args, "--advertisement-interval") ?? String(input.keepalivedAdvertisementInterval),
        input.keepalivedAdvertisementInterval,
      ),
      vrrpPassword: readText(readFlagValue(args, "--vrrp-password"), input.vrrpPassword ?? ""),
      tailscaleAuthKey: readText(
        readFlagValue(args, "--tailscale-auth-key"),
        input.tailscaleAuthKey ?? "",
      ),
      sshPort: parseNumber(readFlagValue(args, "--ssh-port") ?? String(input.sshPort), input.sshPort),
      sshMode: readText(readFlagValue(args, "--ssh-mode"), input.sshMode) as HostKeyCheckingMode,
      hideIps: args.includes("--hide-ips") || input.hideIps,
      storeCommandHistory: args.includes("--store-command-history") || input.storeCommandHistory,
    };
  }

  const result = saveConfigBuilderInput(input, {
    overwrite: force || defaults.hasExistingConfig || yes,
  });
  console.log(`Saved config to ${result.configPath}`);
  console.log(`Saved secrets env to ${result.envPath}`);
  if (result.savedSecretKeys.length) {
    console.log(`Updated secrets: ${result.savedSecretKeys.join(", ")}`);
  }
}

export async function runConfigCommand(args: string[]): Promise<void> {
  const [subcommand = "help"] = args;
  const configFlagIndex = args.indexOf("--config");
  const explicitPath = configFlagIndex >= 0 ? args[configFlagIndex + 1] : undefined;
  const json = args.includes("--json");
  const clusterNameIndex = args.indexOf("--cluster-name");
  const vipIndex = args.indexOf("--vip");
  const sshModeIndex = args.indexOf("--ssh-mode");

  switch (subcommand) {
    case "path": {
      console.log(
        executeCommand({
          commandId: "config.path",
          values: {
            configPath: explicitPath ?? "",
          },
        }).output,
      );
      return;
    }
    case "show": {
      console.log(
        executeCommand({
          commandId: "config.show",
          values: {
            configPath: explicitPath ?? "",
            format: json ? "json" : "summary",
          },
        }).output,
      );
      return;
    }
    case "init": {
      const values: Record<string, string | boolean> = {
        configPath: explicitPath ?? "",
        hideIps: args.includes("--hide-ips"),
        force: args.includes("--force"),
      };

      if (clusterNameIndex >= 0) {
        values.clusterName = args[clusterNameIndex + 1] ?? "";
      }

      if (vipIndex >= 0) {
        values.vip = args[vipIndex + 1] ?? "";
      }

      if (sshModeIndex >= 0) {
        values.sshMode = args[sshModeIndex + 1] ?? "";
      }

      console.log(
        executeCommand({
          commandId: "config.init",
          values,
        }).output,
      );
      return;
    }
    case "wizard":
      await runConfigWizard(args.slice(1));
      return;
    default:
      console.log(
        "swarmhq config <show|path|init|wizard> [--config PATH] [--env PATH] [--json] [--cluster-name NAME] [--vip ADDRESS] [--ssh-mode MODE] [--hide-ips] [--force]",
      );
  }
}
