---
goal: Phase 1 Core Memory and Honker Coordination Implementation for @agentsy
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: agentsy-core
status: In progress
tags: [feature, memory, coordination, wiki, embeddings, phase1]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines exhaustive implementation work for Phase 1 in `plan/IMPLEMENTATION-PRIORITY.md`: complete the local-first memory foundation in `@agentsy/memory` with honker coordination, three-tier wiki flow (`raw -> wiki -> vector`), and production-safe retrieval/injection integration.

## 1. Requirements & Constraints

- **REQ-001**: Complete honker-backed coordination flows in `packages/memory/src/coordination/` for pub/sub, queue, scheduler, and atomic workflows.
- **REQ-002**: Complete three-tier wiki invariant implementation in `packages/memory/src/wiki/` where semantic retrieval indexes synthesized wiki pages, not raw session events.
- **REQ-003**: Implement content normalization and relationship extraction pipeline for markdown/text/code inputs.
- **REQ-004**: Implement wiki navigation and version history (links, refs, diffs, rollback metadata).
- **REQ-005**: Complete vector index layer and local embedding integration for semantic/hybrid search.
- **REQ-006**: Implement memory retrieval and runtime injection flow using existing XML context pipeline conventions.
- **REQ-007**: Implement memory scopes (`session|user|project|team|global`) with access checks.
- **REQ-008**: Implement memory tools for loop integration: `memory_search`, `memory_capture`, `memory_list`, `memory_stats`, `memory_lint`.
- **REQ-009**: Implement cache-aware context reuse with fingerprints and invalidation metadata for stable blocks.
- **REQ-010**: Implement observability counters/timers for coordination latency, retrieval quality, and injection budget impact.
- **REQ-011**: Ensure all public APIs are strictly typed and exported with ESM-compatible package boundaries.
- **SEC-001**: Treat memory payloads as untrusted input and sanitize before prompt injection.
- **SEC-002**: Prevent cross-scope reads/writes unless explicit policy grants access.
- **SEC-003**: Redact secret-like patterns in memory diagnostics and logs.
- **QOS-001**: Coordination latency target 1-5ms for local pub/sub and queue operations under benchmark fixtures.
- **QOS-002**: Retrieval/injection flow must remain within configured token budget and preserve deterministic ordering.
- **QOS-003**: Memory write/read consistency guarantees through atomic operations and rollback-safe updates.
- **CON-001**: Keep ownership boundaries aligned with `plan/MASTER-IMPLEMENTATION-PLAN.md` (memory in `@agentsy/memory`, protocol adapters in `@agentsy/providers`, runtime orchestration in `@agentsy/runtime`).
- **CON-002**: Avoid storing raw chat as primary reusable artifact; reuse synthesized wiki/context segments.
- **CON-003**: Keep local-first operation fully functional without Turso connectivity (Phase 2 additive).
- **GUD-001**: Follow focused module boundaries (coordination, wiki, retrieval, scope, synthesis, reuse, observability).
- **GUD-002**: Prefer deterministic transforms and stable IDs over heuristic probabilistic merge logic.
- **PAT-001**: Event-first -> synthesis -> semantic index pipeline.
- **PAT-002**: Local coordination (honker) + delayed persistence strategy.
- **PAT-003**: Cache-aware fingerprint + invalidation key model.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Finalize local coordination primitives and atomic safety guarantees.

| Task     | Description                                                                                                                            | Completed | Date       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-001 | Complete `packages/memory/src/coordination/honker/loader.ts` with extension detection, fallback mode, and structured status reporting. | ✅        | 2026-05-15 |
| TASK-002 | Complete `packages/memory/src/coordination/pub-sub-manager.ts` with topic registration, fanout delivery, and dead-letter handling.     | ✅        | 2026-05-15 |
| TASK-003 | Complete `packages/memory/src/coordination/task-queue.ts` with FIFO semantics, retries, visibility timeout, and idempotency keys.      | ✅        | 2026-05-15 |
| TASK-004 | Complete `packages/memory/src/coordination/scheduler.ts` for time-triggered jobs, pause/resume, and drift-safe scheduling.             | ✅        | 2026-05-15 |
| TASK-005 | Implement `packages/memory/src/coordination/atomic-workflows.ts` for multi-step transactional writes across raw/wiki/vector layers.    | ✅        | 2026-05-15 |
| TASK-006 | Add unit and microbenchmark tests for coordination latency/reliability under `packages/memory/src/coordination/*.test.ts`.             | ✅        | 2026-05-15 |

### Implementation Phase 2

- GOAL-002: Finalize three-tier wiki model and content processing pipeline.

