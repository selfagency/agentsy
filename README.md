# Agentsy

Composable infrastructure for LLM and agentic systems.

Agentsy is a pnpm/turborepo monorepo of focused `@agentsy/*` packages for stream processing, provider integration, orchestration/runtime execution, state/memory systems, and integration surfaces.

[![Tests](https://github.com/selfagency/agentsy/actions/workflows/tests.yml/badge.svg)](https://github.com/selfagency/agentsy/actions/workflows/tests.yml) [![codecov](https://codecov.io/gh/selfagency/agentsy/graph/badge.svg?token=4U6b4yU5Ln)](https://codecov.io/gh/selfagency/agentsy) [![License: GPL-3.0-or-later](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

## Current repository state

This workspace currently contains:

- **23 manifest-backed packages** (have `package.json` and build/test surfaces)
- **0 plan-only package domains** (all domains have been promoted)

### Manifest-backed packages

- `@agentsy/cli`
- `@agentsy/connectors`
- `@agentsy/core`
- `@agentsy/guardrails`
- `@agentsy/mcp`
- `@agentsy/memory`
- `@agentsy/observability`
- `@agentsy/orchestrator`
- `@agentsy/plugins`
- `@agentsy/prompts`
- `@agentsy/providers`
- `@agentsy/renderers`
- `@agentsy/retrieval`
- `@agentsy/runtime`
- `@agentsy/scripts` (private)
- `@agentsy/secrets`
- `@agentsy/session`
- `@agentsy/testing` (private)
- `@agentsy/tokens`
- `@agentsy/tools`
- `@agentsy/types`
- `@agentsy/ui`
- `@agentsy/vscode`

### Canonical architecture boundaries

- **Core stream/transformation primitives**: `@agentsy/core`
- **Provider adaptation + normalization boundary**: `@agentsy/providers`, `@agentsy/mcp`
- **Orchestration and execution**: `@agentsy/orchestrator`, `@agentsy/runtime`, `@agentsy/guardrails`
- **Durability and long-horizon state**: `@agentsy/session`, `@agentsy/memory`, `@agentsy/tokens`, `@agentsy/retrieval`
- **Surface and presentation**: `@agentsy/renderers`, `@agentsy/ui`, `@agentsy/vscode`, `@agentsy/cli`, `@agentsy/connectors`
- **Extensibility**: `@agentsy/plugins`

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
- [Master implementation plan](./plan/MASTER-IMPLEMENTATION-PLAN.md)

## License

[MIT](LICENSE.md)
