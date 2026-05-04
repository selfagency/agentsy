# Agentsy monorepo

Production-grade TypeScript packages for stream parsing, agent loops, rendering, and VS Code integration.

[![npm @agentsy/vscode](https://img.shields.io/npm/v/@agentsy/vscode?label=%40agentsy%2Fvscode)](https://www.npmjs.com/package/@agentsy/vscode)
[![Tests](https://github.com/selfagency/agentsy/actions/workflows/tests.yml/badge.svg)](https://github.com/selfagency/agentsy/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

## What this repo is

This repository is a **pnpm workspace monorepo** managed by **Turborepo**. It contains the `@agentsy/*` package family.

- **Currently published:** `@agentsy/vscode`
- **Internal/pre-release packages:** stream parsing and agent-infra packages under `packages/`
- **Private package:** `@agentsy/integration` (cross-package integration tests)

## Package map

### Published package

- [`@agentsy/vscode`](./packages/vscode/README.md) — VS Code Language Model Chat Provider helpers, rendering, settings, and usage tracking.

### Internal / pre-release packages

- `@agentsy/adapters`
- `@agentsy/ag-ui`
- `@agentsy/agent`
- `@agentsy/context`
- `@agentsy/formatting`
- `@agentsy/normalizers`
- `@agentsy/processor`
- `@agentsy/recovery`
- `@agentsy/renderers`
- `@agentsy/sse`
- `@agentsy/structured`
- `@agentsy/thinking`
- `@agentsy/tool-calls`
- `@agentsy/types`
- `@agentsy/ui`
- `@agentsy/xml-filter`

### Private package

- `@agentsy/integration`

## Quick start

### Use the published VS Code package

```bash
npm install @agentsy/vscode vscode
```

### Work on the monorepo

```bash
pnpm install
pnpm build
pnpm check-types
pnpm test
pnpm lint
```

## Development commands

Run from repository root:

```bash
pnpm build
pnpm check-types
pnpm lint
pnpm lint:fix
pnpm format
pnpm test
pnpm test:coverage
pnpm precommit
```

## Documentation

- [Documentation home](./docs/index.md)
- [Getting started](./docs/getting-started.md)
- [API index](./docs/api.md)
- [Package inventory](./docs/packages.md)
- [Roadmap (planned)](./docs/roadmap.md)
- [Developer guide](./docs/developers/index.md)

## Current vs planned

This repo intentionally separates:

- **Implemented now:** package code under `packages/` and current docs in `docs/`
- **Planned/future:** architecture and roadmap plans in `plan/`

Planned items are documented as roadmap, not guaranteed availability.

## License

[MIT](LICENSE.md)
