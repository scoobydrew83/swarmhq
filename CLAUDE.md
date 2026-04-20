# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`swarmhq` is a TypeScript monorepo CLI tool for managing Docker Swarm clusters with an embedded, locally-hosted Next.js dashboard. It is published to npm as the `swarmhq` binary.

## Workspace Structure

Three npm workspace packages under `packages/`:

| Package | Directory | Role |
|---|---|---|
| `@swarmhq/core` | `packages/core/` | Shared types, config I/O, command catalog, redaction |
| `swarmhq` | `packages/cli/` | CLI binary, HTTP server, Docker/SSH runtime |
| `@swarmhq/ui` | `packages/ui/` | Next.js static dashboard (private, bundled into CLI) |

Dependency flow: `@swarmhq/ui` and `swarmhq` both depend on `@swarmhq/core`. The UI communicates with the CLI via `/api/*` routes served by `ui-server.ts`.

## Commands

```bash
# Build all packages in dependency order (core → cli → ui → bundle)
npm run build

# Typecheck all packages
npm run typecheck

# Run tests with Vitest
npm run test
npm run test:coverage

# Lint and format
npm run lint
npm run lint:fix
npm run format

# Run Next.js UI in dev mode
npm run dev:ui

# Build individual packages
npm run build -w @swarmhq/core
npm run build -w swarmhq
npm run build -w @swarmhq/ui

# Bundle Next.js output into CLI dist (run after ui build)
npm run bundle:ui -w swarmhq

# Full build + launch dashboard (used for local testing)
npm run ui
npm run ui:no-open   # skip browser auto-open
```

## Architecture Notes

### Core Package (`packages/core/src/`)

- `types.ts` — All shared TypeScript interfaces:
  - `SwarmNode`: id, host, username, roles (`NodeRole[]`), optional keepalived overrides, labels
  - `SwarmConfig`: version 1, clusterName, vip, nodes[], keepalived settings, ssh config, redaction config
  - `RuntimeSecrets`: vrrpPassword, tailscaleAuthKey (env-only, never in config.json)
  - `CommandCatalog`, `CommandDefinition`, `CommandExecutionRequest`, `CommandExecutionResult`
  - `ActivityEntry`: command history with status (pending/success/error)
- `config.ts` — `loadConfig`, `saveConfig`, `resolveConfigPath`; reads `~/.config/swarmhq/config.json`. Also: `loadRuntimeSecrets`, `createConfigBuilderDefaults`, `saveConfigBuilderInput`, `buildHealthSnapshot`
- `catalog.ts` — `COMMAND_CATALOG`: typed definitions of every CLI command organized in 5 groups (Observability, Configuration, Operations, Maintenance, Security). Schema-driven — not arbitrary shell execution. ~839 lines covering 30+ commands
- `redact.ts` — Masks Tailscale keys (`tskey-*`), VRRP passwords, and optionally IPv4 addresses
- `paths.ts` — `getConfigDir()` using XDG_CONFIG_HOME or `~/.config/swarmhq`

### CLI Package (`packages/cli/src/`)

- `bin.ts` — Entry point and command router; dispatches to command files; compiled to `dist/bin.js` as npm bin
- `command-runtime.ts` — Executes in-process commands: health.report, config.show/path/init, redaction-preview
- `docker-runtime.ts` — Docker CLI wrappers: `listNodes`, `listServices`, `inspectService`, `listServiceTasks`, `getLeaderStatus`, `listTasks`; all support optional `--context` and JSON output
- `cluster-runtime.ts` — SSH-based cluster operations (~1739 lines, the primary execution engine):
  - `buildRemoteHealthReport()`: TCP connectivity, SSH, swarm leader, service/node status, Keepalived VIP detection
  - `switchClusterLeader()`: Moves VIP + swarm leadership between nodes
  - `rebootClusterNode()`: Drain → reboot → restore with wait conditions
  - `checkClusterNodeUpdates()` / `scanServiceImageUpdates()` / `scanContainerImageUpdates()`
  - `updateClusterNode()` / `updateAllClusterNodes()` / `updateServiceImage()` / `updateContainerImage()`
  - `updateKeepalivedForTarget()`: Writes keepalived.conf via SSH
