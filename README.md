# swarm-cli

Public npm-ready scaffold for a secure Docker Swarm CLI with a bundled local UI.

## Goals

- Publishable as `swarm-cli` on npm
- No private infrastructure or hardcoded secrets
- Typed core library shared by CLI and UI
- `swarm-cli ui` starts a localhost-only dashboard
- Next.js frontend can be exported and bundled into the CLI package

## Workspace Layout

```text
packages/
  core/   Shared config, redaction, and health models
  cli/    npm binary, localhost API server, UI launcher
  ui/     Next.js dashboard built as static assets
examples/
  swarm.config.example.json
docs/
  ARCHITECTURE.md
  CONFIGURATION.md
```

## Quick Start

```bash
cd ~/dev/swarm-cli
npm install
mkdir -p ~/.config/swarm-cli
cp .env.example ~/.config/swarm-cli/.env
cp examples/swarm.config.example.json ~/.config/swarm-cli/config.json
node packages/cli/dist/bin.js health --json
npm run ui
```

## Runtime Model

- Non-secret config lives at `~/.config/swarm-cli/config.json` by default.
- Secrets are read from `~/.config/swarm-cli/.env` by default, or from a repo-local `.env` if one already exists in the current working directory.
- The UI binds only to `127.0.0.1`.
- The UI API requires a random in-memory session token.

## Configuration

- Cluster topology, SSH defaults, and keepalived defaults belong in `config.json`.
- Secrets such as `SWARM_VRRP_PASSWORD` belong in the env file, not in `config.json`.
- Optional repo-local secret-bearing files such as `swarm.config.local.json` are gitignored.

See [docs/CONFIGURATION.md](/Users/dkennedy/dev/swarm-cli/docs/CONFIGURATION.md) for the full setup guide.

## Builders

- `node packages/cli/dist/bin.js config wizard`
  Runs an interactive CLI setup wizard.
- `node packages/cli/dist/bin.js config wizard --yes --config /path/to/config.json --env /path/to/.env`
  Seeds config and env files non-interactively.
- `npm run ui`
  Includes a dedicated `/setup` builder page for the same save flow in the GUI.
- `npm run ui:no-open`
  Starts the UI without auto-opening a browser.

## Useful Env Vars

```bash
SWARM_CONFIG_FILE=/absolute/path/to/config.json
SWARM_VRRP_PASSWORD=replace-me
SWARM_TAILSCALE_AUTHKEY=replace-me
SWARM_UI_OPEN=false
```

## Build Notes

- `@swarm-cli/ui` uses `next build` with static export output.
- `swarm-cli` copies exported UI assets into `packages/cli/ui-dist`.
- The CLI falls back to a built-in placeholder page if UI assets are missing.
