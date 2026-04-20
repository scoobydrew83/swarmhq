export const BASH_COMPLETION = `
_swarmhq_completions() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  local top_commands="config health nodes services service leader ps redact reboot update ui upgrade version help completions"

  case "\${COMP_WORDS[1]}" in
    config)
      COMPREPLY=($(compgen -W "show path init wizard" -- "\$cur"))
      ;;
    leader)
      COMPREPLY=($(compgen -W "status switch" -- "\$cur"))
      ;;
    reboot)
      COMPREPLY=($(compgen -W "list status node" -- "\$cur"))
      ;;
    update)
      COMPREPLY=($(compgen -W "check node all services service containers container" -- "\$cur"))
      ;;
    completions)
      COMPREPLY=($(compgen -W "bash zsh fish" -- "\$cur"))
      ;;
    *)
      COMPREPLY=($(compgen -W "\$top_commands" -- "\$cur"))
      ;;
  esac
}
complete -F _swarmhq_completions swarmhq
`.trim();

export const ZSH_COMPLETION = `
#compdef swarmhq

_swarmhq() {
  local state

  _arguments \\
    '1:command:->command' \\
    '*:: :->args'

  case $state in
    command)
      local -a commands
      commands=(
        'config:Show, initialize, or locate config'
        'health:Run cluster health checks'
        'nodes:List swarm nodes'
        'services:List swarm services'
        'service:Inspect one swarm service or its tasks'
        'leader:Show or switch swarm leader'
        'ps:List task placements per node'
        'redact:Preview config and env redaction'
        'reboot:Reboot a swarm node safely'
        'update:Scan and apply node or image updates'
        'ui:Start the localhost dashboard'
        'upgrade:Update the swarmhq CLI to the latest version'
        'version:Print current version'
        'help:Show command help'
        'completions:Generate shell completion script'
      )
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        config)
          local -a subcommands
          subcommands=('show:Display current config' 'path:Print resolved config file path' 'init:Create an example config' 'wizard:Interactive setup wizard')
          _describe 'subcommand' subcommands
          ;;
        leader)
          local -a subcommands
          subcommands=('status:Show current leader' 'switch:Move leadership to a target node')
          _describe 'subcommand' subcommands
          ;;
        reboot)
          local -a subcommands
          subcommands=('list:List reboot targets' 'status:Check if a node is back online' 'node:Drain, reboot, and restore one node')
          _describe 'subcommand' subcommands
          ;;
        update)
          local -a subcommands
          subcommands=('check:Scan for OS/Docker updates' 'node:Update one node' 'all:Update all nodes' 'services:Scan service images' 'service:Update one service image' 'containers:Scan container images' 'container:Update one container image')
          _describe 'subcommand' subcommands
          ;;
        completions)
          local -a shells
          shells=('bash' 'zsh' 'fish')
          _describe 'shell' shells
          ;;
      esac
      ;;
  esac
}

_swarmhq
`.trim();

export const FISH_COMPLETION = `
# swarmhq fish completions

set -l top_commands config health nodes services service leader ps redact reboot update ui upgrade version help completions

# Top-level commands
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a config      -d 'Show, initialize, or locate config'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a health      -d 'Run cluster health checks'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a nodes       -d 'List swarm nodes'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a services    -d 'List swarm services'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a service     -d 'Inspect one swarm service or its tasks'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a leader      -d 'Show or switch swarm leader'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a ps          -d 'List task placements per node'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a redact      -d 'Preview config and env redaction'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a reboot      -d 'Reboot a swarm node safely'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a update      -d 'Scan and apply node or image updates'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a ui          -d 'Start the localhost dashboard'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a upgrade     -d 'Update the swarmhq CLI'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a version     -d 'Print current version'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a help        -d 'Show command help'
complete -c swarmhq -f -n 'not __fish_seen_subcommand_from $top_commands' -a completions -d 'Generate shell completion script'

# config subcommands
complete -c swarmhq -f -n '__fish_seen_subcommand_from config' -a show   -d 'Display current config'
complete -c swarmhq -f -n '__fish_seen_subcommand_from config' -a path   -d 'Print resolved config file path'
complete -c swarmhq -f -n '__fish_seen_subcommand_from config' -a init   -d 'Create an example config'
complete -c swarmhq -f -n '__fish_seen_subcommand_from config' -a wizard -d 'Interactive setup wizard'

# leader subcommands
complete -c swarmhq -f -n '__fish_seen_subcommand_from leader' -a status -d 'Show current swarm leader'
complete -c swarmhq -f -n '__fish_seen_subcommand_from leader' -a switch -d 'Move leadership to a target node'

# reboot subcommands
complete -c swarmhq -f -n '__fish_seen_subcommand_from reboot' -a list   -d 'List reboot targets'
complete -c swarmhq -f -n '__fish_seen_subcommand_from reboot' -a status -d 'Check if a node is back online'
complete -c swarmhq -f -n '__fish_seen_subcommand_from reboot' -a node   -d 'Drain, reboot, and restore one node'

# update subcommands
complete -c swarmhq -f -n '__fish_seen_subcommand_from update' -a check      -d 'Scan for OS/Docker updates'
complete -c swarmhq -f -n '__fish_seen_subcommand_from update' -a node       -d 'Update one node'
complete -c swarmhq -f -n '__fish_seen_subcommand_from update' -a all        -d 'Update all nodes'
complete -c swarmhq -f -n '__fish_seen_subcommand_from update' -a services   -d 'Scan service image updates'
complete -c swarmhq -f -n '__fish_seen_subcommand_from update' -a service    -d 'Update one service image'
complete -c swarmhq -f -n '__fish_seen_subcommand_from update' -a containers -d 'Scan container image updates'
complete -c swarmhq -f -n '__fish_seen_subcommand_from update' -a container  -d 'Update one container image'

# completions subcommands
complete -c swarmhq -f -n '__fish_seen_subcommand_from completions' -a bash -d 'Bash completion script'
complete -c swarmhq -f -n '__fish_seen_subcommand_from completions' -a zsh  -d 'Zsh completion script'
complete -c swarmhq -f -n '__fish_seen_subcommand_from completions' -a fish -d 'Fish completion script'
`.trim();

export function runCompletionsCommand(args: string[]): void {
  const shell = args[0];

  switch (shell) {
    case "bash":
      console.log(BASH_COMPLETION);
      return;
    case "zsh":
      console.log(ZSH_COMPLETION);
      return;
    case "fish":
      console.log(FISH_COMPLETION);
      return;
    default:
      console.log("swarmhq completions <bash|zsh|fish>");
      console.log("");
      console.log("Examples:");
      console.log("  swarmhq completions bash >> ~/.bash_completion");
      console.log("  swarmhq completions zsh > ~/.zsh/completions/_swarmhq");
      console.log("  swarmhq completions fish > ~/.config/fish/completions/swarmhq.fish");
  }
}
