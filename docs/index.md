# Agentsy documentation

Agentsy is a composable TypeScript ecosystem for building production-grade LLM features: provider normalization, stream parsing, structured output handling, tool-call accumulation, renderer surfaces, agent loops, and VS Code integrations.

This site documents two things at once:

- **What exists today** in `packages/*`
- **Where the platform is heading** based on the design work in `plan/`

Every page calls out implementation status so the current package surface stays distinct from roadmap material.

## Start here

### If you are evaluating Agentsy

- Read [Why Agentsy](./why-agentsy.md)
- Skim the [Architecture overview](./architecture/index.md)
- Browse the [Package catalog](./packages.md)

### If you are adopting the current packages

- Follow [Getting started](./getting-started.md)
- Use the [API index](./api.md)
- If you came from the old monolith, use [Migrating from `@selfagency/llm-stream-parser`](./migrating-from-llm-stream-parser.md)

### If you are contributing to the monorepo

- Open the [Developer guide](./developers/index.md)
- Review the [Roadmap](./roadmap.md)
- Cross-check future-facing work against the `plan/` documents referenced throughout the architecture pages

## Package status model

Agentsy documentation uses four labels consistently:

| Status        | Meaning                                                   |
| ------------- | --------------------------------------------------------- |
| **Published** | Public package with an installable npm release today      |
| **Private**   | Repo-internal package used for verification or tooling    |
| **Planned**   | Described in `plan/`, not yet implemented as package code |

## Ecosystem at a glance

### Foundation and parsing layers

- `@agentsy/normalizers` converts provider responses into a shared event vocabulary.
- `@agentsy/processor` orchestrates incremental processing and pipeline transforms.
- `@agentsy/thinking`, `@agentsy/tool-calls`, `@agentsy/structured`, `@agentsy/xml-filter`, `@agentsy/context`, `@agentsy/recovery`, `@agentsy/formatting`, `@agentsy/sse`, and `@agentsy/types` support focused parsing and recovery concerns.

### Runtime and UI layers

- `@agentsy/agent` builds multi-step loops on top of processed events.
- `@agentsy/ui` and `@agentsy/ag-ui` turn event streams into state models and protocol bridges.
- `@agentsy/renderers` provides human-facing rendering surfaces.
- `@agentsy/adapters` helps package the pipeline for integration-specific entry points.

### Product-facing integration layer

- `@agentsy/vscode` is the current flagship published package for VS Code chat-provider integrations.

## Recommended reading path

1. [Why Agentsy](./why-agentsy.md)
2. [Architecture overview](./architecture/index.md)
3. [Stream processing flow](./architecture/stream-processing.md)
4. [Package catalog](./packages.md)
5. [API index](./api.md)

## Planning sources

The platform narrative on this site is grounded in these planning documents:

- `plan/agentsy-prd.md`
- `plan/agentsy-tech.md`
- `plan/agentsy-platform-v2.md`
- `plan/agentsy-features-v1.md`

Those documents inform future-facing pages, but they are not treated as evidence that a package or API already ships.
