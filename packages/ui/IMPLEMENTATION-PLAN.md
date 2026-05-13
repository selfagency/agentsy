# @agentsy/ui — Implementation Plan

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
export { createUIStore } from './store.js';
export { bridgeProcessorToStore } from './processorBridge.js';
export { applyEvent } from './eventSourcing.js';
export * from './types.js';
export * from './eventHelpers.js';
```
