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

## ADR research snapshot (migrated from `plan/agentsy-prd-notes.md`)

Key architecture evidence themes retained from the research corpus:

- Factory-first public APIs (`create*`) with classes as internal implementation details.
- Composable stop-condition predicates for loop control.
- Per-message stream state maps for robust concurrent/incremental processing.
- Lazy assistant message creation to avoid empty/flicker artifacts.
- Structured approval-pause/resume flow (not exception-driven approvals).
- Two-stage memory lifecycle (fast consolidation + slower synthesis).
- Warning-first safety guardrails before hard-stop escalation where appropriate.
- Atomic persistence + startup repair for crash resilience.

These themes remain guidance constraints, with package-local implementation details tracked in each `packages/*/IMPLEMENTATION-PLAN.md`.

## Reconciliation snapshot (migrated from `plan/RECONCILIATION-REPORT.md`)

- Canonical decisions were largely aligned, with historical contradictions concentrated in stale destination/status fields.
- Key preserved correction rule: scheduler destination is orchestrator-owned; retry destination is core-owned.
- Mapping/status tables are historical artifacts and should not override package-local implementation plans.

## Research coverage snapshot (migrated from `plan/rearchelogy-RESEARCH-STATUS.md`)

Research synthesis covered major categories:

- Agent platforms
- AI app platforms
- CLI tooling
- IDE/editor workflows
- Infrastructure/orchestration patterns

These findings are now treated as provenance context for architecture choices, with active implementation tracked in package-level plans and docs.

## Revised architecture snapshots (migrated from `plan/REVISED-ARCHITECTURE.md` and `plan/revised-implementation-architecture.md`)

- Consolidation direction: reduce fragmentation while preserving explicit boundaries.
- Layering direction: foundation/core → runtime/orchestration → providers/tooling → integrations/presentation.
- Keep interop concerns split (local orchestration, editor/client protocol, remote agent protocol), not merged into one abstraction.
- Connectors remain dedicated third-party communication adapters, not generic tool implementations.

## Recommended companion docs

- [Roadmap](../roadmap.md)
- [Package ecosystem](./package-ecosystem.md)
- [Package catalog](../packages.md)