| Task     | Description                                                                                                                                | Completed | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------- |
| TASK-007 | Complete `packages/memory/src/wiki/wiki-manager.ts` with canonical lifecycle for `raw -> wiki -> vector` promotion and backreferences.     | ✅        | 2026-05-15 |
| TASK-008 | Complete `packages/memory/src/wiki/content-processor.ts` for normalization, structured extraction, and code-snippet preservation.          | ✅        | 2026-05-15 |
| TASK-009 | Complete `packages/memory/src/wiki/version-tracker.ts` for revision history, diff generation, and rollback metadata.                       | ✅        | 2026-05-15 |
| TASK-010 | Complete `packages/memory/src/wiki/navigation-system.ts` for links, cross-page references, and graph traversal helpers.                    | ✅        | 2026-05-15 |
| TASK-011 | Implement entity/concept extraction module (`packages/memory/src/wiki/entity-extractor.ts`) with confidence labels and relationship edges. | ✅        | 2026-05-15 |
| TASK-012 | Add tests for normalization, navigation, versioning, and relationship graph quality in `packages/memory/src/wiki/*.test.ts`.               | ✅        | 2026-05-15 |

### Implementation Phase 3

- GOAL-003: Finalize retrieval/injection, scope isolation, and tool-facing APIs.

| Task     | Description                                                                                                                                                      | Completed | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-013 | Complete `packages/memory/src/retrieval/retriever.ts` with hybrid search (semantic + lexical + temporal weighting).                                              | ✅        | 2026-05-15 |
| TASK-014 | Complete `packages/memory/src/retrieval/injection.ts` to format `<memory_context>` blocks and integrate with XML dedupe/split contracts.                         | ✅        | 2026-05-15 |
| TASK-015 | Complete `packages/memory/src/scope/scope-manager.ts` with scope isolation checks and inheritance rules.                                                         | ✅        | 2026-05-15 |
| TASK-016 | Implement memory tool handlers in `packages/memory/src/tools/` (`memory-search.ts`, `memory-capture.ts`, `memory-list.ts`, `memory-stats.ts`, `memory-lint.ts`). | ✅        | 2026-05-15 |
| TASK-017 | Complete cache-aware reuse in `packages/memory/src/reuse.ts` with `ContextFingerprint`, reuse hints, and invalidation keys.                                      | ✅        | 2026-05-15 |
| TASK-018 | Add retrieval/tool integration tests under `packages/memory/src/retrieval/*.test.ts` and `packages/memory/src/tools/*.test.ts`.                                  | ✅        | 2026-05-15 |

### Implementation Phase 4

- GOAL-004: Finalize package integration, observability, documentation, and validation gates.

| Task     | Description                                                                                                                                     | Completed | Date       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-019 | Add observability metrics in `packages/memory/src/observability/metrics.ts` for latency, hit rate, reuse distance, and conflict counters.       | ✅        | 2026-05-15 |
| TASK-020 | Integrate with `@agentsy/session` resume flow for scoped episodic replay boundaries (`packages/session` + `packages/memory` integration tests). |           |            |
| TASK-021 | Integrate with `@agentsy/runtime` context assembly hooks so memory injection is budget-aware and deterministic.                                 |           |            |
| TASK-022 | Update docs: `packages/memory/README.md`, `docs/packages/memory.md`, and usage examples in `docs/examples/`.                                    | ✅        | 2026-05-15 |
| TASK-023 | Execute `pnpm --filter @agentsy/memory check-types && pnpm --filter @agentsy/memory test`.                                                      | ✅        | 2026-05-15 |
| TASK-024 | Execute `pnpm check-types && pnpm test`; record evidence and phase signoff in `plan/PHASE-1-COMPLETION.md`.                                     |           |            |

## 3. Alternatives

- **ALT-001**: Index raw events directly for semantic retrieval. Rejected because package plans require wiki-first synthesis as primary semantic source.
- **ALT-002**: Skip scope enforcement in MVP. Rejected due to cross-session/user isolation and policy requirements.
- **ALT-003**: Keep memory retrieval decoupled from runtime injection path. Rejected because prompt assembly contract requires integrated memory context formatting.
- **ALT-004**: Disable cache-aware reuse until later phases. Rejected because reuse accounting and invalidation are core Phase 1 architecture commitments.

## 4. Dependencies

- **DEP-001**: `@agentsy/memory` core modules (`coordination`, `wiki`, `retrieval`, `scope`, `synthesis`, `tools`).
- **DEP-002**: `@agentsy/runtime` context assembly interfaces for deterministic injection points.
- **DEP-003**: `@agentsy/session` persistence/resume semantics for episodic continuity.
- **DEP-004**: `@agentsy/context` budget interfaces for context sizing and injection budgets.
- **DEP-005**: `@agentsy/observability` metric/event conventions for instrumentation alignment.

