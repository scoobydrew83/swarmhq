import { createClusterNetwork, inspectClusterNetwork, listClusterNetworks, removeClusterNetwork } from "../cluster-runtime.js";
import { createNetwork, inspectNetwork, listNetworks, removeNetwork } from "../docker-runtime.js";
import { readFlag, readPositional } from "./resource-utils.js";

export async function runNetworkCommand(args: string[]): Promise<void> {
  const subcommand = args[0] && !args[0].startsWith("--") ? args[0] : "ls";
  const context = readFlag(args, "--context");
  const configPath = readFlag(args, "--config");
  const name = readFlag(args, "--name") ?? readPositional(args, 1) ?? "";
  const asJson = args.includes("--json");
  const confirm = args.includes("--yes");
  const driver = readFlag(args, "--driver");
  const attachable = !args.includes("--no-attachable");

  switch (subcommand) {
    case "ls":
      console.log(context ? listNetworks(context, asJson) : await listClusterNetworks({ configPath, asJson }));
      return;
    case "inspect":
      console.log(context ? inspectNetwork(name, context, asJson) : await inspectClusterNetwork({ configPath, name, asJson }));
      return;
    case "create":
      console.log(context ? createNetwork({ context, name, driver, attachable, confirm }) : await createClusterNetwork({ configPath, name, driver, attachable, confirm }));
      return;
    case "rm":
      console.log(context ? removeNetwork({ context, name, confirm }) : await removeClusterNetwork({ configPath, name, confirm }));
      return;
    default:
      throw new Error(`Unsupported network subcommand: ${subcommand}`);
  }
}
