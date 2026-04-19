import { listClusterNodes } from "../cluster-runtime.js";
import { listNodes } from "../docker-runtime.js";

export async function runNodesCommand(args: string[]): Promise<void> {
  const contextIndex = args.indexOf("--context");
  const configIndex = args.indexOf("--config");
  const context = contextIndex >= 0 ? args[contextIndex + 1] : undefined;
  const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
  const asJson = args.includes("--json");

  console.log(context ? listNodes(context, asJson) : await listClusterNodes({ configPath, asJson }));
}
