type FlagDef = {
  flag: string;
  description: string;
};

type CommandHelp = {
  usage: string;
  description: string;
  subcommands?: Array<{ name: string; description: string }>;
  flags: FlagDef[];
  examples: string[];
};

const COMMAND_HELP: Record<string, CommandHelp> = {
  config: {
    usage: "swarmhq config <subcommand> [options]",
    description: "View, initialize, or interactively configure the swarmhq config file.",
    subcommands: [
      { name: "show", description: "Print current configuration (redacted)" },
      { name: "path", description: "Print the resolved config file path" },
      { name: "init", description: "Write an example config file" },
      { name: "wizard", description: "Interactive configuration wizard" },
    ],
    flags: [
      { flag: "--config PATH", description: "Path to config file (overrides default)" },
      { flag: "--env PATH", description: "Path to secrets env file (wizard only)" },
      { flag: "--json", description: "Output in JSON format (show)" },
      { flag: "--cluster-name NAME", description: "Set cluster name (init)" },
      { flag: "--vip ADDRESS", description: "Set virtual IP address (init)" },
      { flag: "--ssh-mode MODE", description: "SSH host key mode: strict|accept-new|insecure (init)" },
      { flag: "--hide-ips", description: "Redact IP addresses in output (init)" },
      { flag: "--force", description: "Overwrite existing config file (init)" },
      { flag: "--yes", description: "Accept all defaults without prompting (wizard)" },
    ],
    examples: [
      "swarmhq config show",
      "swarmhq config path",
      "swarmhq config init --cluster-name prod --vip 10.0.0.1",
      "swarmhq config wizard",
      "swarmhq config wizard --yes --cluster-name prod",
    ],
  },
  health: {
    usage: "swarmhq health [options]",
    description: "SSH into configured manager nodes and run a comprehensive cluster health check.",
    flags: [
      { flag: "--config PATH", description: "Path to config file" },
      { flag: "--json", description: "Output full health report as JSON" },
      { flag: "--detailed", description: "Show extended per-node health details" },
    ],
    examples: [
      "swarmhq health",
      "swarmhq health --detailed",
      "swarmhq health --json",
      "swarmhq health --config /path/to/config.json",
    ],
  },
  nodes: {
    usage: "swarmhq nodes [options]",
    description: "List swarm nodes. Uses SSH by default; pass --context to query a local Docker context.",
    flags: [
      { flag: "--config PATH", description: "Path to config file" },
      { flag: "--context NAME", description: "Docker context name (skips SSH)" },
      { flag: "--json", description: "Output in JSON format" },
    ],
    examples: [
      "swarmhq nodes",
      "swarmhq nodes --json",
      "swarmhq nodes --context production",
    ],
  },
  services: {
    usage: "swarmhq services [options]",
    description: "List swarm services. Uses SSH by default; pass --context for a local Docker context.",
    flags: [
      { flag: "--config PATH", description: "Path to config file" },
      { flag: "--context NAME", description: "Docker context name (skips SSH)" },
      { flag: "--json", description: "Output in JSON format" },
    ],
    examples: [
      "swarmhq services",
      "swarmhq services --json",
      "swarmhq services --context production",
    ],
  },
  service: {
    usage: "swarmhq service <subcommand> [options]",
    description: "Inspect a single swarm service or list its tasks.",
    subcommands: [
      { name: "inspect", description: "Show service spec (image, mode, ports, constraints)" },
      { name: "tasks", description: "List running tasks for a service" },
    ],
    flags: [
      { flag: "--config PATH", description: "Path to config file" },
      { flag: "--context NAME", description: "Docker context name" },
      { flag: "--name SERVICE", description: "Service name (required)" },
      { flag: "--all", description: "Include non-running tasks (tasks subcommand)" },
      { flag: "--json", description: "Output in JSON format" },
    ],
    examples: [
      "swarmhq service inspect --name my-web",
      "swarmhq service tasks --name my-web",
      "swarmhq service tasks --name my-web --all",
    ],
  },
  leader: {
    usage: "swarmhq leader <subcommand> [options]",
    description: "Show or switch swarm leadership and VIP (keepalived) assignment.",
    subcommands: [
      { name: "status", description: "Show current leader and swarm state" },
      { name: "switch", description: "Move VIP and/or swarm leadership to a target node" },
    ],
    flags: [
      { flag: "--config PATH", description: "Path to config file" },
      { flag: "--context NAME", description: "Docker context name (status only)" },
      { flag: "--target NODE", description: "Target node id or host (switch)" },
      { flag: "--vip-only", description: "Only move the VIP; skip swarm leadership transfer" },
      { flag: "--swarm-only", description: "Only move swarm leadership; skip VIP transfer" },
      { flag: "--strict-target", description: "Force exact target by temporarily demoting others" },
      { flag: "--json", description: "Output in JSON format (status)" },
      { flag: "--yes", description: "Confirm the operation (required for switch)" },
      { flag: "--dry-run", description: "Show what would happen without executing" },
    ],
    examples: [
      "swarmhq leader status",
      "swarmhq leader switch --target manager-b --yes",
      "swarmhq leader switch --target manager-b --dry-run",
      "swarmhq leader switch --target manager-b --vip-only --yes",
    ],
  },
  reboot: {
    usage: "swarmhq reboot <subcommand> [options]",
    description: "Safely reboot a configured swarm node (drain → reboot → restore).",
    subcommands: [
      { name: "list", description: "List nodes and their current drain/availability status" },
      { name: "status", description: "Show online/SSH/swarm status for a specific node" },
      { name: "node", description: "Drain, reboot, and restore a node" },
    ],
    flags: [
      { flag: "--config PATH", description: "Path to config file" },
      { flag: "--target NODE", description: "Node id or host to reboot" },
      { flag: "--drain-wait SEC", description: "Seconds to wait after draining (default: 30)" },
      { flag: "--boot-wait SEC", description: "Seconds to wait for node to come back (default: 300)" },
      { flag: "--force", description: "Skip the drain step" },
      { flag: "--no-restore", description: "Leave node drained after reboot" },
      { flag: "--yes", description: "Confirm the reboot (required)" },
      { flag: "--dry-run", description: "Show what would happen without rebooting" },
    ],
    examples: [
      "swarmhq reboot list",
      "swarmhq reboot status --target manager-a",
      "swarmhq reboot node --target manager-a --yes",
      "swarmhq reboot node --target manager-a --dry-run",
      "swarmhq reboot node --target manager-a --drain-wait 60 --yes",
    ],
  },
  update: {
    usage: "swarmhq update <subcommand> [options]",
    description: "Scan for and apply OS, Docker, or image updates across the cluster.",
    subcommands: [
      { name: "check", description: "Scan nodes for available OS/Docker package updates" },
      { name: "node", description: "Apply updates to a single node" },
      { name: "all", description: "Apply updates to all nodes sequentially" },
      { name: "services", description: "Scan service images for newer digests" },
      { name: "service", description: "Update a specific service image" },
      { name: "containers", description: "Scan standalone containers for image updates" },
      { name: "container", description: "Update a specific container image" },
    ],
    flags: [
      { flag: "--config PATH", description: "Path to config file" },
      { flag: "--target NODE", description: "Target node id or host (node subcommand)" },
      { flag: "--name NAME", description: "Service or container name" },
      { flag: "--mode all|os|docker", description: "What to update: all, os only, or docker only" },
      { flag: "--os", description: "Shorthand for --mode os" },
      { flag: "--docker", description: "Shorthand for --mode docker" },
      { flag: "--exclude NODE1,NODE2", description: "Nodes to skip (all subcommand)" },
      { flag: "--skip-reboot", description: "Do not reboot after update even if required" },
      { flag: "--json", description: "Output in JSON format" },
      { flag: "--yes", description: "Confirm the operation (required for write ops)" },
      { flag: "--dry-run", description: "Show what would happen without updating" },
    ],
    examples: [
      "swarmhq update check",
      "swarmhq update node --target manager-a --yes",
      "swarmhq update node --target manager-a --dry-run",
      "swarmhq update all --yes",
      "swarmhq update all --exclude manager-a --yes",
      "swarmhq update services --json",
      "swarmhq update service --name my-web --yes",
    ],
  },
  ps: {
    usage: "swarmhq ps [node] [options]",
    description: "List swarm task placements across all nodes or a specific node.",
    flags: [
      { flag: "--config PATH", description: "Path to config file" },
      { flag: "--context NAME", description: "Docker context name" },
      { flag: "--all", description: "Include stopped and failed tasks" },
      { flag: "--json", description: "Output in JSON format" },
    ],
    examples: [
      "swarmhq ps",
      "swarmhq ps manager-a",
      "swarmhq ps --all",
      "swarmhq ps --json",
    ],
  },
  redact: {
    usage: "swarmhq redact [options]",
    description: "Preview how the redaction engine masks secrets and IP addresses.",
    flags: [
      { flag: "--config PATH", description: "Path to config file" },
      { flag: "--source config|env|custom", description: "What to redact (default: config)" },
      { flag: "--hide-ips", description: "Also redact IPv4 addresses" },
      { flag: "--stdin", description: "Read input from stdin (requires --source custom)" },
    ],
    examples: [
      "swarmhq redact",
      "swarmhq redact --source env",
      "echo 'tskey-abc123' | swarmhq redact --source custom --stdin",
    ],
  },
  ui: {
    usage: "swarmhq ui [options]",
    description: "Start the localhost dashboard server and open it in a browser.",
    flags: [
      { flag: "--no-open", description: "Start the server without opening a browser tab" },
    ],
    examples: [
      "swarmhq ui",
      "swarmhq ui --no-open",
    ],
  },
  completions: {
    usage: "swarmhq completions <shell>",
    description: "Output a shell completion script for the given shell.",
    subcommands: [
      { name: "bash", description: "Bash completion script" },
      { name: "zsh", description: "Zsh completion script" },
      { name: "fish", description: "Fish completion script" },
    ],
    flags: [],
    examples: [
      "swarmhq completions bash >> ~/.bashrc",
      "swarmhq completions zsh >> ~/.zshrc",
      "swarmhq completions fish > ~/.config/fish/completions/swarmhq.fish",
    ],
  },
  version: {
    usage: "swarmhq version",
    description: "Print the swarmhq CLI version.",
    flags: [],
    examples: ["swarmhq version"],
  },
};

