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
    case "node":
      console.log(
        await rebootClusterNode({
          configPath,
          target,
          drainWait: drainWaitIndex >= 0 ? Number(args[drainWaitIndex + 1] ?? "30") : 30,
          bootWait: bootWaitIndex >= 0 ? Number(args[bootWaitIndex + 1] ?? "300") : 300,
          force: args.includes("--force"),
          noRestore: args.includes("--no-restore"),
          confirm: args.includes("--yes"),
        }),
      );
      return;
    default:
      console.log(
        "swarm-cli reboot <list|status|node> [--config PATH] [--target NODE] [--drain-wait SEC] [--boot-wait SEC] [--force] [--no-restore] [--yes]",
      );
  }
}
