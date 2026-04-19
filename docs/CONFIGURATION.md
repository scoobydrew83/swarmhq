# Configuration Guide

`swarm-cli` separates non-secret cluster configuration from local secrets.

## File Layout

- `~/.config/swarm-cli/config.json`
  Default non-secret cluster config used by both the CLI and `swarm-cli ui`.
- `~/.config/swarm-cli/.env`
  Default local secrets file for values such as `SWARM_CONFIG_FILE` and `SWARM_VRRP_PASSWORD`.
- `.env`
  If a repo-local `.env` already exists in the current working directory, the CLI will use it instead of the default env path.
- `examples/swarm.config.example.json`
  Safe example template you can copy and customize.

## What Goes In `.env`

Use the env file for anything you would not want committed to source control.

```bash
SWARM_CONFIG_FILE=/absolute/path/to/config.json
SWARM_VRRP_PASSWORD=replace-me
SWARM_TAILSCALE_AUTHKEY=
SWARM_UI_OPEN=true
```

Use `SWARM_CONFIG_FILE` when your config lives somewhere other than `~/.config/swarm-cli/config.json`.

Keep the VRRP password in the env file only. The config file stores the env var name to read, not the secret value itself.

## What Goes In `config.json`

Use `config.json` for cluster topology and non-secret defaults.

```json
{
  "version": 1,
  "clusterName": "example-swarm",
  "vip": "198.51.100.10",
  "nodes": [
    {
      "id": "manager-a",
      "host": "198.51.100.11",
      "username": "admin",
      "roles": ["manager"],
      "keepalived": {
        "priority": 120,
        "state": "MASTER"
      }
    }
  ],
  "keepalived": {
    "enabled": true,
    "interface": "eth0",
    "routerId": "SWARMCLI",
    "virtualRouterId": 51,
    "advertisementInterval": 1,
    "authPassEnv": "SWARM_VRRP_PASSWORD"
  },
  "ssh": {
    "port": 22,
    "strictHostKeyChecking": "accept-new"
  },
  "redaction": {
    "hideIps": false,
    "storeCommandHistory": false
  }
}
```

## Node Entries

Each entry in `nodes` describes one swarm host.

- `id`
  Human-friendly stable name used throughout the CLI and UI.
- `host`
  The node address or hostname the CLI should target.
- `username`
  SSH username for that node.
- `roles`
  One or more roles. At least one node must include `manager`.
- `labels`
  Optional Docker or scheduling labels for future automation.
- `keepalived`
  Optional per-node overrides for keepalived behavior.

Per-node `keepalived` overrides are best for node-specific priority and state values. Put cluster-wide defaults in the top-level `keepalived` block.

## Keepalived Settings

Use the top-level `keepalived` block for shared HA defaults.

- `enabled`
  Turn keepalived-based VIP failover on or off.
- `interface`
  Default network interface to advertise the VIP on.
- `routerId`
  Human-readable keepalived router identifier.
- `virtualRouterId`
  VRID shared by all keepalived participants. Must be between `1` and `255`.
- `advertisementInterval`
  VRRP advert interval in seconds.
- `authPassEnv`
  Name of the env var that stores the VRRP password. The value itself stays in `.env`.

Use per-node overrides under `nodes[].keepalived` when one node needs a different priority or explicit initial state.

- `priority`
  Higher values win VIP election.
- `state`
  Optional bootstrap state such as `MASTER` or `BACKUP`.
- `interface`
  Override the default network interface for one node.

## Save Locations

Recommended flow:

1. Create the default config directory with `mkdir -p ~/.config/swarm-cli`.
2. Copy `examples/swarm.config.example.json` to `~/.config/swarm-cli/config.json`.
3. Copy `.env.example` to `~/.config/swarm-cli/.env`.
   If you are intentionally using a repo-local `.env`, you can copy it there instead.
4. Fill in real node addresses and usernames in `config.json`.
5. Fill in `SWARM_VRRP_PASSWORD` in the env file.
6. Start the CLI or UI against that config.

If you want repo-local config while testing, use a local file such as `swarm.config.local.json` and point `SWARM_CONFIG_FILE` at it. That filename pattern is ignored by git.

## Built-In Builders

You can generate and save these files from either interface.

- CLI: `swarm-cli config wizard`
  Interactive prompt that writes both config and env files.
- CLI non-interactive: `swarm-cli config wizard --yes --config /path/to/config.json --env /path/to/.env`
  Useful for scripted bootstrap or tests.
- GUI: `swarm-cli ui`, then open `/setup`
  Dedicated builder UI for nodes, keepalived, and secret values.

## CLI And UI Behavior

The CLI and UI read the same resolved config path.

- `swarm-cli config show`
  Shows the active config path and values.
- `swarm-cli ui`
  Starts the localhost UI and uses the same config resolution rules.

If the UI looks different from the CLI, check `SWARM_CONFIG_FILE` first.

## Git Safety

These local secret-bearing files are ignored by default:

- `.env`
- `.env.*` except `.env.example`
- `.swarm-cli/`
- `swarm.config.json`
- `swarm.config.local.json`
- `*.secret.json`
- `*.secrets.json`

Safe templates such as `.env.example` and `examples/swarm.config.example.json` stay committed.
