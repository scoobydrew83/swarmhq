import { listClusterNodes, promoteClusterNode, demoteClusterNode } from "../cluster-runtime.js";
import { listNodes } from "../docker-runtime.js";

export async function runNodesCommand(args: string[]): Promise<void> {
  const [subcommand] = args;
  const contextIndex = args.indexOf("--context");
  const configIndex = args.indexOf("--config");
  const targetIndex = args.indexOf("--target");
  const context = contextIndex >= 0 ? args[contextIndex + 1] : undefined;
  const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
  const target = targetIndex >= 0 ? args[targetIndex + 1] : undefined;
  const asJson = args.includes("--json");
  const yes = args.includes("--yes");

  if (subcommand === "promote") {
    if (!target) throw new Error("--target is required for promote.");
    console.log(await promoteClusterNode({ configPath, nodeId: target, confirm: yes }));
    return;
  }

  if (subcommand === "demote") {
    if (!target) throw new Error("--target is required for demote.");
    console.log(await demoteClusterNode({ configPath, nodeId: target, confirm: yes }));
    return;
  }

  console.log(context ? listNodes(context, asJson) : await listClusterNodes({ configPath, asJson }));
}
