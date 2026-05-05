# Agentsy monorepo

Production-grade TypeScript packages for stream parsing, agent loops, headless Node.js workflows, and standards-aware integrations.

[![Tests](https://github.com/selfagency/agentsy/actions/workflows/tests.yml/badge.svg)](https://github.com/selfagency/agentsy/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

## What this repo is

This repository is a **pnpm workspace monorepo** managed by **Turborepo**. It contains the `@agentsy/*` package family.

Agentsy is designed as an **open stack for agentic tooling**:

- build workflows that run in Node.js-compatible runtimes without requiring a frontend
- compose parsing, processing, tool-use, and runtime layers independently
- align with open or emerging standards like **MCP**, **AG-UI**, and **skills-style interoperability** where they are useful
- avoid turning core developer infrastructure into a proprietary ecosystem maintained by one corporate platform

- **Published packages:** the current `@agentsy/*` package family under `packages/`
- **Private package:** `@agentsy/integration` (cross-package integration tests)

## Why Agentsy

Agentsy is a good fit when you want to build:

- headless automation and background agent workflows
- coding agents and editor-native tooling
- CLI and operator-style applications
- systems that may grow UI layers later, but should not depend on them at the start

The package family is intentionally split so you can adopt only the layers you need instead of swallowing an all-or-nothing framework.

## Already in production

This framework is already in use in three VS Code extensions that provide third-party model support inside **GitHub Copilot Chat**:

- [Opilot](https://marketplace.visualstudio.com/items?itemName=selfagency.opilot) — Ollama models in Copilot Chat with local-model workflows, tool calling, vision, and streaming
- [Z.ai for Copilot](https://marketplace.visualstudio.com/items?itemName=selfagency.z-models-vscode) — Z.ai coding models in Copilot Chat with streaming, tool calling, and MCP-assisted capabilities
- [Mistral for Copilot](https://marketplace.visualstudio.com/items?itemName=selfagency.mistral-models-vscode) — Mistral AI models in Copilot Chat with streaming, tool calling, and vision support

That existing usage matters because Agentsy is already supporting real editor-native integrations, not just hypothetical future app surfaces.

## Package map

### Published packages

- [`@agentsy/vscode`](./packages/vscode/README.md) — VS Code Language Model Chat Provider helpers, rendering, settings, and usage tracking.
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

### Build with the lower-level pipeline packages

```bash
npm install @agentsy/processor @agentsy/normalizers
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
- [Migrating from `@selfagency/llm-stream-parser`](./docs/migrating-from-llm-stream-parser.md)
- [API index](./docs/api.md)
- [Package inventory](./docs/packages.md)
- [Roadmap (planned)](./docs/roadmap.md)
- [Developer guide](./docs/developers/index.md)

## Current vs planned

This repo intentionally separates:

- **Implemented now:** package code under `packages/` and current docs in `docs/`
- **Planned/future:** architecture and roadmap plans in `plan/`

Planned items are documented as roadmap, not guaranteed availability.

```bash
# Test single package
cd packages/vscode && pnpm test
```

## License

[MIT](LICENSE.md)
