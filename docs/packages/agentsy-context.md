# `@agentsy/context`

- **Status:** Published
- **Role:** Context shaping primitives for compression, drift/coherence, manual compaction, rewind markers, and hydration helpers

## Where it fits

Use `@agentsy/context` when you need host-agnostic context shaping behavior inside runtimes, orchestration layers, or applications.

## Current surface

- Conversation compression
- Output compression and detailed compression metadata
- Drift scoring, anchor finding, and drift monitoring
- Manual compaction summaries
- Rewind-store retrieval markers
- Context observability helpers directly tied to compression operations

## Boundary rules

`@agentsy/context` does **not** own:

- setup or doctor UX
- helper/background agent orchestration
- host or editor integration contracts
- broad compatibility matrices
- heavyweight end-user operator runbooks

Those concerns belong to `@agentsy/cli`, `@agentsy/orchestrator`, `@agentsy/runtime`, and the host-facing integration packages.