## 5. Files

- **FILE-001**: `packages/memory/src/coordination/honker/loader.ts`
- **FILE-002**: `packages/memory/src/coordination/pub-sub-manager.ts`
- **FILE-003**: `packages/memory/src/coordination/task-queue.ts`
- **FILE-004**: `packages/memory/src/coordination/scheduler.ts`
- **FILE-005**: `packages/memory/src/coordination/atomic-workflows.ts`
- **FILE-006**: `packages/memory/src/wiki/wiki-manager.ts`
- **FILE-007**: `packages/memory/src/wiki/content-processor.ts`
- **FILE-008**: `packages/memory/src/wiki/version-tracker.ts`
- **FILE-009**: `packages/memory/src/wiki/navigation-system.ts`
- **FILE-010**: `packages/memory/src/wiki/entity-extractor.ts`
- **FILE-011**: `packages/memory/src/retrieval/retriever.ts`
- **FILE-012**: `packages/memory/src/retrieval/injection.ts`
- **FILE-013**: `packages/memory/src/scope/scope-manager.ts`
- **FILE-014**: `packages/memory/src/tools/memory-search.ts`
- **FILE-015**: `packages/memory/src/tools/memory-capture.ts`
- **FILE-016**: `packages/memory/src/tools/memory-list.ts`
- **FILE-017**: `packages/memory/src/tools/memory-stats.ts`
- **FILE-018**: `packages/memory/src/tools/memory-lint.ts`
- **FILE-019**: `packages/memory/src/reuse.ts`
- **FILE-020**: `packages/memory/src/observability/metrics.ts`
- **FILE-021**: `packages/memory/src/index.ts`
- **FILE-022**: `plan/PHASE-1-COMPLETION.md`

## 6. Testing

- **TEST-001**: Coordination primitives unit tests (pub/sub ordering, queue retries, scheduler drift).
- **TEST-002**: Coordination latency microbenchmarks with 1-5ms target verification.
- **TEST-003**: Three-tier wiki promotion tests verifying `raw -> wiki -> vector` consistency.
- **TEST-004**: Content normalization tests preserving markdown/code structure.
- **TEST-005**: Version/diff/rollback correctness tests for wiki revisions.
- **TEST-006**: Retrieval ranking tests (semantic + lexical + temporal hybrid).
- **TEST-007**: Injection sanitization tests against prompt-injection patterns and malformed XML payloads.
- **TEST-008**: Scope isolation tests preventing unauthorized cross-scope reads/writes.
- **TEST-009**: Tool API contract tests for memory tool handlers.
- **TEST-010**: Cache fingerprint reuse/invalidation tests with hit/miss accounting.
- **TEST-011**: Integration tests with `@agentsy/runtime` and `@agentsy/session` for resume-aware memory context injection.
- **TEST-012**: Package and monorepo gates: `pnpm --filter @agentsy/memory check-types`, `pnpm --filter @agentsy/memory test`, `pnpm check-types`, `pnpm test`.

## 7. Risks & Assumptions

- **RISK-001**: Retrieval quality may regress if synthesis quality is inconsistent; mitigate with fixture-driven relevance tests.
- **RISK-002**: Cross-package integration complexity (`memory`/`runtime`/`session`) may introduce ordering bugs; mitigate with contract tests.
- **RISK-003**: Scope policy misconfiguration could leak data; mitigate with deny-by-default access rules and lint checks.
- **RISK-004**: Aggressive cache reuse may return stale context; mitigate with explicit invalidation keys and model/template/tool-schema triggers.
- **ASSUMPTION-001**: Existing Phase 1 foundational code remains stable and compatible with additive module completion.
- **ASSUMPTION-002**: Local embedding provider support remains available for vector layer tests.
- **ASSUMPTION-003**: Runtime XML context pipeline (`splitLeadingXmlContext`/`dedupeXmlContext`) remains canonical for memory injection.

## 8. Related Specifications / Further Reading

- `plan/IMPLEMENTATION-PRIORITY.md`
- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `packages/memory/IMPLEMENTATION-PLAN.md`
- `packages/memory/MEMORY-ARCHITECTURE.md`
- `packages/memory/MEMORY-STRATEGY-SYNTHESIS.md`
- `packages/memory/UPDATED-IMPLEMENTATION-PLAN.md`
- `packages/session/IMPLEMENTATION-PLAN.md`
- `packages/runtime/IMPLEMENTATION-PLAN.md`
- `packages/context/IMPLEMENTATION-PLAN.md`
- `packages/observability/IMPLEMENTATION-PLAN.md`
