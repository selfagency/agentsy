---
goal: @agentsy/types production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-25
owner: types-maintainers
status: In progress
tags: [feature, architecture, types, contracts, semver]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/types` as the cross-package contract anchor.

## 1. Requirements & Constraints

- **REQ-TYPES-001**: Types package remains a dependency leaf with no cross-package imports.
- **REQ-TYPES-002**: Core event/chunk/tool/session contracts are explicitly versioned.
- **REQ-TYPES-003**: Breaking type changes include compatibility notes and migration guidance.
- **REQ-TYPES-004**: Discriminated unions and narrowing behavior are test-validated.
- **SEC-TYPES-001**: Sensitive fields include redaction expectations in type docs/contracts.
- **SEC-TYPES-002**: Type evolution avoids unsafe `any`/`unknown` leakage across boundaries.
- **CON-TYPES-001**: Types package contains contracts only, no runtime implementation logic.
- **CON-TYPES-002**: Policy semantics remain in runtime/guardrails/orchestrator layers.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-TYPES-001: Contract inventory and boundary stabilization.

| Task           | Description                                                                                                                                                                  | Completed | Date       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-TYPES-001 | Audit and stabilize exported type surface and versioning markers.                                                                                                            | ✅        | 2026-05-25 |
| TASK-067       | DOGFOOD: Types-contract stabilization — 17 modules audited, 0 strict-mode violations, +7 TSDoc annotations, duplicate export removed from index.ts, typo fixed in memory.ts. | ✅        | 2026-05-25 |
| TASK-TYPES-002 | Add type-level tests for invariants and narrowing guarantees.                                                                                                                |           |            |
| TASK-TYPES-003 | Document ownership boundaries and semver policy.                                                                                                                             |           |            |

### Implementation Phase 2

- GOAL-TYPES-002: Core contract completion.

| Task           | Description                                                   | Completed | Date |
| -------------- | ------------------------------------------------------------- | --------- | ---- |
| TASK-TYPES-004 | Finalize chunk/event/tool/session/approval contract families. |           |      |
| TASK-TYPES-005 | Implement compatibility helpers and deprecation markers.      |           |      |
| TASK-TYPES-006 | Add redaction-oriented field annotations and docs.            |           |      |

### Implementation Phase 3

- GOAL-TYPES-003: Cross-package validation.

| Task           | Description                                                                 | Completed | Date |
| -------------- | --------------------------------------------------------------------------- | --------- | ---- |
| TASK-TYPES-007 | Validate compatibility across core/runtime/providers/renderers/ui packages. |           |      |
| TASK-TYPES-008 | Add integration checks for compile-time contract snapshots in CI.           |           |      |
| TASK-TYPES-009 | Ensure migration notes for breaking changes are maintained.                 |           |      |

### Implementation Phase 4

- GOAL-TYPES-004: Hardening and release gates.

| Task           | Description                                                            | Completed | Date |
| -------------- | ---------------------------------------------------------------------- | --------- | ---- |
| TASK-TYPES-010 | Add regression checks for API drift and accidental contract expansion. |           |      |
| TASK-TYPES-011 | Update docs/examples and package references.                           |           |      |
| TASK-TYPES-012 | Pass package and monorepo release gates.                               |           |      |

## 3. Acceptance Criteria

- **ACC-TYPES-001**: Type contracts are stable, test-validated, and semver-governed.
- **ACC-TYPES-002**: Downstream package compile/test compatibility is green.
- **ACC-TYPES-003**: Release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `docs/packages/types.md`
- `packages/types/README.md`
- `packages/types/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/types — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/types` is the **foundational anchor** of the entire Agentsy framework. It serves as the single source of truth for the data contracts that allow disparate packages (stream processors, orchestrators, runtimes, UI components) to communicate without tight coupling.

In the monorepo dependency graph, `@agentsy/types` is a **leaf node**:

- It **never imports** from any other `@agentsy/*` package.
- Every other package **must import** from it for cross-boundary data exchange.
- It defines the "narrow waist" of the framework: the common language for messages, tool calls, and agent states.

### Ecosystem Sketch

```text
[ @agentsy/vscode ] [ @agentsy/cli ] [ @agentsy/renderers ]
         \               |                /
          \              v               /
           [ @agentsy/runtime ] [ @agentsy/orchestrator ]
                  |                  |
                  v                  v
          [ @agentsy/core ] [ @agentsy/memory ] [ @agentsy/session ]
                  \                  /
                   v                v
                  [ @agentsy/types ]  <-- SINGLE SOURCE OF TRUTH
```

## Fulfillment of Role

The package fulfills its role by providing **zero-runtime, high-fidelity type definitions**. It ensures that a `StreamChunk` emitted by `@agentsy/core` is exactly what `@agentsy/renderers` expects, and that an `AgentState` persisted by `@agentsy/session` can be safely resumed by `@agentsy/runtime`.

### 1. Branded Primitives (Opaque Types)

To prevent "primitive obsession" and accidental mixing of IDs (e.g., passing a `SessionId` where an `AgentId` is expected), we use branded types:

```typescript
export type Brand<K, T> = K & { __brand: T };
export type SessionId = Brand<string, 'SessionId'>;
export type AgentId = Brand<string, 'AgentId'>;
export type TraceId = Brand<string, 'TraceId'>;
```

This forces developers to use explicit factories or type guards, significantly reducing ID-related bugs in complex multi-agent workflows.

### 2. Discriminated Unions for Message Content

Instead of complex class hierarchies, we use discriminated unions for message content. This makes the data easy to serialize/deserialize and type-safe to process with `switch` statements:

```typescript
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; image: { data: string; mimeType: string } }
  | { type: 'tool_call'; toolCall: NormalizedToolCall }
  | { type: 'tool_result'; toolResult: ToolResult }
  | { type: 'thought'; thought: string; internal?: boolean };

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: ContentPart[];
}
```

### 3. Strict Provider Contracts

The package defines the interfaces that all provider adapters must satisfy, ensuring the `UniversalClient` in `@agentsy/core` remains provider-agnostic.

## Detailed Functionality

### Message System (`messages.ts`)

- **`AgentMessage`**: The fundamental unit of conversation.
- **`Role`**: Enum/Union for `system`, `user`, `assistant`, `tool`.
- **`ContentPart`**: Discriminated union handling text, image, thought blocks, and tool calls.
- **`NormalizedToolCall`**: Framework-standardized tool call.
- **`ToolResult`**: Response from a tool execution.

### Provider System (`providers.ts`)

- **`CompletionRequest`**: Standardized input for any LLM (messages, tools, temp, etc.).
- **`CompletionResponse`**: Non-streaming result.
- **`NormalizedChunk`**: The unit of streaming output, including `index`, `delta`, and `finishReason`.

```typescript
export interface NormalizedChunk {
  index: number;
  delta: {
    text?: string;
    thought?: string;
    toolCall?: Partial<NormalizedToolCall>;
  };
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
  usage?: TokenUsage;
}
```

- **`ProviderCapabilities`**: Metadata about what a model supports (vision, tools, logprobs).

### Agentic System (`agents.ts`)

- **`AgentConfig`**: Declarative definition of an agent (instructions, tools, model choice).
- **`AgentStatus`**: `idle | busy | paused | error | finished`.
- **`AgentLoopState`**: Current step, history, pending tools, status.
- **`RunResult`**: The final output of an multi-step agent execution.
- **`StopCondition`**: Async predicate for loop termination.

### Tool System (`tools.ts`)

- **`ToolDefinition`**: JSON Schema-based definition for LLM consumption.
- **`ToolHandler`**: The runtime function signature for tool execution.

### Memory & Retrieval System (`memory.ts`, `retrieval.ts`)

- **`MemoryScope`**: `session | user | project | team | global`.
- **`MemoryEntry`**: The unit of Karpathy-style wiki pages (metadata, content, embedding).
- **`VectorQuery`**: Parameters for semantic search.
- **`RetrievalResult`**: Scored and ranked results from a search query.

### Infrastructure & States (`session.ts`, `tokens.ts`, `observability.ts`)

- **`SessionSnapshot`**: Immutable timestamped copy of session state with checksum.
- **`TokenUsage`**: Metric record for cost tracking.
- **`SpanContext`**: OpenTelemetry-compatible tracing identifiers.

### Platform Protocols (`protocol/`)

- **`ag-ui.ts`**: UI synchronization event types (step start/end, tool status).
- **`acp.ts`**: Agent Client Protocol request/response shapes for editor integration.
- **`a2a.ts`**: Agent-to-Agent protocol shapes (Agent Cards, discovery).

## Implementation Details

### Directory Structure

```text
packages/types/src/
  agents.ts        # AgentConfig, AgentState, AgentStatus, RunResult, StepResult
  messages.ts      # AgentMessage, ContentPart, Role, ToolCall, ToolResult
  providers.ts     # ProviderAdapter, CompletionRequest/Response, StreamChunk, Embedding*
  tools.ts         # ToolDefinition, ToolParameters, ToolHandler
  session.ts       # SessionId, SessionScope, SessionSnapshot (thin interface only)
  memory.ts        # MemoryId, MemoryType, MemoryEntry (thin interface only)
  retrieval.ts     # VectorQuery, RetrievalResult, DocumentStore interfaces
  tokens.ts        # TokenUsage, CostEstimate, BudgetId, ModelPricing
  observability.ts # SpanContext, TraceId, Attributes, LogRecord, EventSchema
  protocol/        # Platform protocols
    ag-ui.ts       # UI event types
    acp.ts         # Agent Client Protocol
    a2a.ts         # Agent-to-Agent protocol
  brands.ts        # All opaque branded string/number primitives
  errors.ts        # AgentsyError base class, typed error discriminants
  index.ts         # Re-exports everything
```

### Dependency Position

`@agentsy/types` sits at the absolute root. It has **zero dependencies** (neither external nor internal). It is the only package allowed to be imported by every other package in the monorepo.

## Sources Synthesized

`agentsy-tech.md`, `PACKAGE-NAMING-MAP.md`, `REVISED-ARCHITECTURE.md`, `RECONCILIATION-REPORT.md`, `packages/types/IMPLEMENTATION-PLAN.md`.

### What is Intentionally Not Included

- Runtime implementations (pure types only)
- Provider-specific types (those belong in provider packages)
- UI component types (those belong in `ui` package)
- Test-specific types (use `vitest` types instead)

### Source Plan References

- `plan/agentsy-tech.md` §2.1 - Type system foundation
- `plan/agentsy-memory.md` §3 - Memory type definitions
- `plan/agentsy-providers.md` §4 - Provider interface contracts

### Implementation Milestones

#### Current (v0.1.1)

- ✅ Core stream types published
- ✅ Provider interface contracts
- ✅ Agent message and tool types
- ✅ Memory and retrieval type foundations

#### Next (v0.2.0)

- 🔄 Add structured output types for newer models
- 🔄 Expand retrieval types for vector search
- 🔄 Add session persistence types
- 🔄 Improve token budgeting type contracts

#### Future (v0.3.0)

- 📋 Add plugin/skill interface types
- 📋 Add ACP protocol types
- 📋 Add connector protocol types
- 📋 Add telemetry event types

### Verification Criteria

- [ ] TypeScript compilation passes across all dependent packages
- [ ] No circular type dependencies
- [ ] Published types match implementation types
- [ ] Type coverage > 95% for exported APIs

### Migration Notes

This package follows semantic versioning carefully since it's a foundation dependency:

- **Major versions**: Breaking changes to exported types
- **Minor versions**: New additive types only
- **Patch versions**: Bug fixes, documentation, internal cleanup

### Risk Register

- **High**: Breaking changes cascade to all dependent packages
- **Medium**: Type version drift with implementation packages
- **Low**: External dependency updates (type-fest)
