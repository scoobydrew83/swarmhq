import {
  inspectClusterService,
  listClusterServiceTasks,
} from "../cluster-runtime.js";
import { inspectService, listServiceTasks } from "../docker-runtime.js";

export async function runServiceCommand(args: string[]): Promise<void> {
  const subcommand = args[0] && !args[0].startsWith("--") ? args[0] : "help";
  const contextIndex = args.indexOf("--context");
  const configIndex = args.indexOf("--config");
  const nameIndex = args.indexOf("--name");
  const context = contextIndex >= 0 ? args[contextIndex + 1] : undefined;
  const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
  const serviceName = nameIndex >= 0 ? args[nameIndex + 1] ?? "" : "";
  const asJson = args.includes("--json");
  const all = args.includes("--all");

  switch (subcommand) {
    case "inspect":
      console.log(
        context
          ? inspectService(serviceName, context, asJson)
          : await inspectClusterService({
              configPath,
              serviceName,
              asJson,
            }),
      );
      return;
    case "tasks":
      console.log(
        context
          ? listServiceTasks({
              serviceName,
              context,
              all,
              asJson,
            })
          : await listClusterServiceTasks({
              configPath,
              serviceName,
              all,
              asJson,
            }),
      );
      return;
    default:
      console.log(
        "swarm-cli service <inspect|tasks> --name SERVICE [--config PATH] [--context NAME] [--all] [--json]",
      );
  }
}
