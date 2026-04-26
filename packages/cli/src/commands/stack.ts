import {
  deployClusterStack,
  listClusterStackServices,
  listClusterStackTasks,
  listClusterStacks,
  removeClusterStack,
} from "../cluster-runtime.js";
import { deployStack, listStackServices, listStackTasks, listStacks, removeStack } from "../docker-runtime.js";
import { readFlag, readPositional } from "./resource-utils.js";

export async function runStackCommand(args: string[]): Promise<void> {
  const subcommand = args[0] && !args[0].startsWith("--") ? args[0] : "ls";
  const context = readFlag(args, "--context");
  const configPath = readFlag(args, "--config");
  const stackName = readFlag(args, "--name") ?? readPositional(args, 1) ?? "";
  const asJson = args.includes("--json");
  const confirm = args.includes("--yes");

  switch (subcommand) {
    case "deploy": {
      const filePath = readFlag(args, "--file") ?? "";
      console.log(
        context
          ? deployStack({ context, filePath, stackName, confirm })
          : await deployClusterStack({ configPath, filePath, stackName, confirm }),
      );
      return;
    }
    case "ls":
      console.log(context ? listStacks(context, asJson) : await listClusterStacks({ configPath, asJson }));
      return;
    case "ps":
      console.log(context ? listStackTasks({ context, stackName, asJson }) : await listClusterStackTasks({ configPath, stackName, asJson }));
      return;
    case "services":
      console.log(context ? listStackServices({ context, stackName, asJson }) : await listClusterStackServices({ configPath, stackName, asJson }));
      return;
    case "rm":
      console.log(context ? removeStack({ context, stackName, confirm }) : await removeClusterStack({ configPath, stackName, confirm }));
      return;
    default:
      throw new Error(`Unsupported stack subcommand: ${subcommand}`);
  }
}
