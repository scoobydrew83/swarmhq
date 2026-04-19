import {
  checkClusterNodeUpdates,
  scanContainerImageUpdates,
  scanServiceImageUpdates,
  updateAllClusterNodes,
  updateClusterNode,
  updateContainerImage,
  updateServiceImage,
} from "../cluster-runtime.js";

function getFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function getNodeUpdateMode(args: string[]): "all" | "os" | "docker" {
  if (args.includes("--os")) {
    return "os";
  }

  if (args.includes("--docker")) {
    return "docker";
  }

  const explicitMode = getFlagValue(args, "--mode");
  if (explicitMode === "os" || explicitMode === "docker" || explicitMode === "all") {
    return explicitMode;
  }

  return "all";
}

function getExcludeList(args: string[]): string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--exclude") {
      const next = args[index + 1];
      if (next) {
        values.push(...next.split(",").map((entry) => entry.trim()).filter(Boolean));
      }
    }
  }

  return values;
}

export async function runUpdateCommand(args: string[]): Promise<void> {
  const subcommand = args[0] && !args[0].startsWith("--") ? args[0] : "help";
  const configPath = getFlagValue(args, "--config");
  const target = getFlagValue(args, "--target") ?? "";
  const name = getFlagValue(args, "--name") ?? "";
  const asJson = args.includes("--json");
  const skipReboot = args.includes("--skip-reboot");
  const confirm = args.includes("--yes");
  const mode = getNodeUpdateMode(args);

  switch (subcommand) {
    case "check":
      console.log(await checkClusterNodeUpdates({ configPath, target, asJson }));
      return;
    case "node":
      console.log(
        await updateClusterNode({
          configPath,
          target,
          mode,
          skipReboot,
          confirm,
        }),
      );
      return;
    case "all":
      console.log(
        await updateAllClusterNodes({
          configPath,
          mode,
          skipReboot,
          confirm,
          exclude: getExcludeList(args),
        }),
      );
      return;
    case "services":
      console.log(await scanServiceImageUpdates({ configPath, asJson }));
      return;
    case "service":
      console.log(
        await updateServiceImage({
          configPath,
          serviceName: name,
          confirm,
        }),
      );
      return;
    case "containers":
      console.log(await scanContainerImageUpdates({ configPath, asJson }));
      return;
    case "container":
      console.log(
        await updateContainerImage({
          configPath,
          containerName: name,
          confirm,
        }),
      );
      return;
    default:
      console.log(
        "swarmhq update <check|node|all|services|service|containers|container> [--config PATH] [--target NODE] [--name NAME] [--mode all|os|docker] [--os] [--docker] [--exclude NODE1,NODE2] [--skip-reboot] [--json] [--yes]",
      );
  }
}
