import { SwarmHQError } from "@swarmhq/core";
import { runCompletionsCommand } from "./commands/completions.js";
import { runConfigCommand } from "./commands/config.js";
import { runConfigsCommand } from "./commands/configs.js";
import { runHealthCommand } from "./commands/health.js";
import { runHelpCommand } from "./commands/help.js";
import { runLeaderCommand } from "./commands/leader.js";
import { runLogsCommand } from "./commands/logs.js";
import { runNetworkCommand } from "./commands/network.js";
import { runNodesCommand } from "./commands/nodes.js";
import { runPsCommand } from "./commands/ps.js";
import { runRedactCommand } from "./commands/redact.js";
import { runRebootCommand } from "./commands/reboot.js";
import { runServiceCommand } from "./commands/service.js";
import { runServicesCommand } from "./commands/services.js";
import { runSecretCommand } from "./commands/secret.js";
import { runStackCommand } from "./commands/stack.js";
import { runUiCommand } from "./commands/ui.js";
import { runUpdateCommand } from "./commands/update.js";
import { runUpgradeCommand } from "./commands/upgrade.js";

declare const __VERSION__: string;
const VERSION = __VERSION__;

function showHelp(): void {
  console.log(`swarmhq ${VERSION}

Usage:
  swarmhq <command> [options]

Commands:
  config       Show, initialize, or locate config
  health       Run SSH-backed cluster health checks
  nodes        Query swarm nodes through configured SSH targets
  services     Query swarm services through configured SSH targets
  service      Inspect one swarm service or its tasks
  stack        Deploy and inspect Docker Swarm stacks
  secret       Manage Docker Swarm secrets
  configs      Manage Docker Swarm configs
  network      Manage Docker networks
  logs         Stream or read swarm service logs
  leader       Show current swarm leader status
  reboot       Reboot configured swarm nodes safely
  update       Scan and apply node or image updates
  ps           List swarm task placements
  redact       Preview redaction behavior through the CLI
  ui           Start the localhost dashboard
  upgrade      Check for and install swarmhq CLI updates
  completions  Generate shell completion script (bash, zsh, fish)
  help         Show per-command help with flag descriptions
  version      Print the CLI version

Examples:
  swarmhq config init
  swarmhq health --json
  swarmhq health --detailed
  swarmhq leader switch --target docker --yes
  swarmhq stack ls
  swarmhq secret ls --json
  swarmhq logs traefik --tail 100
  swarmhq reboot list
  swarmhq update check
  swarmhq update node --target manager-a --dry-run
  swarmhq ui --no-open
  swarmhq help reboot
  swarmhq completions bash >> ~/.bashrc

Exit codes:
  0  Success
  1  General error
  2  Config error (missing file, invalid JSON, validation failure)
  3  Connectivity error (SSH failure, unreachable node)
`);
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (!command || command === "--help" || command === "-h") {
    showHelp();
    return;
  }

  if (command === "--version" || command === "-v" || command === "version") {
    console.log(VERSION);
    return;
  }

  switch (command) {
    case "config":
      await runConfigCommand(args);
      return;
    case "health":
      await runHealthCommand(args);
      return;
    case "nodes":
      await runNodesCommand(args);
      return;
    case "services":
      await runServicesCommand(args);
      return;
    case "service":
      await runServiceCommand(args);
      return;
    case "stack":
      await runStackCommand(args);
      return;
    case "secret":
      await runSecretCommand(args);
      return;
    case "configs":
      await runConfigsCommand(args);
      return;
    case "network":
      await runNetworkCommand(args);
      return;
    case "logs":
      await runLogsCommand(args);
      return;
    case "leader":
      await runLeaderCommand(args);
      return;
    case "ps":
      await runPsCommand(args);
      return;
    case "redact":
      await runRedactCommand(args);
      return;
    case "reboot":
      await runRebootCommand(args);
      return;
    case "update":
      await runUpdateCommand(args);
      return;
    case "ui":
      await runUiCommand(args);
      return;
    case "upgrade":
      await runUpgradeCommand(args);
      return;
    case "help":
      runHelpCommand(args);
      return;
    case "completions":
      runCompletionsCommand(args);
      return;
    default:
      throw new Error(`Unknown command: ${command}. Run 'swarmhq --help' for usage.`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  if (error instanceof SwarmHQError) {
    process.exitCode = error.exitCode;
  } else {
    process.exitCode = 1;
  }
});
