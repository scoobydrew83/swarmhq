import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  COMMAND_CATALOG,
  type CommandExecutionRequest,
  type CommandExecutionResult,
} from "@swarmhq/core";

export type CliInvocation = {
  args: string[];
  stdin?: string;
  displayCommand: string;
};

type RunCliRequestOptions = {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
};

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

function appendOptionalFlag(args: string[], flag: string, value: string): void {
  if (value.trim()) {
    args.push(flag, value.trim());
  }
}

function appendJsonFlag(args: string[], values: Record<string, string | boolean> | undefined): void {
  if (readString(values, "format", "summary") === "json") {
    args.push("--json");
  }
}

export function buildCliInvocation(request: CommandExecutionRequest): CliInvocation {
  const values = request.values ?? {};

  switch (request.commandId) {
    case "health.report": {
      const args = ["health"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      if (readString(values, "format", "summary") === "detailed") {
        args.push("--detailed");
      }
      appendJsonFlag(args, values);
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "config.show": {
      const args = ["config", "show"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendJsonFlag(args, values);
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "config.path": {
      const args = ["config", "path"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "config.init": {
      const args = ["config", "init"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--cluster-name", readString(values, "clusterName"));
      appendOptionalFlag(args, "--vip", readString(values, "vip"));
      appendOptionalFlag(args, "--ssh-mode", readString(values, "sshMode"));
      if (readBoolean(values, "hideIps")) {
        args.push("--hide-ips");
      }
      if (readBoolean(values, "force")) {
        args.push("--force");
      }
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "security.redaction-preview": {
      const source = readString(values, "source", "config");
      const args = ["redact", "--source", source];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      if (readBoolean(values, "hideIps")) {
        args.push("--hide-ips");
      }
      if (source === "custom") {
        args.push("--stdin");
        return {
          args,
          stdin: readString(values, "customText"),
          displayCommand: `swarmhq ${args.join(" ")}`,
        };
      }
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "operations.nodes": {
      const args = ["nodes"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--context", readString(values, "context"));
      appendJsonFlag(args, values);
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "operations.services": {
      const args = ["services"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--context", readString(values, "context"));
      appendJsonFlag(args, values);
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "operations.service-inspect": {
      const args = ["service", "inspect"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--context", readString(values, "context"));
      appendJsonFlag(args, values);
      appendOptionalFlag(args, "--name", readString(values, "serviceName"));
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "operations.service-tasks": {
      const args = ["service", "tasks"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--context", readString(values, "context"));
      if (readBoolean(values, "all")) {
        args.push("--all");
      }
      appendJsonFlag(args, values);
      appendOptionalFlag(args, "--name", readString(values, "serviceName"));
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "operations.leader": {
      const args = ["leader", "status"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--context", readString(values, "context"));
      appendJsonFlag(args, values);
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "operations.ps": {
      const args = ["ps"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--context", readString(values, "context"));
      if (readBoolean(values, "all")) {
        args.push("--all");
      }
      const node = readString(values, "node");
      if (node.trim()) {
        args.push(node.trim());
      }
      appendJsonFlag(args, values);
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "maintenance.leader-switch": {
      const args = ["leader", "switch"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--target", readString(values, "target"));
      if (readBoolean(values, "vipOnly")) {
        args.push("--vip-only");
      }
      if (readBoolean(values, "swarmOnly")) {
        args.push("--swarm-only");
      }
      if (readBoolean(values, "strictTarget")) {
        args.push("--strict-target");
      }
      if (readBoolean(values, "dryRun")) {
        args.push("--dry-run");
      }
      if (readBoolean(values, "confirm")) {
        args.push("--yes");
      }
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "maintenance.reboot-list": {
      const args = ["reboot", "list"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "maintenance.reboot-node": {
      const args = ["reboot", "node"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--target", readString(values, "target"));
      appendOptionalFlag(args, "--drain-wait", readString(values, "drainWait"));
      appendOptionalFlag(args, "--boot-wait", readString(values, "bootWait"));
      if (readBoolean(values, "force")) {
        args.push("--force");
      }
      if (readBoolean(values, "noRestore")) {
        args.push("--no-restore");
      }
      if (readBoolean(values, "dryRun")) {
        args.push("--dry-run");
      }
      if (readBoolean(values, "confirm")) {
        args.push("--yes");
      }
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "maintenance.reboot-status": {
      const args = ["reboot", "status"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--target", readString(values, "target"));
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "maintenance.update-check": {
      const args = ["update", "check"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--target", readString(values, "target"));
      appendJsonFlag(args, values);
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "maintenance.update-node": {
      const args = ["update", "node"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--target", readString(values, "target"));
      const mode = readString(values, "mode", "all");
      if (mode === "os") {
        args.push("--os");
      } else if (mode === "docker") {
        args.push("--docker");
      }
      if (readBoolean(values, "skipReboot")) {
        args.push("--skip-reboot");
      }
      if (readBoolean(values, "dryRun")) {
        args.push("--dry-run");
      }
      if (readBoolean(values, "confirm")) {
        args.push("--yes");
      }
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "maintenance.update-all": {
      const args = ["update", "all"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      const mode = readString(values, "mode", "all");
      if (mode === "os") {
        args.push("--os");
      } else if (mode === "docker") {
        args.push("--docker");
      }
      const exclude = readString(values, "exclude");
      if (exclude.trim()) {
        args.push("--exclude", exclude.trim());
      }
      if (readBoolean(values, "skipReboot")) {
        args.push("--skip-reboot");
      }
      if (readBoolean(values, "dryRun")) {
        args.push("--dry-run");
      }
      if (readBoolean(values, "confirm")) {
        args.push("--yes");
      }
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "operations.service-update-scan": {
      const args = ["update", "services"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendJsonFlag(args, values);
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "maintenance.service-update": {
      const args = ["update", "service"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--name", readString(values, "serviceName"));
      if (readBoolean(values, "confirm")) {
        args.push("--yes");
      }
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "operations.container-update-scan": {
      const args = ["update", "containers"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendJsonFlag(args, values);
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "maintenance.container-update": {
      const args = ["update", "container"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--name", readString(values, "containerName"));
      if (readBoolean(values, "confirm")) {
        args.push("--yes");
      }
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "maintenance.node-promote": {
      const args = ["nodes", "promote"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--target", readString(values, "nodeId"));
      if (readBoolean(values, "confirm")) {
        args.push("--yes");
      }
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    case "maintenance.node-demote": {
      const args = ["nodes", "demote"];
      appendOptionalFlag(args, "--config", readString(values, "configPath"));
      appendOptionalFlag(args, "--target", readString(values, "nodeId"));
      if (readBoolean(values, "confirm")) {
        args.push("--yes");
      }
      return { args, displayCommand: `swarmhq ${args.join(" ")}` };
    }
    default:
      throw new Error(`No CLI bridge is defined for command ${request.commandId}`);
  }
}

function getCliEntryPath(): string {
  const filename = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(filename), "./bin.js");
}

export async function runCliRequest(
  request: CommandExecutionRequest,
  options: RunCliRequestOptions = {},
): Promise<CommandExecutionResult & { commandLine: string }> {
  const invocation = buildCliInvocation(request);
  const definition = COMMAND_CATALOG.commands.find((command) => command.id === request.commandId);

  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [getCliEntryPath(), ...invocation.args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stdout += text;
      options.onStdout?.(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stderr += text;
      options.onStderr?.(text);
    });

    child.on("error", reject);

    child.on("close", (code) => {
      const output = `${stdout}${stderr}`.trim();
      if (code === 0) {
        resolve({
          commandId: request.commandId,
          label: definition?.label ?? request.commandId,
          summary: `Completed ${definition?.label ?? request.commandId}.`,
          output: output || "Command completed without output.",
          payload: undefined,
          commandLine: invocation.displayCommand,
        });
      } else {
        reject(new Error(output || `CLI exited with code ${code ?? "unknown"}`));
      }
    });

    if (invocation.stdin !== undefined) {
      child.stdin.write(invocation.stdin);
    }
    child.stdin.end();
  });
}
