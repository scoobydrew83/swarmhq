import { loadConfig } from "@swarmhq/core";
import {
  checkClusterNodeUpdates,
  scanContainerImageUpdates,
  scanServiceImageUpdates,
  updateAllClusterNodes,
  updateClusterNode,
  updateContainerImage,
  updateServiceImage,
} from "../cluster-runtime.js";

function getFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function getNodeUpdateMode(args: string[]): "all" | "os" | "docker" {
  if (args.includes("--os")) {
    return "os";
  }

  if (args.includes("--docker")) {
    return "docker";
  }

  const explicitMode = getFlagValue(args, "--mode");
  if (explicitMode === "os" || explicitMode === "docker" || explicitMode === "all") {
    return explicitMode;
  }

  return "all";
}

function getExcludeList(args: string[]): string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--exclude") {
      const next = args[index + 1];
      if (next) {
        values.push(...next.split(",").map((entry) => entry.trim()).filter(Boolean));
      }
    }
  }

  return values;
}

export async function runUpdateCommand(args: string[]): Promise<void> {
  const subcommand = args[0] && !args[0].startsWith("--") ? args[0] : "help";
  const configPath = getFlagValue(args, "--config");
  const target = getFlagValue(args, "--target") ?? "";
  const name = getFlagValue(args, "--name") ?? "";
  const asJson = args.includes("--json");
  const skipReboot = args.includes("--skip-reboot");
  const confirm = args.includes("--yes");
  const mode = getNodeUpdateMode(args);

  switch (subcommand) {
    case "check":
      console.log(await checkClusterNodeUpdates({ configPath, target, asJson }));
      return;
    case "node": {
      if (args.includes("--dry-run")) {
        const { config } = loadConfig(configPath);
        const node = config.nodes.find((n) => n.id === target || n.host === target);
        const nodeDesc = node ? `${node.id} (${node.host})` : target || "<no target specified>";
        const steps = [
          mode === "all" || mode === "os" ? "    1. Apply OS package updates (apt upgrade)" : null,
          mode === "all" || mode === "docker" ? "    2. Apply Docker package updates" : null,
          skipReboot ? "    3. Skip reboot (--skip-reboot)" : "    3. Run controlled reboot flow if node requires it",
        ].filter(Boolean);
        console.log([
          `[DRY RUN] Would update node: ${nodeDesc}`,
          `  Mode: ${mode}`,
          "  Steps:",
          ...steps,
          "  No changes will be made. Remove --dry-run to apply.",
        ].join("\n"));
        return;
      }
      console.log(
        await updateClusterNode({
          configPath,
          target,
          mode,
          skipReboot,
          confirm,
        }),
      );
      return;
    }
    case "all": {
      if (args.includes("--dry-run")) {
        const { config } = loadConfig(configPath);
        const exclude = new Set(getExcludeList(args));
        const targets = config.nodes.filter((n) => !exclude.has(n.id) && !exclude.has(n.host));
        const nodeList = targets.map((n) => `      - ${n.id} (${n.host})`).join("\n");
        console.log([
          `[DRY RUN] Would update ${targets.length} node(s) sequentially`,
          `  Mode: ${mode}`,
          "  Nodes:",
          nodeList || "      (none — all nodes excluded)",
          "  Steps per node:",
          mode === "all" || mode === "os" ? "    1. Apply OS package updates" : null,
          mode === "all" || mode === "docker" ? "    2. Apply Docker package updates" : null,
          skipReboot ? "    3. Skip reboot (--skip-reboot)" : "    3. Run controlled reboot flow if required",
          "  No changes will be made. Remove --dry-run to apply.",
        ].filter((line) => line !== null).join("\n"));
        return;
      }
      console.log(
        await updateAllClusterNodes({
          configPath,
          mode,
          skipReboot,
          confirm,
          exclude: getExcludeList(args),
        }),
      );
      return;
    }
    case "services":
      console.log(await scanServiceImageUpdates({ configPath, asJson }));
      return;
    case "service":
      console.log(
        await updateServiceImage({
          configPath,
          serviceName: name,
          confirm,
        }),
      );
      return;
    case "containers":
      console.log(await scanContainerImageUpdates({ configPath, asJson }));
      return;
    case "container":
      console.log(
        await updateContainerImage({
          configPath,
          containerName: name,
          confirm,
        }),
      );
      return;
    default:
      console.log(
        "swarmhq update <check|node|all|services|service|containers|container> [--config PATH] [--target NODE] [--name NAME] [--mode all|os|docker] [--os] [--docker] [--exclude NODE1,NODE2] [--skip-reboot] [--json] [--yes]",
      );
  }
}
