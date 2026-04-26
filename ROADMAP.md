# Roadmap

This document outlines the planned development trajectory for `swarmhq`. Items are grouped by phase.
Phases are indicative of priority, not strict release milestones.

## Current State (v0.3.x)

The initial release ships a functional Docker Swarm management tool with:

- **45+ dashboard command definitions plus CLI subcommands** across 5 categories: observability, configuration, operations, maintenance, security
- **Localhost dashboard** — Next.js UI with command center, node roster, activity feed, setup wizard
- **SSH-based cluster operations** — health checks, leader election, rolling reboots, OS/Docker updates
- **Docker API integration** — node/service/task listing, service inspection, stacks, secrets, configs, networks, labels, logs
- **Keepalived VIP management** — VIP holder detection and failover triggering
- **Security redaction** — config and env value masking for safe output sharing
- **Real-time streaming** — SSE-based live output in the dashboard

---

## Phase 1 — Foundation & Developer Experience

> Goal: Make the project production-ready for contributors and daily use.

- [x] **Shell completions** — bash/zsh/fish autocomplete for commands and flags
- [x] **`swarmhq version`** — print CLI version from package.json
- [x] **`swarmhq help <command>`** — per-command help with flag descriptions
- [x] **Test suite expansion** — unit tests for command-bridge, docker-runtime, config validation, catalog, redaction, errors, and UI asset resolution
- [x] **Error codes** — structured exit codes for scripting (0 success, 1 general error, 2 config error, 3 connectivity error)
- [x] **Config validation improvements** — better error messages when config is malformed or missing required fields
- [x] **`--dry-run` flag** — show what commands would be executed without running them (maintenance ops)

---

## Phase 2 — Swarm Resource Management

> Goal: Cover all core Docker Swarm primitives via CLI + dashboard.

- [x] **Stacks** — `swarmhq stack deploy`, `stack ls`, `stack ps`, `stack rm`, `stack services`
- [x] **Secrets** — `swarmhq secret create`, `secret ls`, `secret rm`, `secret inspect`
- [x] **Configs** — `swarmhq configs create`, `configs ls`, `configs rm`, `configs inspect`
- [x] **Networks** — `swarmhq network ls`, `network inspect`, `network create`, `network rm`
- [x] **Node label management** — `swarmhq nodes label add/rm`
- [x] **Logs streaming** — `swarmhq logs <service>` with `--follow`, `--since`, `--tail`; streamed in dashboard with stop control
- [x] **Dashboard command catalog additions** — expose stacks, secrets, configs, networks, node labels, and logs in UI sidebar

---

## Phase 3 — Operational Excellence

> Goal: Automate day-2 operations and improve reliability under real-world cluster conditions.

- [ ] **Rolling deployment** — `swarmhq deploy <stack-file>` with health-gate between node updates
- [ ] **Cluster backup** — snapshot config + compose files + swarm state to a tarball
- [ ] **Persistent audit log** — write command history to `~/.config/swarmhq/audit.log` (JSONL)
- [ ] **Notification webhooks** — emit events (leader change, node reboot, update) to Slack/webhook URLs configured in `.env`
- [ ] **SSH key rotation helper** — distribute updated authorized_keys to all nodes
- [ ] **Dashboard: dark/light theme polish** — respect OS preference on first load
- [ ] **Dashboard: node detail drawer** — click a node to see its services, resource usage, labels
- [ ] **Dashboard: log viewer** — dedicated log-viewing workspace beyond the Phase 2 command output stream

---

## Phase 4 — Advanced & Ecosystem

> Goal: Support more complex workflows and multi-cluster environments.

- [ ] **Multi-cluster profiles** — support multiple named clusters in config; `--cluster <name>` flag
- [ ] **Prometheus metrics export** — expose `/metrics` endpoint from the UI server
- [ ] **Container registry integration** — show image digests, detect registry auth issues
- [ ] **TUI mode** — alternative terminal-only dashboard (no browser required) using `blessed` or `ink`
- [ ] **Plugin system** — `~/.config/swarmhq/plugins/` directory for user-defined commands
- [ ] **`swarmhq init` interactive** — guided first-run wizard that detects existing Docker contexts and offers to import node topology
- [ ] **Windows/WSL2 support** — tested setup guide + CI matrix for Windows runners

---

## Maintenance Backlog

- Track Next.js App Router/static export changes as Next.js evolves
- Migrate cluster-runtime.ts (1,700 lines) into focused sub-modules
- Add integration test suite using a Docker-in-Docker test cluster
- API versioning for `/api/*` routes to allow dashboard/CLI version skew
