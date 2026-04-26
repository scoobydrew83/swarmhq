import { createClusterSecret, inspectClusterSecret, listClusterSecrets, removeClusterSecret } from "../cluster-runtime.js";
import { createSecret, inspectSecret, listSecrets, removeSecret } from "../docker-runtime.js";
import { readContentInput, readFlag, readPositional } from "./resource-utils.js";

export async function runSecretCommand(args: string[]): Promise<void> {
  const subcommand = args[0] && !args[0].startsWith("--") ? args[0] : "ls";
  const context = readFlag(args, "--context");
  const configPath = readFlag(args, "--config");
  const name = readFlag(args, "--name") ?? readPositional(args, 1) ?? "";
  const asJson = args.includes("--json");
  const confirm = args.includes("--yes");

  switch (subcommand) {
    case "create": {
      const input = await readContentInput(args);
      console.log(context ? createSecret({ context, name, confirm, ...input }) : await createClusterSecret({ configPath, name, confirm, ...input }));
      return;
    }
    case "ls":
      console.log(context ? listSecrets(context, asJson) : await listClusterSecrets({ configPath, asJson }));
      return;
    case "inspect":
      console.log(context ? inspectSecret(name, context, asJson) : await inspectClusterSecret({ configPath, name, asJson }));
      return;
    case "rm":
      console.log(context ? removeSecret({ context, name, confirm }) : await removeClusterSecret({ configPath, name, confirm }));
      return;
    default:
      throw new Error(`Unsupported secret subcommand: ${subcommand}`);
  }
}
