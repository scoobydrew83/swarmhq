# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.4] - 2026-04-19

### Fixed
- UI server failed to locate bundled assets after npm install — `getUiBuildDir()` resolved paths relative to the TypeScript source file depth rather than the compiled bundle depth (`dist/bin.js`), causing all path candidates to miss the `ui-dist/` directory in the installed package
- `copy-ui.mjs` now exits with code 1 (instead of 0) when the Next.js export directory is missing, so CI fails loudly rather than publishing a package without UI assets

### Added
- GitHub Actions workflow for automated Claude Code PR review

## [0.1.3] - 2026-04-19

### Fixed
- Completed CodeQL `js/stack-trace-exposure` remediation — the inner `catch (commandError)` block in the UI server still used `String(commandError)` as a fallback, which could expose internal details; replaced with a generic message
- Documentation verification CI workflow now uses `workflow_dispatch` via a dedicated dispatcher, since `claude-code-action` does not support `push` events

## [0.1.2] - 2026-04-19

### Fixed
- TypeScript 6 compatibility: added `"types": ["node"]` to `packages/cli` and `packages/core` tsconfigs — TypeScript 6 no longer implicitly includes Node.js globals under `NodeNext` resolution
- Removed potential stack trace exposure in HTTP error responses — non-`Error` exceptions no longer serialize internal details to API clients

### Changed
- Upgraded TypeScript from 5.9 to 6.0.3
- Upgraded React and React DOM from 18.3 to 19.2.5
- Upgraded Next.js from 15.5 to 16.2.4
- Upgraded vitest and @vitest/coverage-v8 from 2.1.9 to 4.1.4
- Upgraded @types/node from 22 to 25.6.0

## [0.1.1] - 2026-04-19

### Fixed
- README missing from npm package — added `README.md` to `packages/cli/`
- Corrected hero command from `npx swarmhq ui` to install + config wizard flow
- Fixed relative links in README (CONTRIBUTING, ROADMAP, LICENSE) to absolute GitHub URLs so they resolve correctly on the npm package page

## [0.1.0] - 2026-04-19

### Added
- Initial public release of `swarmhq` (renamed from `swarm-cli`)
- Full monorepo structure: `@swarmhq/core`, `swarmhq`, `@swarmhq/ui`
- 26 catalog commands across 5 groups: observability, configuration, operations, maintenance, security
- Localhost Next.js dashboard with command center, node roster, activity feed
- Interactive setup wizard (GUI + CLI)
- SSH-based cluster operations (health, leader, reboot, updates)
- Docker API integration (nodes, services, tasks)
- Keepalived VIP failover management
- Security redaction for sensitive config values
- Server-Sent Events streaming for real-time command output
- Session token auth for localhost UI server
- GitHub Actions CI/CD pipeline with OIDC trusted publishing to npm
- ESLint + Prettier configuration
- Vitest test foundation

### Security
- Sensitive fields stripped from unauthenticated API endpoints
- Command injection prevention via hostname and VRRP password validation
- 1 MB body size limit enforcement on UI server
- Tailscale auth key redaction added to redaction patterns
