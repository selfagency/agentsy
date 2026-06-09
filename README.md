# Agentsy

Composable infrastructure for LLM and agentic systems.

Agentsy is a pnpm/turborepo monorepo of focused `@agentsy/*` packages for stream processing, provider integration, orchestration/runtime execution, state and memory systems, and integration surfaces.

[![Tests](https://github.com/selfagency/agentsy/actions/workflows/tests.yml/badge.svg)](https://github.com/selfagency/agentsy/actions/workflows/tests.yml) [![codecov](https://codecov.io/gh/selfagency/agentsy/graph/badge.svg?token=4U6b4yU5Ln)](https://codecov.io/gh/selfagency/agentsy) [![License: GPL-3.0-or-later](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

## Current repository state

This workspace currently contains 24 manifest-backed packages.

### Canonical architecture boundaries

- **Core stream/transformation primitives**: `@agentsy/core`, `@agentsy/types`
- **Provider adaptation + normalization boundary**: `@agentsy/providers`, `@agentsy/mcp`
- **Orchestration and execution**: `@agentsy/orchestrator`, `@agentsy/runtime`, `@agentsy/guardrails`
- **Durability and long-horizon state**: `@agentsy/session`, `@agentsy/memory`, `@agentsy/context`, `@agentsy/retrieval`
- **Surface and presentation**: `@agentsy/renderers`, `@agentsy/ui`, `@agentsy/vscode`, `@agentsy/cli`, `@agentsy/connectors`
- **Extensibility and harness contracts**: `@agentsy/plugins`

### Ownership highlights

- Framework-level **setup** and **doctor** UX belongs to `@agentsy/cli`.
- Helper or background agent roles belong to `@agentsy/orchestrator` and `@agentsy/runtime`.
- Host-specific integration complexity belongs to `@agentsy/plugins`, `@agentsy/vscode`, `@agentsy/mcp`, and `@agentsy/connectors`.
- `@agentsy/context` remains a library package for context shaping primitives rather than an operator-facing product shell.

> Important: `@agentsy/providers` is currently active and not merged away into `@agentsy/core`.

## Build and test

```bash
pnpm install
pnpm build
pnpm check-types
pnpm test
```

Optional:

```bash
pnpm test:coverage
pnpm lint
pnpm format
```

## Project documentation

- [Docs home](./docs/index.md)
- [Getting started](./docs/getting-started.md)
- [Package catalog](./docs/packages.md)
- [Architecture overview](./docs/architecture/index.md)
- [Roadmap](./docs/roadmap.md)
- [Developer docs](./docs/developers/index.md)
- [Dogfood implementation plan](./plan/DOGFOOD-PLAN.md)
- [Master implementation plan](./plan/MASTER-IMPLEMENTATION-PLAN.md)

## Dogfood implementation

The repository now follows `plan/DOGFOOD-PLAN.md` as the active production sequence for CLI-first delivery. Start there when implementing the next vertical slice.

## License

[MIT](LICENSE.md)
