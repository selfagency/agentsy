---
goal: @agentsy/ui production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: ui-maintainers
status: In progress
tags: [feature, architecture, ui, state, events]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/ui` as shared UI state and event-sourcing contract package.

## 1. Requirements & Constraints

- **REQ-UI-001**: UI store supports immutable event-sourced updates with deterministic reducers.
- **REQ-UI-002**: Message/part schema alignment with core/runtime contracts is maintained.
- **REQ-UI-003**: Selectors and derived state are performant for streaming workloads.
- **REQ-UI-004**: State adapters support CLI/VS Code/other surfaces consistently.
- **SEC-UI-001**: State snapshots avoid persisting raw secret fields.
- **SEC-UI-002**: Untrusted rich-text/content is sanitized before display consumption.
- **CON-UI-001**: Rendering widgets remain in renderers/surface packages.
- **CON-UI-002**: Runtime execution/policy behavior remains outside UI reducers.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-UI-001: Contract stabilization.

| Task        | Description                                                             | Completed | Date |
| ----------- | ----------------------------------------------------------------------- | --------- | ---- |
| TASK-UI-001 | Stabilize UI message/event/store contracts and reducer semantics.       |           |      |
| TASK-UI-002 | Add typed tests for event ordering and deterministic state transitions. |           |      |
| TASK-UI-003 | Document boundary ownership vs renderers/runtime packages.              |           |      |

### Implementation Phase 2

- GOAL-UI-002: Core store implementation completion.

| Task        | Description                                                     | Completed | Date |
| ----------- | --------------------------------------------------------------- | --------- | ---- |
| TASK-UI-004 | Finalize event helpers, immutable store updates, and selectors. |           |      |
| TASK-UI-005 | Implement performance-safe derived state for streaming updates. |           |      |
| TASK-UI-006 | Implement adapter helpers for cross-surface consumption.        |           |      |

### Implementation Phase 3

- GOAL-UI-003: Integration and parity validation.

| Task        | Description                                                       | Completed | Date |
| ----------- | ----------------------------------------------------------------- | --------- | ---- |
| TASK-UI-007 | Integrate UI contracts with CLI/renderers/observability pathways. |           |      |
| TASK-UI-008 | Add cross-surface parity tests for state transition consistency.  |           |      |
| TASK-UI-009 | Validate redaction-safe state serialization behavior.             |           |      |

### Implementation Phase 4

- GOAL-UI-004: Hardening and release gates.

| Task        | Description                                                        | Completed | Date |
| ----------- | ------------------------------------------------------------------ | --------- | ---- |
| TASK-UI-010 | Add regression/performance tests for high-frequency stream events. |           |      |
| TASK-UI-011 | Update docs and usage examples for consumers.                      |           |      |
| TASK-UI-012 | Pass package and monorepo release gates.                           |           |      |

## 3. Acceptance Criteria

- **ACC-UI-001**: State contracts and reducers are deterministic and test-validated.
- **ACC-UI-002**: Cross-surface parity expectations are met.
- **ACC-UI-003**: Release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `docs/packages/ui.md`
- `packages/ui/README.md`
- `packages/ui/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/ui — Implementation Plan

## Purpose

UI state management and event sourcing for the `@agentsy` platform. Provides an immutable message store and event-driven bridge between the stream processor and UI frameworks.

## Architecture

### Event Sourcing Model

All UI state changes flow through discrete events. Messages are immutable; each event produces a new state.

```text
ProcessorEvent → eventHelpers → UIStore (event sourcing) → UIMessage[]
```

### Core Types (`src/types.ts`)

- `UIMessage` — single conversation message with `id`, `role`, `parts`, `finishReason`, `usage`, `createdAt`, `metadata`
- `UIMessagePart` — union: `UITextPart | UIThinkingPart | UIToolCallPart | UIStepPart | UIErrorPart`
- `UITextPart` — text content with `createdAt`
- `UIThinkingPart` — model reasoning block (`type: 'thinking'`)
- `UIToolCallPart` — tool invocation with `id`, `name`, `parameters`, `state`, `result`, `error`
- `UIStepPart` — agent loop step markers (`started` / `finished`)
- `UIErrorPart` — error associated with a message

### Event Sourcing (`src/eventSourcing.ts`)

Handles applying processor events to produce updated `UIMessage[]` arrays:

- `applyEvent(messages, event)` → `UIMessage[]`
- Handles: `text_delta`, `thinking_delta`, `tool_call_start`, `tool_call_delta`, `tool_call_end`, `tool_result`, `step_start`, `step_finish`, `error`, `finish`
- Immutable: never mutates in place — returns new arrays/objects

### Store (`src/store.ts`)

In-memory reactive store wrapping the event sourcing layer:

- `createUIStore(options?)` → `UIStore`
- `UIStore.getMessages()` → `UIMessage[]`
- `UIStore.applyEvent(event)` — apply a single processor event
- `UIStore.reset()` — clear all messages
- `UIStore.subscribe(cb)` → `() => void` (unsubscribe)

### Processor Bridge (`src/processorBridge.ts`)

Connects a `@agentsy/core` processor stream to a `UIStore`:

- `bridgeProcessorToStore(stream, store)` — reads processor events and applies to store
- Async iteration over processor output events
- Error handling: surfaces errors as `UIErrorPart` rather than throwing

### Event Helpers (`src/eventHelpers.ts`)

Utilities for constructing events, generating IDs, and applying timestamps:

- `createTextEvent(messageId, text)` → processor-compatible event
- `createToolCallEvent(...)` → processor-compatible event
- Auto-stamps `createdAt` on all parts

## Dependencies

- `@agentsy/core` — processor event types and stream contracts
- `@agentsy/types` — shared types (`FinishReason`, `ToolCallState`, `UsageInfo`, `JsonObject`)

## Implementation Status

| Feature                                | Status                           |
| -------------------------------------- | -------------------------------- |
| `UIMessage` / `UIMessagePart` types    | ✅ Complete                      |
| `eventSourcing.ts` — event → state     | ✅ Complete                      |
| `store.ts` — reactive store            | ✅ Complete                      |
| `processorBridge.ts` — stream bridge   | ✅ Complete                      |
| `eventHelpers.ts` — event construction | ✅ Complete                      |
| React adapter (hook)                   | ❌ Future (`@agentsy/ui/react`)  |
| Svelte store adapter                   | ❌ Future (`@agentsy/ui/svelte`) |
| Vue composable                         | ❌ Future (`@agentsy/ui/vue`)    |

## Future Work

### Framework Adapters (Subpath Exports)

Add framework-specific wrappers as subpath exports:

- `@agentsy/ui/react` — `useAgentsyStore()` hook
- `@agentsy/ui/svelte` — Svelte store wrapping `UIStore`
- `@agentsy/ui/vue` — Vue composable `useAgentsyStore()`

### Persistence

- Optional serialization of `UIMessage[]` to JSON for session replay
- Hook: `UIStore` `serialize()` / `deserialize(json)`

### Message Diffing

- `diffMessages(prev, next)` utility for frameworks that benefit from granular change detection

### Streaming Indicators

- `isStreaming` flag on `UIStore` — `true` while a processor stream is active
- Tracks pending tool calls

## Testing

- `src/ui.test.ts` — unit tests for event sourcing and store
- Target: event application, subscription lifecycle, processor bridge, error paths

## Export Surface

```ts
// packages/ui/src/index.ts
export { createUIStore } from "./store.js";
export { bridgeProcessorToStore } from "./processorBridge.js";
export { applyEvent } from "./eventSourcing.js";
export * from "./types.js";
export * from "./eventHelpers.js";
```
