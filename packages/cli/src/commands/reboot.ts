import { loadConfig } from "@swarmhq/core";
import {
  getRebootStatus,
  listRebootTargets,
  rebootClusterNode,
} from "../cluster-runtime.js";

export async function runRebootCommand(args: string[]): Promise<void> {
  const subcommand = args[0] && !args[0].startsWith("--") ? args[0] : "help";
  const configIndex = args.indexOf("--config");
  const targetIndex = args.indexOf("--target");
  const positionalTarget = args.find((arg, index) => {
    if (index === 0 || arg.startsWith("--")) {
      return false;
    }

    const previous = args[index - 1];
    return previous !== "--config" && previous !== "--target" && previous !== "--drain-wait" && previous !== "--boot-wait";
  });
  const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
  const target = targetIndex >= 0 ? args[targetIndex + 1] ?? "" : positionalTarget ?? "";
  const drainWaitIndex = args.indexOf("--drain-wait");
  const bootWaitIndex = args.indexOf("--boot-wait");

  switch (subcommand) {
    case "list":
      console.log(await listRebootTargets({ configPath }));
      return;
    case "status":
      console.log(await getRebootStatus({ configPath, target }));
      return;
    case "node": {
      const drainWait = drainWaitIndex >= 0 ? Number(args[drainWaitIndex + 1] ?? "30") : 30;
      const bootWait = bootWaitIndex >= 0 ? Number(args[bootWaitIndex + 1] ?? "300") : 300;
      const force = args.includes("--force");
      const noRestore = args.includes("--no-restore");
      if (args.includes("--dry-run")) {
        const { config } = loadConfig(configPath);
        const node = config.nodes.find((n) => n.id === target || n.host === target);
        const nodeDesc = node ? `${node.id} (${node.host})` : target || "<no target specified>";
        console.log([
          `[DRY RUN] Would reboot node: ${nodeDesc}`,
          "  Steps:",
          force
            ? "    1. Skip drain (--force)"
            : `    1. Drain node from swarm workloads (wait ${drainWait}s)`,
          "    2. Send reboot command via SSH",
          `    3. Wait for SSH to become available (up to ${bootWait}s)`,
          noRestore
            ? "    4. Leave node drained (--no-restore)"
            : "    4. Restore node availability in swarm",
          "  No changes will be made. Remove --dry-run to apply.",
        ].join("\n"));
        return;
      }
      console.log(
        await rebootClusterNode({
          configPath,
          target,
          drainWait,
          bootWait,
          force,
          noRestore,
          confirm: args.includes("--yes"),
        }),
      );
      return;
    }
    default:
      console.log(
        "swarmhq reboot <list|status|node> [--config PATH] [--target NODE] [--drain-wait SEC] [--boot-wait SEC] [--force] [--no-restore] [--yes]",
      );
  }
}
