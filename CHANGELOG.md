# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial public release scaffold
- Full monorepo structure: `@swarm-cli/core`, `swarm-cli`, `@swarm-cli/ui`
- 26 catalog commands across 5 groups: observability, configuration, operations, maintenance, security
- Localhost Next.js dashboard with command center, node roster, activity feed
- Interactive setup wizard (GUI + CLI)
- SSH-based cluster operations (health, leader, reboot, updates)
- Docker API integration (nodes, services, tasks)
- Keepalived VIP failover management
- Security redaction for sensitive config values
- Server-Sent Events streaming for real-time command output
- Session token auth for localhost UI server
