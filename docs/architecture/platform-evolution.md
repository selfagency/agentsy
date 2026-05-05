# Platform evolution

This page connects the current implemented packages to the broader platform direction described in `plan/`.

## Current reality

Today, Agentsy already has working packages for:

- normalization
- stream processing
- focused parsing utilities
- renderer and state projections
- a basic agent loop
- a published VS Code integration

## Where the plans point next

Based on `plan/agentsy-prd.md`, `plan/agentsy-tech.md`, and `plan/agentsy-platform-v2.md`, the longer-term platform direction includes additional layers such as:

- runtime and session management
- memory and retrieval
- provider and MCP coordination
- telemetry, cost tracking, and orchestration support
- richer connector and application surfaces

Based on `plan/agentsy-features-v1.md`, the platform may also grow user-facing capability layers such as:

- skills
- slash commands
- caveman-mode style workflows
- superpowers-style productivity features

## Documentation boundary

These concepts belong in architecture and roadmap docs until package code exists. When a package is implemented, it graduates into:

1. `docs/packages/<name>.md`
2. `docs/api.md`
3. `packages/<name>/README.md`

## How to read roadmap language here

- If a package has a page under `docs/packages/`, there is current repo code.
- If a concept only appears in this page or [Roadmap](../roadmap.md), it is future-facing only.

## Recommended companion docs

- [Roadmap](../roadmap.md)
- [Package ecosystem](./package-ecosystem.md)
- [Package catalog](../packages.md)
