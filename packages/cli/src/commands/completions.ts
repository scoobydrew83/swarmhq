const COMMANDS = [
  "config",
  "health",
  "nodes",
  "services",
  "service",
  "leader",
  "reboot",
  "update",
  "ps",
  "redact",
  "ui",
  "upgrade",
  "completions",
  "help",
  "version",
];

const SUBCOMMANDS: Record<string, string[]> = {
  config: ["show", "path", "init", "wizard"],
  service: ["inspect", "tasks"],
  leader: ["status", "switch"],
  reboot: ["list", "status", "node"],
  update: ["check", "node", "all", "services", "service", "containers", "container"],
  completions: ["bash", "zsh", "fish"],
};

const FLAGS: Record<string, string[]> = {
  config: ["--config", "--env", "--json", "--cluster-name", "--vip", "--ssh-mode", "--hide-ips", "--force", "--yes"],
  health: ["--config", "--json", "--detailed"],
  nodes: ["--config", "--context", "--json"],
  services: ["--config", "--context", "--json"],
  service: ["--config", "--context", "--name", "--all", "--json"],
  leader: ["--config", "--context", "--target", "--vip-only", "--swarm-only", "--strict-target", "--json", "--yes", "--dry-run"],
  reboot: ["--config", "--target", "--drain-wait", "--boot-wait", "--force", "--no-restore", "--yes", "--dry-run"],
  update: ["--config", "--target", "--name", "--mode", "--os", "--docker", "--exclude", "--skip-reboot", "--json", "--yes", "--dry-run"],
  ps: ["--config", "--context", "--all", "--json"],
  redact: ["--config", "--source", "--hide-ips", "--stdin"],
  ui: ["--no-open"],
  upgrade: ["--check", "--yes"],
};

function bashCompletion(): string {
  const commandList = COMMANDS.join(" ");
  const subcommandCases = Object.entries(SUBCOMMANDS)
    .map(([cmd, subs]) => `            ${cmd}) COMPREPLY=($(compgen -W "${subs.join(" ")}" -- "$cur")) ;;`)
    .join("\n");
  const flagCases = Object.entries(FLAGS)
    .map(([cmd, flags]) => `            ${cmd}) COMPREPLY=($(compgen -W "${flags.join(" ")}" -- "$cur")) ;;`)
    .join("\n");

  return `# swarmhq bash completion
# Add to ~/.bashrc: eval "$(swarmhq completions bash)"
_swarmhq_completions() {
    local cur prev words cword
    _init_completion 2>/dev/null || {
        COMPREPLY=()
        cur="\${COMP_WORDS[COMP_CWORD]}"
        prev="\${COMP_WORDS[COMP_CWORD-1]}"
    }

    local commands="${commandList}"
    local cmd=""
    local i
    for ((i=1; i<\${#COMP_WORDS[@]}-1; i++)); do
        if [[ "\${COMP_WORDS[i]}" != -* ]]; then
            cmd="\${COMP_WORDS[i]}"
            break
        fi
    done

    if [[ -z "$cmd" ]]; then
        COMPREPLY=($(compgen -W "$commands" -- "$cur"))
        return
    fi

    case "$cur" in
        -*)
            case "$cmd" in
${flagCases}
                *) COMPREPLY=() ;;
            esac
            ;;
        *)
            case "$cmd" in
${subcommandCases}
                *) COMPREPLY=($(compgen -W "$commands" -- "$cur")) ;;
            esac
            ;;
    esac
}
complete -F _swarmhq_completions swarmhq`;
}

function zshCompletion(): string {
  const commandDefs = COMMANDS.map((cmd) => {
    const subs = SUBCOMMANDS[cmd];
    const flags = FLAGS[cmd] ?? [];
    const subDesc = subs ? `\n          subcommands:(${subs.join(" ")})` : "";
    const flagArgs = flags.map((f) => `'${f}[${f.replace(/^--/, "")} flag]'`).join("\n            ");
    return `        (${cmd})
          _arguments \\
            ${flagArgs || "'*: :'"}\
${subDesc}
          ;;`;
  }).join("\n");

  return `#compdef swarmhq
# swarmhq zsh completion
# Add to ~/.zshrc: eval "$(swarmhq completions zsh)"
_swarmhq() {
    local state line
    typeset -A opt_args

    _arguments -C \\
        '1: :->command' \\
        '*: :->args'

    case $state in
      command)
        local commands
        commands=(${COMMANDS.map((c) => `'${c}'`).join(" ")})
        _describe 'command' commands
        ;;
      args)
        case $line[1] in
${commandDefs}
          *)
            _files
            ;;
        esac
        ;;
    esac
}
_swarmhq "$@"`;
}

function fishCompletion(): string {
  const commandCompletions = COMMANDS.map(
    (cmd) => `complete -c swarmhq -f -n '__fish_use_subcommand' -a '${cmd}'`,
  ).join("\n");

  const subcommandCompletions = Object.entries(SUBCOMMANDS)
    .map(([cmd, subs]) =>
      subs
        .map(
          (sub) =>
            `complete -c swarmhq -f -n '__fish_seen_subcommand_from ${cmd}' -a '${sub}'`,
        )
        .join("\n"),
    )
    .join("\n");

  const flagCompletions = Object.entries(FLAGS)
    .map(([cmd, flags]) =>
      flags
        .map(
          (flag) =>
            `complete -c swarmhq -n '__fish_seen_subcommand_from ${cmd}' -l '${flag.replace(/^--/, "")}'`,
        )
        .join("\n"),
    )
    .join("\n");

  return `# swarmhq fish completion
# Install: swarmhq completions fish > ~/.config/fish/completions/swarmhq.fish
${commandCompletions}

${subcommandCompletions}

${flagCompletions}`;
}

export const BASH_COMPLETION = bashCompletion();
export const ZSH_COMPLETION = zshCompletion();
export const FISH_COMPLETION = fishCompletion();

export function runCompletionsCommand(args: string[]): void {
  const shell = args[0]?.trim() ?? "";

  switch (shell) {
    case "bash":
      console.log(bashCompletion());
      return;
    case "zsh":
      console.log(zshCompletion());
      return;
    case "fish":
      console.log(fishCompletion());
      return;
    default:
      console.error(`Unknown shell: ${shell || "(none)"}`);
      console.error("Usage: swarmhq completions <bash|zsh|fish>");
      process.exitCode = 1;
  }
}
