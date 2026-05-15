# `@agentsy/memory`

Long-term memory and persistent state management.

## Purpose

`@agentsy/memory` provides storage adapters, retrieval interfaces, and memory lifecycle management for agents that need to persist information across sessions.

## Status

- Internal/pre-release workspace package.
- See the [roadmap](../roadmap.md) for planned capabilities.
- Current implementation now includes the full Phase 1 local-first foundation scope:
  - coordination: honker loader/fallback, pub-sub, queue, scheduler, atomic workflows
  - wiki pipeline: raw capture, synthesis lifecycle helpers, navigation, versioning, entity extraction, local embeddings
  - retrieval: hybrid ranker (semantic + lexical + temporal)
  - injection: XML `<memory_context>` formatting and deterministic context insertion
  - scope isolation: deny-by-default access policy for `session|user|project|team|global`
  - tool surface: `memory_capture`, `memory_search`, `memory_list`, `memory_stats`, `memory_lint`
  - observability: latency/retrieval/injection budget metrics
- Current implementation also includes the Phase 2 local-first sync scope:
  - Turso-backed sync manager and transport adapters via `@tursodatabase/sync`
  - conflict detection, conflict storage, and policy-based resolution
  - sync scheduler with retry/backoff behavior
  - backup manifest, restore, and rollback helpers
  - checksum/integrity validation and sync security redaction helpers
  - sync/backup/restore metrics registry
  - integration coverage for end-to-end sync workflows

## Notes

This package is currently in active development. API surface is subject to change.

## Verification

- `pnpm --filter @agentsy/memory check-types` passes
- `pnpm --filter @agentsy/memory test` passes
- completion evidence is tracked in:
  - `plan/PHASE-1-COMPLETION.md`
  - `plan/PHASE-2-COMPLETION.md`
