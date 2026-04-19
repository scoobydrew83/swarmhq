# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`swarmhq` is a TypeScript monorepo CLI tool for managing Docker Swarm clusters with an embedded, locally-hosted Next.js dashboard. It is published to npm as the `swarmhq` binary.

## Workspace Structure

Three npm workspace packages under `packages/`:

| Package | Directory | Role |
|---|---|---|
| `@swarmhq/core` | `packages/core/` | Shared types, config I/O, command catalog, redaction |
| `swarmhq` | `packages/cli/` | CLI binary, HTTP server, Docker runtime |
| `@swarmhq/ui` | `packages/ui/` | Next.js static dashboard (private, bundled into CLI) |

Dependency flow: `@swarmhq/ui` and `swarmhq` both depend on `@swarmhq/core`. The UI communicates with the CLI via `/api/*` routes served by `ui-server.ts`.

## Commands

```bash
# Build all packages in dependency order (core → cli → ui → bundle)
npm run build

# Typecheck all packages
npm run typecheck

# Run Next.js UI in dev mode
npm run dev:ui

# Build individual packages
npm run build -w @swarmhq/core
npm run build -w swarmhq
npm run build -w @swarmhq/ui

# Bundle Next.js output into CLI dist (run after ui build)
npm run bundle:ui -w swarmhq
```

No test or lint scripts are currently defined.

## Architecture Notes

### Core Package (`packages/core/src/`)
- `types.ts` — All shared TypeScript interfaces (`SwarmConfig`, `SwarmNode`, `KeepalivedConfig`, etc.)
- `config.ts` — `loadConfig`, `saveConfig`, `resolveConfigPath`; reads `~/.config/swarmhq/config.json`
- `catalog.ts` — `COMMAND_CATALOG`: typed definitions of every CLI command (schema, not arbitrary shell execution)
- `redact.ts` — Security redaction utilities
- `paths.ts` — File path resolution helpers

### CLI Package (`packages/cli/src/`)
- `bin.ts` — Entry point and command router (compiled to `dist/bin.js`, registered as npm bin)
- `command-runtime.ts` — Executes typed catalog commands
- `docker-runtime.ts` — Docker API integration
- `command-bridge.ts` — CLI↔UI API bridge
- `server/ui-server.ts` — HTTP server (localhost-only), session token generation, static UI serving
- `commands/` — One file per CLI command: `config`, `health`, `nodes`, `services`, `service`, `leader`, `ps`, `redact`, `ui`
- `scripts/copy-ui.mjs` — Post-build script that copies Next.js static export into CLI dist

### UI Package (`packages/ui/`)
- Next.js app with static export strategy
- `app/page.tsx` — Dashboard home
- `app/setup/page.tsx` — Interactive config wizard GUI
- `components/` — `command-center`, `node-roster`, `activity-feed`, `status-pill`, `stat-card`, `field-control`, `result-viewer`

## Runtime & Configuration

**Config file**: `~/.config/swarmhq/config.json` — cluster topology, Keepalived HA settings, SSH defaults, redaction policies.

**Secrets** (never in config.json): `~/.config/swarmhq/.env`
- `SWARM_VRRP_PASSWORD` — Keepalived auth
- `SWARM_TAILSCALE_AUTHKEY` — Optional automation
- `SWARM_CONFIG_FILE` — Override config location
- `SWARM_UI_OPEN` — Auto-open browser on `swarmhq ui`

The UI server binds localhost-only with a random session token per launch.

## TypeScript

All packages use strict TypeScript targeting ES2022/NodeNext (ESM). `tsconfig.base.json` at root is extended by each package. The UI package uses `esnext` modules with Next.js bundler resolution.
