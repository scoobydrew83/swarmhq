import { listClusterServices } from "../cluster-runtime.js";
import { listServices } from "../docker-runtime.js";

export async function runServicesCommand(args: string[]): Promise<void> {
  const contextIndex = args.indexOf("--context");
  const configIndex = args.indexOf("--config");
  const context = contextIndex >= 0 ? args[contextIndex + 1] : undefined;
  const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
  const asJson = args.includes("--json");

  console.log(
    context ? listServices(context, asJson) : await listClusterServices({ configPath, asJson }),
  );
}
