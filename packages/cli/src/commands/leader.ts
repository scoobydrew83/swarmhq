import { loadConfig } from "@swarmhq/core";
import { getClusterLeaderStatus, switchClusterLeader } from "../cluster-runtime.js";
import { getLeaderStatus } from "../docker-runtime.js";

export async function runLeaderCommand(args: string[]): Promise<void> {
  const subcommand = args[0] && !args[0].startsWith("--") ? args[0] : "status";
  const contextIndex = args.indexOf("--context");
  const configIndex = args.indexOf("--config");
  const targetIndex = args.indexOf("--target");
  const positionalTarget = args.find((arg, index) => {
    if (index === 0 || arg.startsWith("--")) {
      return false;
    }

    const previous = args[index - 1];
    return previous !== "--context" && previous !== "--config" && previous !== "--target";
  });
  const context = contextIndex >= 0 ? args[contextIndex + 1] : undefined;
  const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
  const target = targetIndex >= 0 ? args[targetIndex + 1] ?? "" : positionalTarget ?? "";
  const asJson = args.includes("--json");

  switch (subcommand) {
    case "status":
      console.log(
        context ? getLeaderStatus(context, asJson) : await getClusterLeaderStatus({ configPath, asJson }),
      );
      return;
    case "switch": {
      if (args.includes("--dry-run")) {
        const { config } = loadConfig(configPath);
        const node = config.nodes.find((n) => n.id === target || n.host === target);
        const nodeDesc = node ? `${node.id} (${node.host})` : target || "<no target specified>";
        const vipOnly = args.includes("--vip-only");
        const swarmOnly = args.includes("--swarm-only");
        const strictTarget = args.includes("--strict-target");
        const steps: string[] = [];
        if (!swarmOnly) steps.push("    1. Update keepalived priorities to promote target node as VIP owner");
        if (!vipOnly) {
          if (strictTarget) {
            steps.push("    2. Temporarily demote other managers to force target to become swarm leader");
            steps.push("    3. Re-promote demoted managers once target holds leadership");
          } else {
            steps.push("    2. Demote current swarm leader to trigger re-election toward target");
            steps.push("    3. Promote previous leader back to manager status");
          }
        }
        console.log([
          `[DRY RUN] Would switch leader to: ${nodeDesc}`,
          "  Steps:",
          ...steps,
          "  No changes will be made. Remove --dry-run to apply.",
        ].join("\n"));
        return;
      }
      console.log(
        await switchClusterLeader({
          configPath,
          target,
          vipOnly: args.includes("--vip-only"),
          swarmOnly: args.includes("--swarm-only"),
          strictTarget: args.includes("--strict-target"),
          confirm: args.includes("--yes"),
        }),
      );
      return;
    }
    default:
      throw new Error(`Unsupported leader subcommand: ${subcommand}`);
  }
}
