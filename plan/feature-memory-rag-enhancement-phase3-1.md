---
goal: Phase 3 RAG Enhancement Implementation for @agentsy Memory and Retrieval
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: agentsy-core
status: Planned
tags: [feature, memory, retrieval, rag, mcp, indexing, phase3]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan defines exhaustive implementation work for Phase 3 in `plan/IMPLEMENTATION-PRIORITY.md`: RAG enhancement through `mcp-rag-server` integration, knowledge base lifecycle management, document/web ingestion, hybrid ranking, and production retrieval quality controls.

## 1. Requirements & Constraints

- **REQ-001**: Implement RAG integration modules in `packages/memory/src/retrieval/rag/` for server client, knowledge base manager, ingestion pipeline, and search interfaces.
- **REQ-002**: Implement retrieval path that prioritizes local synthesized wiki pages and augments with indexed external documents.
- **REQ-003**: Implement startup auto-ingest pipeline for configured sources (docs directories, project markdown, selected artifacts).
- **REQ-004**: Implement manual and scheduled document ingestion/update/remove operations with deterministic IDs and versioning.
- **REQ-005**: Implement web-search augmentation behind explicit configuration gates with source attribution and citation metadata.
- **REQ-006**: Implement hybrid retrieval and ranking (`vector + lexical + entity + temporal`) with configurable weighting.
- **REQ-007**: Implement re-ranking and context packing logic constrained by token budgets from `@agentsy/tokens`.
- **REQ-008**: Implement retrieval evidence classes with confidence and provenance metadata for downstream injection.
- **REQ-009**: Implement observability for recall quality, latency, source mix, and citation coverage.
- **REQ-010**: Implement failure-tolerant fallback path (local-only retrieval when remote/web sources fail).
- **REQ-011**: Ensure strict public APIs and typed contracts for `@agentsy/memory` retrieval exports.
- **SEC-001**: Default to local-only processing; remote/web retrieval must be opt-in.
- **SEC-002**: Enforce source allowlists and sanitize fetched content before indexing/injection.
- **SEC-003**: Redact secrets/credentials in ingested payloads and retrieval logs.
- **QOS-001**: P95 retrieval latency target < 250ms for local indexed queries on fixture corpus.
- **QOS-002**: Citation coverage target >= 90% for top-k retrieved evidence in benchmark tasks.
- **QOS-003**: Hybrid ranking should improve benchmark relevance over vector-only baseline.
- **CON-001**: Keep canonical ownership boundaries (`@agentsy/memory` retrieval logic, `@agentsy/providers` protocol adapters, `@agentsy/runtime` orchestration hooks).
- **CON-002**: Maintain wiki invariant from memory package plans: semantic index should be built from synthesized pages, not raw chat/event dumps.
- **CON-003**: Avoid hard dependency on cloud services for baseline functionality.
- **GUD-001**: Prefer idempotent ingestion operations and resumable indexing jobs.
- **GUD-002**: Keep ranking logic testable with deterministic fixtures and tunable weights.
- **PAT-001**: Local-first retrieval + optional external augmentation.
- **PAT-002**: Evidence-backed retrieval with confidence/provenance tags.
- **PAT-003**: Token-budget-aware context packing.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Build RAG client and knowledge base lifecycle foundation.

| Task     | Description                                                                                                                                              | Completed | Date |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-001 | Create `packages/memory/src/retrieval/rag/server-client.ts` exposing typed `RAGServerClient` methods (`search`, `ingest`, `upsert`, `delete`, `health`). |           |      |
| TASK-002 | Create `packages/memory/src/retrieval/rag/knowledge-base.ts` with collection lifecycle, index metadata, and synchronization cursors.                     |           |      |
| TASK-003 | Create `packages/memory/src/retrieval/rag/config.ts` for local-only defaults, source gates, and weighting parameters.                                    |           |      |
| TASK-004 | Implement startup auto-ingest bootstrap in `packages/memory/src/retrieval/rag/bootstrap.ts`.                                                             |           |      |
| TASK-005 | Create typed retrieval model contracts in `packages/memory/src/retrieval/rag/types.ts` (evidence, citation, score breakdown).                            |           |      |
| TASK-006 | Add unit tests for client/config/bootstrap flows in `packages/memory/src/retrieval/rag/*.test.ts`.                                                       |           |      |

