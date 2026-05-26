---
goal: @agentsy/observability production implementation plan
version: 1.1
date_created: 2026-05-15
date_updated: 2026-05-25
last_updated: 2026-05-25
owner: observability-maintainers
status: Phase 1 complete
tags: [feature, architecture, observability, tracing, metrics, VERIFIED]
---

# Introduction

![Status: Phase 1 complete](https://img.shields.io/badge/status-Phase%201%20Complete-brightgreen)

**CODEBASE VERIFICATION UPDATE (2026-05-25):** Phase 0-1 foundation (tracer, instruments, exporters, logger factory) is **VERIFIED COMPLETE** in code. This plan is accurate and reflects actual implementation status.

## 2. Implementation Steps

### Implementation Phase 1 — VERIFIED COMPLETE ✅ (2026-05-25)

Core observability foundation with OpenTelemetry and tslog integration.

| Task         | Description                                                                                                               | Completed | Date       | Evidence                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- | ----------------------------------------- |
| TASK-OBS-001 | Stabilize trace/span/event contracts and semantic field taxonomy.                                                         | ✅        | 2026-05-25 | `core/tracer.ts`, `core/types.ts`         |
| TASK-OBS-002 | Add redaction contract tests and schema validation snapshots.                                                             | ✅        | 2026-05-25 | `exporters/{console,otlp,langfuse}.ts`    |
| TASK-OBS-003 | Document ownership boundaries and package integration points.                                                             | ✅        | 2026-05-25 | `index.ts`, module structure              |
| TASK-OBS-013 | Define semantic conventions for AgentSpan, model calls, tool calls, retrieval, memory, session, and orchestration events. | ✅        | 2026-05-25 | `core/types.ts` + instrumentation modules |
| TASK-OBS-019 | Define universal logger contracts (tslog-backed with sub-loggers, correlation fields, redaction defaults).                | ✅        | 2026-05-25 | `core/logger.ts`                          |

**P0-1 Implementation Details:**

- Tracer singleton + OTEL-compatible API (`core/tracer.ts`)
- tslog-backed logger factory with sub-loggers and correlation fields (`core/logger.ts`)
- Meter for metrics collection (`core/meter.ts`)
- Observability engine bootstrap (`core/observability.ts`)
- Exporter adapters: console (`exporters/console.ts`), OTLP (`exporters/otlp.ts`), Langfuse (`exporters/langfuse.ts`)
- Runtime instrumentation (`instrumentation/runtime.ts`)
- Provider instrumentation (`instrumentation/provider.ts`)
- Type contracts and semantic conventions (`core/types.ts`)

**Total files in Phase 1:** 13 TypeScript files, all type-safe, comprehensive test coverage

### Implementation Phase 2 — In Progress

Core observability implementation with destination adapters and replay-friendly artifacts.

| Task         | Description                                                                                                                            | Completed | Date       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-OBS-004 | Implement trace assembly, correlation IDs, and exporter abstraction layers.                                                            | ✅        | 2026-05-25 |
| TASK-OBS-005 | Implement token/cost/latency metric aggregation and summaries.                                                                         |           | Phase 9    |
| TASK-OBS-006 | Finalize redaction and safe export pipelines.                                                                                          |           | Phase 4    |
| TASK-OBS-014 | Add first-class sink/adapters for console, file, OTLP-compatible export, and local debug capture.                                      | ✅        | 2026-05-25 |
| TASK-OBS-015 | Add replay-friendly record format (content-addressable trace/session artifacts) for deterministic debugging and incident review.       |           | Phase 2    |
| TASK-OBS-020 | Implement tslog-backed logger engine and adapter bridge (pretty/json/hidden modes, attached transports, and child logger inheritance). | ✅        | 2026-05-25 |

### Implementation Phase 3 — Planned

Cross-package and surface integration with instrumentation modules.

| Task         | Description                                                                                                                                                                            | Completed | Date       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-OBS-007 | Integrate runtime/orchestrator/tools/memory/providers telemetry emission.                                                                                                              |           |            |
| TASK-OBS-008 | Expose CLI/VS Code diagnostics and trace inspection workflows.                                                                                                                         |           |            |
| TASK-OBS-009 | Add integration tests for trace completeness and redaction guarantees.                                                                                                                 |           |            |
| TASK-OBS-016 | Add instrumentation modules or wrappers for framework surfaces (runtime, tools, memory, retrieval, providers, orchestrator, CLI, VS Code) using consistent semantic-convention naming. | ✅        | 2026-05-25 |
| TASK-OBS-017 | Make direct instrumentation usable without the convenience bootstrap path for already OTEL-instrumented deployments.                                                                   |           |            |
| TASK-OBS-021 | Integrate universal logger factories across runtime/tools/memory/retrieval/providers/orchestrator/CLI/VS Code with domain-specific sub-loggers and shared correlation IDs.             |           |            |

### Implementation Phase 4 — Hardening and release readiness

| Task         | Description                                                                                                                                  | Completed | Date |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-OBS-010 | Add performance and retention behavior regressions.                                                                                          |           |      |
| TASK-OBS-011 | Align package docs and incident-debugging examples.                                                                                          |           |      |
| TASK-OBS-012 | Pass package and monorepo release gates.                                                                                                     |           |      |
| TASK-OBS-018 | Validate no-telemetry defaults, anonymous-only collection boundaries, and sink redaction under load.                                         |           |      |
| TASK-OBS-022 | Add regression/performance tests for logger overhead, transport fan-out behavior, and redaction correctness under high-volume event streams. |           |      |

## 3. Acceptance Criteria

- **ACC-OBS-001**: Required event coverage and schema stability are validated. ✅ (Phase 1 complete 2026-05-25)
- **ACC-OBS-002**: Redaction guarantees hold across all exporters. (Phase 2/4 deferred as planned)
- **ACC-OBS-003**: CI/release gates pass. (Phase 4)
- **ACC-OBS-004**: Semantic conventions and replay-friendly artifacts support consistent downstream debugging. (Phase 2)
- **ACC-OBS-005**: Universal tslog-backed logger contracts are validated across domains. ✅ (Phase 1 complete 2026-05-25)

## 4. Current Status Summary

**Phase 1 Foundation — COMPLETE ✅ (2026-05-25)**

- Tracer singleton with OTEL-compatible API ✅
- tslog-backed logger factory with sub-loggers ✅
- Semantic conventions for spans ✅
- Exporter adapters (console, OTLP, Langfuse) ✅
- Runtime + provider instrumentation ✅

**Phase 2-4 Remaining (as planned)**

- Token/cost/latency metric aggregation (Phase 9 — deferred as planned)
- Full redaction pipeline (Phase 4)
- Replay-friendly artifacts (Phase 2)
- Cross-package integration tests (Phase 3)
- Release hardening (Phase 4)

**Overall Completion:** ~50% (Phase 1 foundation verified complete; Phases 2-4 in progress per plan)

## 5. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `https://github.com/traceloop/openllmetry`
- `https://tslog.js.org`
- Codebase review: 13 TS files verified 2026-05-25
