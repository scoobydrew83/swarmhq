# Contributing to swarmhq

Thank you for your interest in contributing! This guide covers how to set up the project locally and submit changes.

## Prerequisites

- Node.js >= 20
- Docker with Swarm mode enabled (for integration testing)
- SSH access to at least one remote node (for cluster command testing)

## Local Setup

```bash
git clone https://github.com/scoobydrew83/swarmhq.git
cd swarmhq
npm install
npm run build
```

## Development Workflow

```bash
# Build all packages
npm run build

# Run tests
npm test

# Lint
npm run lint

# Type check
npm run typecheck

# Develop the UI (hot reload)
npm run dev:ui
```

## Project Structure

```
packages/
  core/      — Shared types, config I/O, command catalog
  cli/       — CLI binary, HTTP server, Docker/SSH runtimes
  ui/        — Next.js dashboard (bundled into CLI at build time)
```

## Submitting Changes

1. Fork the repository
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes with tests
4. Run `npm test && npm run lint && npm run typecheck`
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
6. Open a pull request against `main`

## Commit Message Format

```
feat: add stack deploy command
fix: resolve SSH auth fallback for root user
chore: update vitest to v2
docs: add ROADMAP phase 2 items
```

## Adding a New CLI Command

1. Add the command definition to `packages/core/src/catalog.ts`
2. Add command handler to `packages/cli/src/commands/<name>.ts`
3. Register handler in `packages/cli/src/bin.ts`
4. Add bridge mapping in `packages/cli/src/command-bridge.ts`
5. Add tests in `packages/core/src/__tests__/`

## Reporting Issues

Open an issue at https://github.com/scoobydrew83/swarmhq/issues
