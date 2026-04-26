import { createClusterConfig, inspectClusterConfig, listClusterConfigs, removeClusterConfig } from "../cluster-runtime.js";
import { createConfig, inspectConfig, listConfigs, removeConfig } from "../docker-runtime.js";
import { readContentInput, readFlag, readPositional } from "./resource-utils.js";

export async function runConfigsCommand(args: string[]): Promise<void> {
  const subcommand = args[0] && !args[0].startsWith("--") ? args[0] : "ls";
  const context = readFlag(args, "--context");
  const configPath = readFlag(args, "--config");
  const name = readFlag(args, "--name") ?? readPositional(args, 1) ?? "";
  const asJson = args.includes("--json");
  const confirm = args.includes("--yes");

  switch (subcommand) {
    case "create": {
      const input = await readContentInput(args);
      console.log(context ? createConfig({ context, name, confirm, ...input }) : await createClusterConfig({ configPath, name, confirm, ...input }));
      return;
    }
    case "ls":
      console.log(context ? listConfigs(context, asJson) : await listClusterConfigs({ configPath, asJson }));
      return;
    case "inspect":
      console.log(context ? inspectConfig(name, context, asJson) : await inspectClusterConfig({ configPath, name, asJson }));
      return;
    case "rm":
      console.log(context ? removeConfig({ context, name, confirm }) : await removeClusterConfig({ configPath, name, confirm }));
      return;
    default:
      throw new Error(`Unsupported configs subcommand: ${subcommand}`);
  }
}