### Implementation Phase 2

- GOAL-002: Implement ingestion pipeline and index management.

| Task     | Description                                                                                                                                    | Completed | Date |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-007 | Create `packages/memory/src/retrieval/rag/document-ingest.ts` for markdown/text/code ingestion with deterministic chunking.                    |           |      |
| TASK-008 | Create `packages/memory/src/retrieval/rag/source-connectors.ts` for local file sources and optional web connectors with allowlist enforcement. |           |      |
| TASK-009 | Implement dedup/version tracking in `packages/memory/src/retrieval/rag/index-manager.ts` using content fingerprints.                           |           |      |
| TASK-010 | Implement re-index scheduler in `packages/memory/src/retrieval/rag/reindex-scheduler.ts` with incremental update support.                      |           |      |
| TASK-011 | Create ingestion validation and redaction hooks in `packages/memory/src/retrieval/rag/sanitization.ts`.                                        |           |      |
| TASK-012 | Add ingestion/index tests including update/delete/reindex and idempotency scenarios.                                                           |           |      |

### Implementation Phase 3

- GOAL-003: Implement advanced retrieval quality features and hybrid ranking.

| Task     | Description                                                                                                                                                | Completed | Date |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-013 | Create `packages/memory/src/retrieval/rag/hybrid-retriever.ts` combining vector similarity, lexical match, entity overlap, and temporal recency.           |           |      |
| TASK-014 | Create `packages/memory/src/retrieval/rag/reranker.ts` with explainable score composition and tunable weights.                                             |           |      |
| TASK-015 | Implement query optimization in `packages/memory/src/retrieval/rag/query-planner.ts` (expansion, filters, intent routing).                                 |           |      |
| TASK-016 | Implement evidence packing in `packages/memory/src/retrieval/rag/context-packer.ts` constrained by token budgets and citation requirements.                |           |      |
| TASK-017 | Add retrieval quality fixtures and benchmark harness in `packages/testing/fixtures/retrieval/` and `packages/testing/src/benchmarks/retrieval-quality.ts`. |           |      |
| TASK-018 | Add ranking/relevance tests and benchmark assertions versus vector-only baseline.                                                                          |           |      |

### Implementation Phase 4

- GOAL-004: Integrate with runtime and observability; finalize production gates.

| Task     | Description                                                                                                                                  | Completed | Date |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-019 | Wire retrieval outputs into runtime memory injection path (`@agentsy/runtime`) with evidence/citation metadata preservation.                 |           |      |
| TASK-020 | Add retrieval observability module `packages/memory/src/retrieval/rag/metrics.ts` with latency, hit-rate, source-mix, and citation counters. |           |      |
| TASK-021 | Add end-to-end integration tests for local-only mode, hybrid mode, and degraded/offline mode fallback.                                       |           |      |
| TASK-022 | Update docs in `packages/memory/README.md`, `docs/packages/memory.md`, and examples under `docs/examples/` for RAG flows.                    |           |      |
| TASK-023 | Run `pnpm --filter @agentsy/memory check-types && pnpm --filter @agentsy/memory test` and retrieval benchmark suites.                        |           |      |
| TASK-024 | Run monorepo `pnpm check-types && pnpm test`; record evidence in `plan/PHASE-3-COMPLETION.md`.                                               |           |      |

## 3. Alternatives

- **ALT-001**: Cloud-first hosted retrieval only. Rejected because phase goals require local-first privacy-preserving baseline.
- **ALT-002**: Vector-only retrieval without lexical/entity/temporal fusion. Rejected due to lower precision for code/docs corpora and weaker explainability.
- **ALT-003**: Unbounded context assembly from retrieved chunks. Rejected because token budgets and runtime prompt constraints require strict packing.
- **ALT-004**: No source attribution/citations in retrieval output. Rejected because verification and trust requirements depend on provenance.

## 4. Dependencies

- **DEP-001**: `@agentsy/memory` wiki and indexing layers from Phase 1/2.
- **DEP-002**: `@agentsy/tokens` budgeting APIs for context packing and truncation policies.
- **DEP-003**: `@agentsy/runtime` memory injection hooks for retrieval context consumption.
- **DEP-004**: `@agentsy/providers` adapters for optional external retrieval transport abstractions.
- **DEP-005**: `@agentsy/observability` conventions for metrics/event naming.
- **DEP-006**: Shared benchmark utilities in `@agentsy/testing`.

