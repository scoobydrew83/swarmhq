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
    case "switch":
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
    default:
      throw new Error(`Unsupported leader subcommand: ${subcommand}`);
  }
}