function renderHelp(name: string, help: CommandHelp): string {
  const lines: string[] = [];
  lines.push(`Usage: ${help.usage}`);
  lines.push("");
  lines.push(help.description);

  if (help.subcommands?.length) {
    lines.push("");
    lines.push("Subcommands:");
    const width = Math.max(...help.subcommands.map((s) => s.name.length));
    for (const sub of help.subcommands) {
      lines.push(`  ${sub.name.padEnd(width + 2)}${sub.description}`);
    }
  }

  if (help.flags.length) {
    lines.push("");
    lines.push("Flags:");
    const width = Math.max(...help.flags.map((f) => f.flag.length));
    for (const { flag, description } of help.flags) {
      lines.push(`  ${flag.padEnd(width + 2)}${description}`);
    }
  }

  if (help.examples.length) {
    lines.push("");
    lines.push("Examples:");
    for (const example of help.examples) {
      lines.push(`  ${example}`);
    }
  }

  return lines.join("\n");
}

export function runHelpCommand(args: string[]): void {
  const commandName = args[0]?.trim() ?? "";

  if (!commandName) {
    const names = Object.keys(COMMAND_HELP).join(", ");
    console.log(`Usage: swarmhq help <command>\n\nAvailable commands: ${names}`);
    return;
  }

  const help = COMMAND_HELP[commandName];
  if (!help) {
    console.error(`No help available for command: ${commandName}`);
    const names = Object.keys(COMMAND_HELP).join(", ");
    console.error(`Available commands: ${names}`);
    process.exitCode = 1;
    return;
  }

  console.log(renderHelp(commandName, help));
}
