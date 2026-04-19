# swarm-cli

[![npm version](https://img.shields.io/npm/v/swarm-cli.svg)](https://www.npmjs.com/package/swarm-cli)
[![npm downloads](https://img.shields.io/npm/dm/swarm-cli.svg)](https://www.npmjs.com/package/swarm-cli)
[![CI](https://github.com/scoobydrew83/swarm-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/scoobydrew83/swarm-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Docker Swarm management CLI with an embedded, locally-hosted dashboard.

```bash
npx swarm-cli ui
```

---

## Features

| Category | Capabilities |
|---|---|
| **Observability** | Health report with SSH reachability, leader detection, VIP sync |
| **Operations** | Nodes, services, service tasks, task placement (`ps`), leader status |
| **Maintenance** | Leader failover, rolling reboots, OS/Docker updates, service image updates |
| **Security** | Config/env redaction preview, localhost-only UI with session tokens |
| **Configuration** | Interactive setup wizard (CLI + browser GUI), config init, show, path |
| **Dashboard** | Embedded Next.js UI — command center, node roster, live activity feed |

---

## Installation

```bash
npm install -g swarm-cli
```

Requires Node.js >= 20.

---

## Quick Start

### 1. Initialize configuration

```bash
swarm-cli config init --cluster-name my-cluster --vip 10.0.0.100
```

Or use the interactive wizard:

```bash
swarm-cli config wizard
```

### 2. Check cluster health

```bash
swarm-cli health
swarm-cli health --detailed
```

### 3. Open the dashboard

```bash
swarm-cli ui
```

The dashboard opens in your browser at `http://127.0.0.1:<port>?token=<session-token>`.

---

## Commands

### Observability

```bash
swarm-cli health                     # Cluster health summary
swarm-cli health --detailed          # Full health report
swarm-cli health --json              # Machine-readable output
```

### Operations

```bash
swarm-cli nodes                      # List swarm nodes
swarm-cli services                   # List services
swarm-cli service --name <svc>       # Inspect a service
swarm-cli service tasks --name <svc> # Show task placement
swarm-cli leader                     # Leader status
swarm-cli ps                         # Task placements per node
```

### Maintenance

```bash
swarm-cli leader switch --target <node>  # Switch swarm leader
swarm-cli reboot node --target <node>    # Safe drain → reboot → restore
swarm-cli update check                   # Scan for OS/Docker updates
swarm-cli update node --target <node>    # Apply updates to one node
swarm-cli update all                     # Update all nodes
swarm-cli update service --name <svc>    # Update service image
```

### Security

```bash
swarm-cli redact --source config     # Preview config redaction
swarm-cli redact --source env        # Preview env redaction
```

### Configuration

```bash
swarm-cli config show                # Display current config
swarm-cli config path                # Resolved config file path
swarm-cli config init                # Create example config
swarm-cli config wizard              # Interactive setup
```

---

## Configuration

**Config file**: `~/.config/swarm-cli/config.json`

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
    "virtualRouterId": 51
  },
  "ssh": { "port": 22, "hostKeyChecking": "accept-new" }
}
```

**Secrets file**: `~/.config/swarm-cli/.env`

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
| `SWARM_UI_OPEN` | Set to `false` to skip auto-opening browser on `swarm-cli ui` |

---

## Dashboard

```bash
swarm-cli ui
# Opens: http://127.0.0.1:PORT?token=SESSION_TOKEN

swarm-cli ui --no-open   # Start server without opening browser
```

The dashboard provides:
- Real-time command output via SSE streaming
- Node roster with availability and manager status
- Activity feed with full command history
- Interactive setup wizard at `/setup`

The UI server binds to `127.0.0.1` only and requires a per-session token for every request.

---

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full setup guide.

```bash
git clone https://github.com/scoobydrew83/swarm-cli.git
cd swarm-cli
npm install
npm run build
npm test
```

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features across four phases: Foundation, Swarm Resource Management, Operational Excellence, and Advanced/Ecosystem.

---

## License

[MIT](LICENSE) © Hallows Group LLC
