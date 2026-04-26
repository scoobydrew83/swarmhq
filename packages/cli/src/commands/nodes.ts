import { listClusterNodes, promoteClusterNode, demoteClusterNode, updateClusterNodeLabel } from "../cluster-runtime.js";
import { listNodes, updateNodeLabel } from "../docker-runtime.js";

export async function runNodesCommand(args: string[]): Promise<void> {
  const [subcommand] = args;
  const contextIndex = args.indexOf("--context");
  const configIndex = args.indexOf("--config");
  const targetIndex = args.indexOf("--target");
  const context = contextIndex >= 0 ? args[contextIndex + 1] : undefined;
  const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
  const target = targetIndex >= 0 ? args[targetIndex + 1] : undefined;
  const keyIndex = args.indexOf("--key");
  const valueIndex = args.indexOf("--value");
  const key = keyIndex >= 0 ? args[keyIndex + 1] : undefined;
  const value = valueIndex >= 0 ? args[valueIndex + 1] : undefined;
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

  if (subcommand === "label") {
    const action = args[1];
    if (action !== "add" && action !== "rm") {
      throw new Error("nodes label requires add or rm.");
    }
    if (!target) throw new Error("--target is required for nodes label.");
    if (!key) throw new Error("--key is required for nodes label.");
    console.log(
      context
        ? updateNodeLabel({ context, action, target, key, value, confirm: yes })
        : await updateClusterNodeLabel({ configPath, action, target, key, value, confirm: yes }),
    );
    return;
  }

  console.log(context ? listNodes(context, asJson) : await listClusterNodes({ configPath, asJson }));
}
