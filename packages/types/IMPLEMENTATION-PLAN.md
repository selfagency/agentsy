# @agentsy/types — Implementation Plan

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
