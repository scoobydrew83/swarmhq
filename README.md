# swarmhq

[![npm version](https://img.shields.io/npm/v/swarmhq.svg)](https://www.npmjs.com/package/swarmhq)
[![npm downloads](https://img.shields.io/npm/dm/swarmhq.svg)](https://www.npmjs.com/package/swarmhq)
[![CI](https://github.com/scoobydrew83/swarmhq/actions/workflows/ci.yml/badge.svg)](https://github.com/scoobydrew83/swarmhq/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Docker Swarm management CLI with an embedded, locally-hosted dashboard.

```bash
npm install -g swarmhq
swarmhq config wizard
```

---

## Features

| Category | Capabilities |
|---|---|
| **Observability** | Health report with SSH reachability, leader detection, VIP sync |
| **Operations** | Nodes, services, stacks, networks, logs, task placement (`ps`), leader status |
| **Maintenance** | Leader failover, rolling reboots, OS/Docker updates, stack/network/node-label changes |
| **Security** | Config/env redaction preview, Docker secrets/configs, localhost-only UI with session tokens |
| **Configuration** | Interactive setup wizard (CLI + browser GUI), config init, show, path |
| **Dashboard** | Embedded Next.js UI — command center, node roster, live activity feed |

---

## Installation

```bash
npm install -g swarmhq
```

Requires Node.js >= 20.

---

## Quick Start

### 1. Initialize configuration

```bash
swarmhq config init --cluster-name my-cluster --vip 10.0.0.100
```

Or use the interactive wizard:

```bash
swarmhq config wizard
```

### 2. Check cluster health

```bash
swarmhq health
swarmhq health --detailed
```

### 3. Open the dashboard

```bash
swarmhq ui
```

The dashboard opens in your browser at `http://127.0.0.1:<port>` and retrieves its local session token automatically.

---

## Commands

### Observability

```bash
swarmhq health                     # Cluster health summary
swarmhq health --detailed          # Full health report
swarmhq health --json              # Machine-readable output
```

### Operations

```bash
swarmhq nodes                      # List swarm nodes
swarmhq services                   # List services
swarmhq service inspect --name <svc> # Inspect a service
swarmhq service tasks --name <svc> # Show task placement
swarmhq leader                     # Leader status
swarmhq ps                         # Task placements per node
swarmhq stack ls                   # List stacks
swarmhq stack ps --name <stack>    # List stack tasks
swarmhq stack services --name <stack> # List stack services
swarmhq network ls                 # List Docker networks
swarmhq network inspect --name <net> # Inspect a network
swarmhq logs <svc> --tail 100      # Read service logs
swarmhq logs <svc> --follow        # Stream service logs
```

### Maintenance

```bash
swarmhq leader switch --target <node>           # Switch swarm leader
swarmhq leader switch --target <node> --dry-run # Preview plan without executing
swarmhq reboot node --target <node>             # Safe drain → reboot → restore
swarmhq reboot node --target <node> --dry-run   # Preview reboot plan
swarmhq update check                            # Scan for OS/Docker updates
swarmhq update node --target <node>             # Apply updates to one node
swarmhq update node --target <node> --dry-run   # Preview update plan
swarmhq update all                              # Update all nodes
swarmhq update all --dry-run                    # Preview full update plan
swarmhq update service --name <svc>             # Update service image
swarmhq stack deploy --file <path> --name <stack> --yes # Deploy a stack
swarmhq stack rm --name <stack> --yes           # Remove a stack
swarmhq network create --name <net> --yes       # Create an overlay network
swarmhq network rm --name <net> --yes           # Remove a network
swarmhq nodes label add --target <node> --key <key> --value <value> --yes
swarmhq nodes label rm --target <node> --key <key> --yes
```

### Security

```bash
swarmhq redact --source config     # Preview config redaction
swarmhq redact --source env        # Preview env redaction
swarmhq secret create --name <name> --file <path> --yes
swarmhq secret create --name <name> --stdin --yes
swarmhq secret ls                  # List Docker secrets
swarmhq secret inspect --name <name>
swarmhq secret rm --name <name> --yes
swarmhq configs create --name <name> --file <path> --yes
swarmhq configs create --name <name> --stdin --yes
swarmhq configs ls                 # List Docker configs
swarmhq configs inspect --name <name>
swarmhq configs rm --name <name> --yes
```

`swarmhq config` is reserved for swarmhq's own configuration. Docker Swarm configs use the plural `swarmhq configs` command.

### Configuration

```bash
swarmhq config show                # Display current config
swarmhq config path                # Resolved config file path
swarmhq config init                # Create example config
swarmhq config wizard              # Interactive setup
```

### General

```bash
swarmhq version                    # Print current version
swarmhq upgrade                    # Self-update to the latest version via npm
swarmhq help <command>             # Show flags, subcommands, and examples
swarmhq completions bash           # Generate bash completion script
swarmhq completions zsh            # Generate zsh completion script
swarmhq completions fish           # Generate fish completion script
```

---

## Configuration

**Config file**: `~/.config/swarmhq/config.json`

```json
{
  "version": 1,
  "clusterName": "my-cluster",
  "vip": "10.0.0.100",
  "nodes": [
    { "id": "node-1", "host": "10.0.0.11", "username": "admin", "roles": ["manager"] },
    { "id": "node-2", "host": "10.0.0.12", "username": "admin", "roles": ["manager"] },
    { "id": "node-3", "host": "10.0.0.13", "username": "admin", "roles": ["worker"] }
  ],
  "keepalived": {
    "enabled": true,
    "interface": "eth0",
    "routerId": "SWARMHQ",
    "advertisementInterval": 1,
    "virtualRouterId": 51
  },
  "ssh": { "port": 22, "strictHostKeyChecking": "accept-new" }
}
```

**Secrets file**: `~/.config/swarmhq/.env`

```bash
SWARM_VRRP_PASSWORD=your-keepalived-password
SWARM_TAILSCALE_AUTHKEY=optional
```

Secrets are **never** stored in `config.json`.

### Environment Variables

| Variable | Purpose |
|---|---|
| `SWARM_CONFIG_FILE` | Override config file location |
| `SWARM_VRRP_PASSWORD` | Keepalived VRRP authentication password |
| `SWARM_TAILSCALE_AUTHKEY` | Optional Tailscale automation key |
| `SWARM_UI_OPEN` | Set to `false` to skip auto-opening browser on `swarmhq ui` |

---

## Dashboard

```bash
swarmhq ui
# Opens: http://127.0.0.1:PORT

swarmhq ui --no-open   # Start server without opening browser
```

The dashboard provides:
- Real-time command output via SSE streaming
- Node roster with availability and manager status
- Activity feed with full command history
- Interactive setup wizard at `/setup`
- Command parity for stacks, secrets, Docker configs, networks, node labels, and service logs

The UI server binds to `127.0.0.1` only. The browser UI retrieves a per-session token locally and sends it with every API request.

---

## Development

See [CONTRIBUTING.md](https://github.com/scoobydrew83/swarmhq/blob/main/CONTRIBUTING.md) for the full setup guide.

```bash
git clone https://github.com/scoobydrew83/swarmhq.git
cd swarmhq
npm install
npm run build
npm test
```

---

## Roadmap

See [ROADMAP.md](https://github.com/scoobydrew83/swarmhq/blob/main/ROADMAP.md) for planned features across four phases: Foundation, Swarm Resource Management, Operational Excellence, and Advanced/Ecosystem.

---

## License

[MIT](https://github.com/scoobydrew83/swarmhq/blob/main/LICENSE) © Hallows Group LLC