## 5. Files

- **FILE-001**: `packages/memory/src/retrieval/rag/server-client.ts`
- **FILE-002**: `packages/memory/src/retrieval/rag/knowledge-base.ts`
- **FILE-003**: `packages/memory/src/retrieval/rag/config.ts`
- **FILE-004**: `packages/memory/src/retrieval/rag/bootstrap.ts`
- **FILE-005**: `packages/memory/src/retrieval/rag/types.ts`
- **FILE-006**: `packages/memory/src/retrieval/rag/document-ingest.ts`
- **FILE-007**: `packages/memory/src/retrieval/rag/source-connectors.ts`
- **FILE-008**: `packages/memory/src/retrieval/rag/index-manager.ts`
- **FILE-009**: `packages/memory/src/retrieval/rag/reindex-scheduler.ts`
- **FILE-010**: `packages/memory/src/retrieval/rag/sanitization.ts`
- **FILE-011**: `packages/memory/src/retrieval/rag/hybrid-retriever.ts`
- **FILE-012**: `packages/memory/src/retrieval/rag/reranker.ts`
- **FILE-013**: `packages/memory/src/retrieval/rag/query-planner.ts`
- **FILE-014**: `packages/memory/src/retrieval/rag/context-packer.ts`
- **FILE-015**: `packages/memory/src/retrieval/rag/metrics.ts`
- **FILE-016**: `packages/memory/src/retrieval/rag/index.ts`
- **FILE-017**: `packages/testing/fixtures/retrieval/*`
- **FILE-018**: `packages/testing/src/benchmarks/retrieval-quality.ts`
- **FILE-019**: `packages/memory/src/index.ts`
- **FILE-020**: `plan/PHASE-3-COMPLETION.md`

## 6. Testing

- **TEST-001**: RAG client tests for health, search, and ingest API contracts.
- **TEST-002**: Ingestion pipeline tests for chunking, deduplication, and idempotent updates.
- **TEST-003**: Source connector tests for allowlist enforcement and failure isolation.
- **TEST-004**: Hybrid retrieval tests for score composition and deterministic ordering.
- **TEST-005**: Reranker tests validating explainable score breakdown and configured weight behavior.
- **TEST-006**: Query planner tests for routing, expansion, and filter application.
- **TEST-007**: Context packer tests enforcing token budget and citation inclusion constraints.
- **TEST-008**: End-to-end tests for local-only mode, hybrid mode, and remote/web failure fallback.
- **TEST-009**: Retrieval benchmark tests (latency, relevance uplift, citation coverage).
- **TEST-010**: Package and monorepo gates: `pnpm --filter @agentsy/memory check-types`, `pnpm --filter @agentsy/memory test`, `pnpm check-types`, `pnpm test`.

## 7. Risks & Assumptions

- **RISK-001**: External/web source quality noise may reduce retrieval precision; mitigate with strict source policies and confidence thresholds.
- **RISK-002**: Index drift from frequent updates can degrade ranking consistency; mitigate with incremental reindex validation and versioned metadata.
- **RISK-003**: Ranking complexity can increase latency; mitigate with staged retrieval (coarse then rerank) and cache-aware fingerprints.
- **RISK-004**: Citation coverage may regress under aggressive context truncation; mitigate with citation-preserving packer constraints.
- **ASSUMPTION-001**: Phase 1 wiki/vector foundation remains stable and available.
- **ASSUMPTION-002**: Local embedding pipeline remains available and benchmarkable on target dev environments.
- **ASSUMPTION-003**: Optional web-search dependencies are configurable and non-blocking to core local retrieval.

## 8. Related Specifications / Further Reading

- `plan/IMPLEMENTATION-PRIORITY.md`
- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `packages/memory/IMPLEMENTATION-PLAN.md`
- `packages/memory/MEMORY-ARCHITECTURE.md`
- `packages/memory/MEMORY-STRATEGY-SYNTHESIS.md`
- `packages/memory/UPDATED-IMPLEMENTATION-PLAN.md`
- `packages/tokens/IMPLEMENTATION-PLAN.md`
- `packages/runtime/IMPLEMENTATION-PLAN.md`
- `packages/providers/IMPLEMENTATION-PLAN.md`
- `packages/observability/IMPLEMENTATION-PLAN.md`
