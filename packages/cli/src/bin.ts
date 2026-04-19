import { runConfigCommand } from "./commands/config.js";
import { runHealthCommand } from "./commands/health.js";
import { runLeaderCommand } from "./commands/leader.js";
import { runNodesCommand } from "./commands/nodes.js";
import { runPsCommand } from "./commands/ps.js";
import { runRedactCommand } from "./commands/redact.js";
import { runRebootCommand } from "./commands/reboot.js";
import { runServiceCommand } from "./commands/service.js";
import { runServicesCommand } from "./commands/services.js";
import { runUiCommand } from "./commands/ui.js";
import { runUpdateCommand } from "./commands/update.js";

const VERSION = "0.1.0";

function showHelp(): void {
  console.log(`swarmhq ${VERSION}

Usage:
  swarmhq <command> [options]

Commands:
  config   Show, initialize, or locate config
  health   Run SSH-backed cluster health checks
  nodes    Query swarm nodes through configured SSH targets
  services Query swarm services through configured SSH targets
  service  Inspect one swarm service or its tasks
  leader   Show current swarm leader status
  reboot   Reboot configured swarm nodes safely
  update   Scan and apply node or image updates
  ps       List swarm task placements
  redact   Preview redaction behavior through the CLI
  ui       Start the localhost dashboard

Examples:
  swarmhq config init
  swarmhq health --json
  swarmhq health --detailed
  swarmhq health --config ~/.config/swarmhq/config.json
  swarmhq leader switch --target docker --yes
  swarmhq reboot list
  swarmhq update check
  swarmhq update services --json
  swarmhq nodes --context production
  swarmhq ui --no-open
`);
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (!command || command === "--help" || command === "-h") {
    showHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
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
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
