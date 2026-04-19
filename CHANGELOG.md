# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