- `command-bridge.ts` — Converts UI `CommandExecutionRequest` into CLI subprocess invocations; `runCliRequest()` streams stdout/stderr to activity log in real time (~353 lines)
- `server/ui-server.ts` — HTTP server (~485 lines):
  - Binds to `127.0.0.1:0` (random free port, localhost-only)
  - Random UUID session token per launch
  - API endpoints: `/api/session`, `/api/meta`, `/api/config`, `/api/health`, `/api/activity`, `/api/events` (SSE), `/api/setup/defaults`, `/api/setup/save`, `/api/commands/execute`
  - Serves static Next.js export from `ui-dist/` with SPA fallback
- `commands/` — One file per CLI command: `config` (interactive wizard), `health`, `nodes`, `services`, `service`, `leader`, `ps`, `redact`, `reboot`, `update`, `ui`
- `scripts/copy-ui.mjs` — Post-build script that copies Next.js static export into CLI `ui-dist/`

**Build tool**: CLI uses `tsup` (not plain `tsc`). It bundles `@swarmhq/core` inline (`noExternal`) and adds the `#!/usr/bin/env node` shebang.

### UI Package (`packages/ui/`)

- Next.js app with static export strategy (`output: 'export'`)
- `app/layout.tsx` — Dark theme default, Geist Mono + Space Grotesk fonts, Material Symbols icons
- `app/page.tsx` — Main dashboard (~447 lines):
  - Loads session token, command catalog, config, health, activity on mount
  - Real-time activity stream via `/api/events` (SSE with reconnection)
  - Three-pane layout: command group tabs → command form → node roster / result viewer / activity feed
- `app/setup/page.tsx` — Config wizard (~579 lines):
  - Steps: save paths → cluster settings → Keepalived → secrets → node inventory → save
  - POSTs to `/api/setup/save`
- `components/` — `activity-feed`, `command-center`, `field-control`, `node-roster`, `output-modal`, `panel`, `result-viewer`, `stat-card`, `status-pill`, `theme-toggle`

## Runtime & Configuration

**Config file**: `~/.config/swarmhq/config.json` — cluster topology, Keepalived HA settings, SSH defaults, redaction policies. Overridable via `--config <path>` flag or `SWARM_CONFIG_FILE` env var.

**Secrets** (never in config.json): `~/.config/swarmhq/.env`
- `SWARM_VRRP_PASSWORD` — Keepalived auth
- `SWARM_TAILSCALE_AUTHKEY` — Optional Tailscale automation
- `SWARM_CONFIG_FILE` — Override config location
- `SWARM_UI_OPEN` — Auto-open browser on `swarmhq ui` (default: true)

The UI server binds localhost-only with a random session token per launch. Validation requires at least one manager node in config.

## TypeScript

All packages use strict TypeScript targeting ES2022/NodeNext (ESM). `tsconfig.base.json` at root is extended by each package. The UI package uses `esnext` modules with Next.js bundler resolution.

## Publishing

The CLI (`swarmhq` package) publishes to npm. `prepublishOnly` runs: typecheck core + CLI, bundle UI into `ui-dist/`, then pack. The `ui-dist/` directory is included in published files alongside `dist/`.

## Key Conventions

- **No arbitrary shell execution**: All cluster commands go through `COMMAND_CATALOG` definitions and typed `CommandExecutionRequest` objects. `cluster-runtime.ts` builds SSH commands from structured inputs, not raw user strings.
- **Secrets isolation**: `SwarmConfig` (JSON) never holds passwords or auth keys. Secrets load from `.env` file or environment at runtime via `loadRuntimeSecrets()`.
- **SSH fallback**: `cluster-runtime.ts` tries the configured username first, then falls back to `root` for SSH connections.
- **Activity log**: Capped at 30 entries. Commands from the UI route through `command-bridge.ts` → CLI subprocess, streaming output to the SSE activity feed.
- **localhost-only UI**: The server never binds to `0.0.0.0`. Session tokens prevent CSRF from other local processes.
