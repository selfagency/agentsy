---
goal: @agentsy/core production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-26
owner: core-maintainers
status: In progress
tags: [feature, architecture, core, stream-processing, VERIFIED]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/core` as the streaming event processing and universal client authority.

## 1. Requirements & Constraints

- **REQ-CORE-001**: Stream processing emits deterministic event types (text-delta, thinking-delta, tool-call, tool-result, error).
- **REQ-CORE-002**: Universal client normalizes provider responses into unified `NormalizedChunk` format.
- **REQ-CORE-003**: XML context splitting/deduplication utilities support memory retrieval injection.
- **REQ-CORE-004**: Stream-to-events adapter isolates LLM streaming semantics from consumer surfaces.
- **SEC-CORE-001**: No secrets in stream payloads; all sensitive data handled via `@agentsy/secrets`.
- **SEC-CORE-002**: Streaming error recovery preserves context and fails closed on unrecoverable errors.
- **CON-CORE-001**: Provider-specific adapters live in `@agentsy/providers`.
- **CON-CORE-002`: Runtime orchestration lives in `@agentsy/runtime`.

## 2. Implementation Steps

### Implementation Phase 0-2 — Stream Normalization ✅ COMPLETE (2026-05-26)

| Task      | Description                                                                            | Completed | Date       |
| --------- | -------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-009  | Stream-to-Events Adapter implementation                                                | ✅        | 2026-05-26 |
| TASK-010  | Runtime Turn Loop Integration (depends on Phase 1 contract stabilization)              |           |            |

**TASK-009: Stream-to-Events Adapter — ✅ COMPLETE**

**Evidence:**
- `packages/core/src/processor/stream-to-events.ts` — adapter implementation
- Tests: `__tests__/stream-to-events.test.ts`
- Produces: text-delta, thinking-delta, tool-call events

**Verification:** P0-2 COMPLETE ✅ (verified 2026-05-26 codebase audit)

### Implementation Phase 1

- GOAL-CORE-001: Contract stabilization.

| Task      | Description                                                         | Completed | Date |
| --------- | ------------------------------------------------------------------- | --------- | ---- |
| TASK-CORE-001 | Stabilize stream event types and NormalizedChunk contracts.        |           |      |
| TASK-CORE-002 | Add typed tests for XML splitting/deduplication utilities.         |           |      |
| TASK-CORE-003 | Document ownership boundaries with runtime/providers/memory.       |           |      |

### Implementation Phase 2

- GOAL-CORE-002: Core stream processing completion.

| Task      | Description                                                                           | Completed | Date |
| --------- | ------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-CORE-004 | Finalize universal client streaming with provider adapter integration.                |           |      |
| TASK-CORE-005 | Implement error recovery and fail-closed semantics for streaming failures.            |           |      |
| TASK-CORE-006 | Add integration tests for cross-provider streaming normalization.                  |           |      |

### Implementation Phase 3

- GOAL-CORE-003: Cross-package integration.

| Task      | Description                                                                  | Completed | Date |
| --------- | ---------------------------------------------------------------------------- | --------- | ---- |
| TASK-CORE-007 | Integrate runtime/orchestrator streaming paths.                              |           |      |
| TASK-CORE-008 | Add integration tests for XML context injection and deduplication paths.        |           |      |
| TASK-CORE-009 | Emit stream processing telemetry through `@agentsy/observability`.            |           |      |

### Implementation Phase 4

- GOAL-CORE-004: Hardening and release gates.

| Task       | Description                                                            | Completed | Date |
| ---------- | ---------------------------------------------------------------------- | --------- | ---- |
| TASK-CORE-010 | Add regression tests for streaming edge cases and provider edge cases.    |           |      |
| TASK-CORE-011 | Align docs/examples with shipped streaming behavior.                  |           |      |
| TASK-CORE-012 | Pass package and monorepo release gates.                              |           |      |

## 3. Acceptance Criteria

- **ACC-CORE-001**: Stream processing and normalization are deterministic and test-validated.
- **ACC-CORE-002**: Integration flows with runtime/providers/memory pass end-to-end tests.
- **ACC-CORE-003**: Release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `docs/packages/core.md`
- `packages/core/README.md`
- `packages/core/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/core — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/core` is the **streaming event processing and universal client** layer of the framework. It provides the fundamental primitives for:

