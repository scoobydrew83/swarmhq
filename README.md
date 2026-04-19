# swarmhq

[![npm version](https://img.shields.io/npm/v/swarmhq.svg)](https://www.npmjs.com/package/swarmhq)
[![npm downloads](https://img.shields.io/npm/dm/swarmhq.svg)](https://www.npmjs.com/package/swarmhq)
[![CI](https://github.com/scoobydrew83/swarmhq/actions/workflows/ci.yml/badge.svg)](https://github.com/scoobydrew83/swarmhq/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Docker Swarm management CLI with an embedded, locally-hosted dashboard.

```bash
npx swarmhq ui
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

The dashboard opens in your browser at `http://127.0.0.1:<port>?token=<session-token>`.

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
swarmhq service --name <svc>       # Inspect a service
swarmhq service tasks --name <svc> # Show task placement
swarmhq leader                     # Leader status
swarmhq ps                         # Task placements per node
```

### Maintenance

```bash
swarmhq leader switch --target <node>  # Switch swarm leader
swarmhq reboot node --target <node>    # Safe drain → reboot → restore
swarmhq update check                   # Scan for OS/Docker updates
swarmhq update node --target <node>    # Apply updates to one node
swarmhq update all                     # Update all nodes
swarmhq update service --name <svc>    # Update service image
```

### Security

```bash
swarmhq redact --source config     # Preview config redaction
swarmhq redact --source env        # Preview env redaction
```

### Configuration

```bash
swarmhq config show                # Display current config
swarmhq config path                # Resolved config file path
swarmhq config init                # Create example config
swarmhq config wizard              # Interactive setup
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
    "virtualRouterId": 51
  },
  "ssh": { "port": 22, "hostKeyChecking": "accept-new" }
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
# Opens: http://127.0.0.1:PORT?token=SESSION_TOKEN

swarmhq ui --no-open   # Start server without opening browser
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
git clone https://github.com/scoobydrew83/swarmhq.git
cd swarmhq
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
