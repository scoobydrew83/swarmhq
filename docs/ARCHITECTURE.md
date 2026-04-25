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

1. `swarmhq ui` loads config and generates a session token.
2. The CLI starts a localhost HTTP server on a random free port.
3. Static UI assets are served from the package's bundled `ui-dist/` directory; local development can fall back to `packages/ui/out`.
4. Browser requests call constrained API routes such as `/api/session`, `/api/config`, and `/api/health`.