1. **Stream Processing**: Parsing, transforming, and normalizing LLM streaming responses into structured events
2. **Universal Client**: Provider-agnostic completion interface with automatic normalization
3. **XML Context Utilities**: Splitting and deduplicating XML-tagged context for memory retrieval injection

It sits at the bottom of the dependency stack, consumed by runtime, orchestrator, and all integration surfaces.

### Ecosystem Sketch

```text
[ @agentsy/runtime ]    [ @agentsy/orchestrator ]
         |                   |
         v                   v
   [ @agentsy/core ] <--- Universal Client & Stream Processing
         |
    +----+----+
    |         |
    v         v
[ Providers ] [ Types ]
```

## Fulfillment of Role

The package fulfills its role by implementing:

1. **Stream-to-Events Adapter**: Converts raw streaming responses into structured events
2. **Universal Client**: Provider-agnostic completion interface
3. **XML Processing**: Utilities for splitting and deduplicating XML context
4. **Error Recovery**: Fail-closed semantics for streaming failures

## Detailed Functionality

### 1. Stream-to-Events Adapter (`src/processor/stream-to-events.ts`)

**Scope:** Parse LLM streaming responses and emit structured events

**Event Types:**
- `text-delta` — Incremental text output
- `thinking-delta` — Incremental thinking/reasoning output
- `tool-call` — Tool invocation with arguments
- `tool-result` — Tool execution result
- `error` — Streaming or processing error

**Implementation Status:** ✅ COMPLETE (TASK-009, verified 2026-05-26)

**Evidence:**
- Adapter implementation in `packages/core/src/processor/stream-to-events.ts`
- Tests in `__tests__/stream-to-events.test.ts`
- Produces all event types: text-delta, thinking-delta, tool-call events

### 2. Universal Client (`src/universal-client/`)

**Scope:** Provider-agnostic completion interface

**Responsibility:**
- Abstract over provider-specific request/response formats
- Normalize responses into unified `NormalizedChunk` format
- Handle authentication via `@agentsy/secrets`
- Support streaming and non-streaming modes

### 3. XML Context Utilities (`src/xml/`)

**Scope:** XML context splitting and deduplication

**Responsibility:**
- `splitLeadingXmlContext` — Split XML tags from leading context
- `dedupeXmlContext` — Remove duplicate XML sections
- Support memory retrieval injection

## Implementation Details

### Stream Processing Contracts

```typescript
export interface NormalizedChunk {
  index: number;
  delta: {
    text?: string;
    thought?: string;
    toolCall?: Partial<NormalizedToolCall>;
  };
  finishReason?: "stop" | "length" | "tool_calls" | "content_filter" | "error";
  usage?: TokenUsage;
}
```

### Error Recovery

Streaming errors are handled with fail-closed semantics:
- Preserve context on recoverable errors
- Fail closed on unrecoverable errors
- Emit error events for observability

## Boundary Enforcement

`@agentsy/core`:
- **DOES** own stream processing and normalization logic
- **DOES NOT** own provider-specific adapters (those live in `@agentsy/providers`)
- **DOES NOT** own runtime orchestration (that lives in `@agentsy/runtime`)
- **DOES NOT** own business logic or domain behavior

## Sources Synthesized

`agentsy-tech.md`, `agentsy-streaming-v1.md`, `DECISION-LOG.md`, `packages/core/IMPLEMENTATION-PLAN.md`.

---

## Phase 2 — Runtime Turn Loop Integration

**TASK-010:** Pending (depends on Phase 1 contract stabilization)

**Scope:** Integrate stream-to-events adapter with runtime turn loop

**Dependencies:**
- Phase 1 contract stabilization
- Runtime loop interfaces stable

---

## Verification Criteria

- [ ] Stream processing produces deterministic event types
- [ ] Universal client normalizes all provider responses
- [ ] XML utilities correctly split/deduplicate context
- [ ] Error recovery preserves context and fails closed
- [ ] All integration tests pass

---

**Next phase:** Phase 1 (contract stabilization) → Phase 2 (integration completion)