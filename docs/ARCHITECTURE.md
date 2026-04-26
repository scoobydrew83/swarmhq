# Architecture

## Packages

- `@swarmhq/core`: shared models and security-focused utilities
- `swarmhq`: the npm bin plus localhost API server
- `@swarmhq/ui`: a Next.js app exported as static assets

## Security Defaults

- no checked-in live config
- no checked-in secrets
- localhost-only UI binding
- random in-memory UI session token
- typed API routes instead of arbitrary shell execution
- shared redaction utility for CLI and UI output

## UI Flow

1. `swarmhq ui` loads config and generates a random session token.
2. The CLI starts a localhost HTTP server on a random free port and opens the browser with the token in a query parameter.
3. Static UI assets are served from the package's bundled `ui-dist/` directory; local development can fall back to `packages/ui/out`.
4. The dashboard retrieves the token from the URL, stores it in `sessionStorage`, and clears the URL.
5. Browser requests call constrained API routes such as `/api/config` and `/api/health`, authenticated by the token in the `x-swarm-session` header.

## Resource Management Flow

Phase 2 resource commands keep the same safety model as the original cluster commands:

1. CLI command files parse a fixed command surface such as `stack`, `secret`, `configs`, `network`, `nodes label`, and `logs`.
2. Local Docker context mode runs through `docker-runtime.ts` with structured argv arrays.
3. Default cluster mode resolves the current swarm leader from the configured SSH nodes and runs the matching Docker operation on that leader.
4. Dashboard commands are defined in the shared command catalog and translated by `command-bridge.ts` into the same CLI commands used from the terminal.
5. Write operations require explicit `--yes`/confirmation fields in both CLI and dashboard flows.
6. Secret and Docker config content can be provided by file path or stdin. Stdin content is passed to the child process but omitted from display commands and activity values.
7. `logs --follow` uses the existing streamed command output path, and the dashboard can abort the in-flight request to stop the child process.

`swarmhq config` remains reserved for swarmhq's own configuration. Docker Swarm configs are managed with the plural `swarmhq configs` command.
