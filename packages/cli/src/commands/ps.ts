import { listClusterTasks } from "../cluster-runtime.js";
import { listTasks } from "../docker-runtime.js";

export async function runPsCommand(args: string[]): Promise<void> {
  const contextIndex = args.indexOf("--context");
  const configIndex = args.indexOf("--config");
  const context = contextIndex >= 0 ? args[contextIndex + 1] : undefined;
  const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
  const asJson = args.includes("--json");
  const all = args.includes("--all");
  const node = args.find((arg, index) => {
    if (arg.startsWith("--")) {
      return false;
    }

    if (index > 0 && args[index - 1] === "--context") {
      return false;
    }

    if (index > 0 && args[index - 1] === "--config") {
      return false;
    }

    return true;
  });

  console.log(
    context
      ? listTasks({
          context,
          node,
          all,
          asJson,
        })
      : await listClusterTasks({
          configPath,
          node,
          all,
          asJson,
        }),
  );
}
