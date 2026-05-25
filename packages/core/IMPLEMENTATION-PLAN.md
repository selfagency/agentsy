---
goal: @agentsy/core production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-25
owner: core-maintainers
status: In progress
tags: [feature, architecture, core, streaming, contracts]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the canonical production implementation order for `@agentsy/core` as the stream-processing contract layer.

## 1. Requirements & Constraints

- **REQ-CORE-001**: Provider-native outputs normalize into stable chunk/event contracts.
- **REQ-CORE-002**: Processor pipeline preserves ordering for interleaved text/thinking/tool streams.
- **REQ-CORE-003**: Error surfaces remain typed and actionable for runtime/orchestrator recovery.
- **REQ-CORE-004**: Context assembly interfaces support deterministic, budget-aware composition.
- **SEC-CORE-001**: Untrusted model/provider content is treated as data and sanitized at boundaries.
- **SEC-CORE-002**: Core processing does not execute embedded content.
- **CON-CORE-001**: Orchestration strategy remains in `@agentsy/orchestrator`, not core.
- **CON-CORE-002**: UI/rendering concerns remain in `@agentsy/renderers` and surface packages.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-CORE-001: Contract stabilization.

| Task          | Description                                                          | Completed | Date |
| ------------- | -------------------------------------------------------------------- | --------- | ---- |
| TASK-009      | DOGFOOD Phase 2: Wire stream normalization and chunk processing through adapters/normalizers/processor into runtime events. |           |      |
| TASK-CORE-001 | Freeze normalized chunk/event type contracts and adapter boundaries. |           |      |
| TASK-CORE-002 | Add compile-time snapshots for processor and normalizer interfaces.  |           |      |
| TASK-CORE-003 | Document ownership boundaries in package docs and exports map.       |           |      |

### Implementation Phase 2

- GOAL-CORE-002: Core module completion.

| Task          | Description                                                                       | Completed | Date |
| ------------- | --------------------------------------------------------------------------------- | --------- | ---- |
| TASK-CORE-004 | Finalize adapters/normalizers/processor behavior for canonical stream conversion. |           |      |
| TASK-CORE-005 | Complete deterministic context assembly and compression integration seams.        |           |      |
| TASK-CORE-006 | Implement typed error taxonomy and recovery signals.                              |           |      |

### Implementation Phase 3

- GOAL-CORE-003: Cross-package integration.

| Task          | Description                                                                     | Completed | Date |
| ------------- | ------------------------------------------------------------------------------- | --------- | ---- |
| TASK-CORE-007 | Validate runtime/orchestrator/provider integration through end-to-end tests.    |           |      |
| TASK-CORE-008 | Add compatibility tests for renderer and UI consumers of normalized events.     |           |      |
| TASK-CORE-009 | Ensure token/memory/session boundaries are respected in context assembly flows. |           |      |

### Implementation Phase 4

- GOAL-CORE-004: Hardening and release readiness.

| Task          | Description                                                          | Completed | Date |
| ------------- | -------------------------------------------------------------------- | --------- | ---- |
| TASK-CORE-010 | Add regression/performance suites for stream correctness under load. |           |      |
| TASK-CORE-011 | Update docs for stable APIs and migration notes.                     |           |      |
| TASK-CORE-012 | Pass monorepo release gates with core suites green.                  |           |      |

## 3. Acceptance Criteria

- **ACC-CORE-001**: Stream contracts are stable and validated by tests.
- **ACC-CORE-002**: Integration flows pass for runtime/orchestrator/provider pipelines.
- **ACC-CORE-003**: Release gates pass (`pnpm check-types`, `pnpm test`).

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/IMPLEMENTATION-PRIORITY.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `docs/packages/adapters.md`
- `docs/packages/normalizers.md`
- `docs/packages/processor.md`
- `docs/packages/context.md`
- `packages/core/README.md`
- `packages/core/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/core — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/core` is the **engine room** of the framework. It handles the messy reality of raw bytes and divergent provider formats, transforming them into a clean, unified stream of events that the rest of the ecosystem can consume.

It sits directly above `@agentsy/types` and below `@agentsy/runtime` and `@agentsy/orchestrator`.

### Ecosystem Sketch

```text
[ @agentsy/runtime ] [ @agentsy/orchestrator ]
         |                   |
         +---------+---------+
                   |
                   v
           [ @agentsy/core ]
           /       |       \
          v        v        v
[ adapters ] [ normalizers ] [ processor ]
          \        |        /
           v       v       v
           [ @agentsy/types ]
```

## Fulfillment of Role

The package fulfills its role by providing three main layers of abstraction:

1. **Adapters**: Shape generic `CompletionRequest` objects into provider-specific wire formats.
2. **Normalizers**: Transform provider-specific `SSEEvent` objects into generic `NormalizedChunk` objects.
3. **Processor**: Aggregates normalized chunks into a stateful, event-driven stream that handles thinking blocks, tool calls, and text deltas.
4. **Tool Converters**: Logic to transform framework tool definitions into third-party formats (OpenAI, AI SDK, LangChain - Novu pattern).

## Detailed Functionality

### 1. Request Transformation (`adapters/`)

- **Responsibility**: Map framework types to API-specific shapes (OpenAI, Anthropic, Gemini, etc.).
- **Mechanism**: `ProviderAdapter` implementation for each provider.
- **Key Logic**: Handles different ways providers expect system prompts, message history, and tool definitions.

### 2. Response Normalization (`normalizers/`)

- **Responsibility**: Standardize the chaos of streaming outputs.
- **Mechanism**: `StreamNormalizer` for each provider.
- **Key Logic**: Detects start/delta/end of text, thoughts, and tool calls.
- **Model-Specific Adaptations**: An exception-aware parser layer (Qwen pattern) to handle provider-specific idiosyncrasies and experimental features without polluting core logic.

### 3. Stream Processing (`processor/`)

- **Responsibility**: State management of an active LLM stream.
- **Mechanism**: `LLMStreamProcessor` (EventEmitter).
- **Functionality**:
  - **SSE Parsing**: Uses `SSEParser` to handle the `data: ...` protocol.
  - **Aggregation**: Buffers partial tool call arguments until they are complete.
  - **Extraction**: Uses `ThinkingParser` to strip `ground` blocks into a separate channel.
  - **Filtering**: Uses `XmlFilter` to prevent raw tags from leaking into the text stream.
  - **Events**: Emits `chunk`, `thought`, `tool_call_started`, `tool_call_completed`, `finished`.

### 4. Shared Primitives

- **`UniversalClient`**: A unified fetch wrapper that automatically routes requests to the correct adapter and normalizer.
- **`StructuredOutput`**: schema-first structured generation with repair fallback, provider-native response formats, and optional grammar-constrained decoding.
- **`Recovery`**: Graceful handling of truncated streams or network interruptions.
- **`ContextManagement`**: Advanced window management with automatic compression triggers (REQ-007).

### 5. Context manager cache-awareness (LMCache-inspired)

The core context manager should learn from LMCache’s reuse model by treating context assembly as a cacheable computation, not just a string concatenation step.

#### What to adapt

- **Stable segment reuse**: preserve and reuse system prompts, tool schemas, policy preambles, and synthesized memory blocks when their fingerprints match.
- **Fingerprint-driven invalidation**: invalidate reusable segments when the model family, prompt template, tool schema, or user-edit state changes.
- **Hot/warm/cold assembly tiers**: promote frequently reused context segments and evict cold ones before they inflate the prompt.
- **Reuse accounting**: measure how often the context manager reuses blocks versus rebuilding them.

#### Recommended implementation guidance

1. Add a `ContextSegment` abstraction with `content`, `fingerprint`, `reuseClass`, and `invalidations`.
2. Keep context assembly deterministic so the same inputs produce the same prompt layout.
3. Expose cache-hit telemetry to observability so we can tell whether memory reuse is actually reducing token burn.
4. Reuse compatible segments across sessions when session state and policy allow it.
5. Keep the assembly layer backend-agnostic; it should not know about GPU KV cache internals.

### 5. Structured Output Handler (`structured/`)

The structured output handler should be the canonical place for turning a desired output shape into a provider-friendly generation strategy.

#### What to adapt from Outlines

- **Type-first API surface**: callers should be able to pass a schema/type and get back a structured-generation plan.
- **Provider independence**: the same schema should work across OpenAI-compatible, Ollama, vLLM, and provider-native modes.
- **Explicit output contracts**: prefer clear builders for JSON schema, literal/enum constraints, and repair prompts rather than opaque prompt text.

#### What to adapt from llguidance

- **Grammar backend abstraction**: allow structured output enforcement via grammar constraints when a provider/runtime supports it.
- **Schema to grammar lowering**: support JSON Schema, regex, and limited CFG-style constraints as an execution backend.
- **Low-latency decode path**: avoid repeated reparsing when a constrained-decoding backend can enforce the shape during generation.

#### Recommended execution modes

1. **Native structured outputs** — use provider features like OpenAI `response_format`, Ollama `format`, or equivalent native schema support.
2. **Grammar-constrained decoding** — use a backend such as llguidance-style constraints when the runtime can enforce structure before tokens are emitted.
3. **Repair fallback** — keep the current parse/repair loop as the compatibility path for models/providers without native support.

#### Implementation guidance

- Keep the public API centered on a schema argument and a small set of output-mode options.
- Preserve the current `buildFormatInstructions`, `buildOpenAIResponseFormat`, `buildOllamaFormat`, and repair helpers as composable building blocks.
- Add provider capability flags so the runtime can choose the best path without duplicating logic in each adapter.
- Make streaming validation work the same way regardless of backend: validate chunks where possible, repair at the end when necessary.

## Logic & Data Flow

### 1. Request Flow (UniversalClient)

1. `UniversalClient.complete(request)` is called.
2. The client selects the appropriate `Adapter` and `Normalizer` based on `request.provider`.
3. The `Adapter` transforms the generic `CompletionRequest` into the provider's specific fetch payload (URL, headers, body).
4. `UniversalClient` executes the fetch and returns a `ReadableStream<Uint8Array>`.

### 2. Stream Processing Flow (LLMStreamProcessor)

1. The byte stream is piped through `SSEParser` to produce `SSEEvent` objects.
2. Events are passed to the `Normalizer`, which emits `NormalizedChunk` objects.
3. `LLMStreamProcessor` aggregates these chunks, tracking:
   - Incremental text content.
   - Partial thought blocks (extracting from `ground` tags via `ThinkingParser`).
   - Accumulating tool call arguments across multiple chunks.
4. The processor emits events: `chunk`, `thought`, `tool_call_started`, `tool_call_delta`, `tool_call_completed`, `finished`.

## Key Interfaces

### UniversalClient

```typescript
export interface UniversalClient {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: CompletionRequest): Promise<ReadableStream<NormalizedChunk>>;
}

export function createUniversalClient(config: UniversalClientConfig): UniversalClient;
```

### LLMStreamProcessor

```typescript
export class LLMStreamProcessor extends EventEmitter {
  constructor(options: ProcessorOptions);

  // Main entry point for byte streams
  process(stream: ReadableStream<Uint8Array>): void;

  // Access current state
  getState(): ProcessorState;
}
```

## Implementation Details

### Subpath Architecture

```text
@agentsy/core                  # top-level: processor, sse, context, formatting, recovery
@agentsy/core/adapters         # Phase D: provider adapters
@agentsy/core/normalizers      # Phase D: response normalization
@agentsy/core/universal-client # Phase D: provider-agnostic client
```

### Multi-turn Tool Handling

The `tool-calls/` module must handle both "Native" tool calls (JSON-based) and "XML" tool calls (often used by Claude/DeepSeek). The `ToolCallParser` within `core` should be able to switch strategies based on the provider's capabilities.

### Known Issues / Gotchas

- `ReadableStream` type mismatch: `node:stream/web` vs DOM lib. Cast required when passing to `@agentsy/sse`'s `parseSSEStream`.
- `MCPTransport` and `adaptTransportToStream` are exported from `@agentsy/core/processor`.

## Sources Synthesized

`agentsy-tech.md`, `agentsy-platform-v1.md`, `agentsy-platform-v2.md`, `REVISED-ARCHITECTURE.md`, `DECISION-LOG.md`, `provider-capability-matrix.md`, `research/LLM-INTEGRATION-ANALYSIS.md`, `RECONCILIATION-REPORT.md`, `PACKAGE-NAMING-MAP.md`.

## Priorities

1. **Stream correctness** — SSE parser, chunk processing, and event emission must be byte-perfect across all provider formats.
2. **Context window management** — sophisticated approach to monitoring token budget and triggering compression (REQ-007).
3. **Streaming optimization** — implementing techniques for low-latency processing of large responses.
4. **Observability hooks** — standardized events for `ContextWindowWillOverflow`, `ChatCompressed`, `LoopDetected`, `Citation`, `Retry`, `InvalidStream` (REQ-006).
5. **Remove remaining legacy APIs** — any compatibility re-exports added during migration must be tracked and removed once downstream consumers are updated.
6. **Structured output parsing** — schema-first generation, JSON parse/repair, and optional grammar-constrained decoding for tool results and structured response modes.
7. **Recovery** — stream recovery on partial failures; retry logic at the normalizer layer.
8. **Event Emission** — `LLMStreamProcessor` must emit: `ContextWindowWillOverflow`, `ChatCompressed`, `LoopDetected`, `LoopExceeded`, `Citation`, `Retry`, `InvalidStream` (REQ-006).
9. **Provider Routing** — Ensure `openaiResponses` provider is routable through normalizers and processor pipeline (REQ-020).

---

## Architecture Decision Snapshot (migrated from `plan/DECISION-LOG.md`)

- Adopt layered architecture with clear package boundaries and avoid monolithic agent abstraction.
- Keep core parsing/processing primitives separate and stable (`types`, `xml-filter`, `context`, `formatting`, `sse`, `thinking`, `structured`, `tool-calls`, `processor`, `recovery`).
- Keep structured-output generation extensible enough to support provider-native formats, repair fallback, and grammar-backend implementations without leaking those details into orchestration.
- Prefer boundary clarity over aggressive package-count reduction.
- Enforce direct cutover migration (no compatibility wrapper packages).
- Keep dependency graph acyclic as a hard verification criterion.

---

## Package Naming Snapshot (migrated from `plan/PACKAGE-NAMING-MAP.md`)

Current-state core layer mappings to preserve:

- `context-manager` → `context` (merged)
- `tool-calls` content consolidated under core layer boundaries
- `retry` consolidated under core subpaths
- Core stream primitives remain independently consumable and must not depend on orchestration packages

Stale map entries are informational only and must not drive new package creation.

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Constraints carried into core implementation

- Node.js >= 22, ESM-first, `.js` extensions in relative imports.
- Strict TypeScript only (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`).
- Factory-first public APIs (`create*`) and exported `DEFAULT_*` constants.

### Core-owned public surface

- XML primitives: `createXmlStreamFilter`, `extractXmlToolCalls`, `splitLeadingXmlContext`, `dedupeXmlContext`, `stripXmlContextTags`.
- SSE + parsing primitives: `parseSSEStream`, `ThinkingParser`, structured JSON parse/repair.
- Tool prompt construction: `buildXmlToolSystemPrompt`.

### Processor-owned surface

- `LLMStreamProcessor` emits canonical stream events (`text_delta`, `thinking_delta`, `tool_call_*`, `message_complete`, retry/invalid/cost/context events).
- Chunk strategies remain processor-owned (`ImmediateStrategy`, `WordBoundaryStrategy`, `PunctuationStrategy`).
- Recording/replay support remains part of processor testability contract.

### Consolidated provider integration now mirrored in current layout

- Adapters and normalizers are authoritative in:
  - `@agentsy/core/adapters`
  - `@agentsy/core/normalizers`
  - `@agentsy/core/universal-client`
- Preserve tool converter contracts and provider-specific normalization quirks without leaking provider coupling into orchestration layers.

---

## Ecosystem Integration Analysis (2026-05-14)

### CRITICAL: Memory Compression Integration

**Caveman Memory File Compression Pattern**

- **Rationale:** Agent context windows bloated with memory files, causing unnecessary token consumption
- **Expected Benefits:** 46% context token reduction, preserved code/URLs/paths byte-level, longer effective context windows
- **Implementation Pattern:** Memory compression command to rewrite CLAUDE.md and project notes while preserving structured data
- **ROI:** 46% context cost reduction, validated real-world savings (36-60% across 5 files)

**Memory Compression Architecture:**

```typescript
// Memory compression integration in context management
interface MemoryCompressionArchitecture {
  // Command-based compression
  compression: {
    command: 'caveman-compress FILEPATH for memory files';
    preservation: 'Byte-level preservation of code/URLs/paths';
    reduction: '46% average reduction (36-60% range)';
  };

  // Context integration
  context: {
    targetFiles: ['CLAUDE.md', 'project-notes.md', 'preferences.md'];
    validation: 'Byte-level structure data preservation';
    reversible: 'Original files preserved as .original.md backup';
  };

  // Expected benefits
  benefits: {
    cost: '46% context token cost reduction';
    efficiency: 'Longer effective context windows';
    accuracy: '100% technical accuracy maintained';
  };
}
```

**Implementation Priorities:**

1. **Compression Command (Weeks 1-2):**
   - Implement `caveman-compress` command in core context
   - Byte-level preservation of structured data
   - File-based compression with backup

2. **Integration with Context Manager (Weeks 3-4):**
   - Integrate with context window management
   - Automatic compression triggers (REQ-007)
   - Validation and safety mechanisms

3. **CLI and Automation (Weeks 5-6):**
   - CLI command for manual compression
   - Automated background compression
   - Performance validation and monitoring

### Core Coordination with Honker

**Cross-Process Core Integration**

- **Rationale:** Core streaming and coordination benefits from honker pub/sub for cross-process events
- **Expected Benefits:** 1-5ms coordination latency vs polling, atomic operations, zero-downtime events
- **Integration Pattern:** honker pub/sub for streaming events, coordination between streaming layers
- **ROI:** 90% infrastructure savings vs custom broker, reliability improvements

**Core Coordination Architecture:**

```typescript
// Core coordination via honker for streaming layers
interface CoreCoordinationArchitecture {
  // honker pub/sub for streaming coordination
  pubSub: {
    channels: ['stream-start', 'stream-error', 'coordination-events'];
    latency: '1-5ms for cross-process streaming coordination';
    reliability: 'Atomic operations prevent lost streams';
  };

  // Integration with streaming layers
  integration: {
    sse: 'SSE parsing coordination across processes';
    normalization: 'Normalizer coordination and updates';
    processor: 'Processor state synchronization';
  };

  // Expected benefits
  benefits: {
    latency: 'Near-instant coordination vs current polling';
    reliability: 'Atomic stream operations prevent failures';
    efficiency: 'Zero-downtime streaming coordination';
  };
}
```

### Context Window Management Enhancement

**REQ-007 Compliance Enhancement**

- **Rationale:** Relationship between compression and effective context window management needs explicit guidance
- **Integration Pattern:** Memory compression feeds into automatic compression triggers
- **Expected Benefits:** Proactive context optimization, seamless integration with token economy

**Enhanced Context Management:**

```typescript
// Enhanced context management with compression
interface ContextManagement {
  // Automatic triggers
  triggers: {
    compression: 'Automatic compression when approaching limits';
    monitoring: 'Continuous context window monitoring';
    optimization: 'Token budget optimization';
  };

  // Compression integration
  integration: {
    memoryFiles: 'Memory file compression for context reduction';
    streaming: 'Stream compression for output reduction';
    combined: 'Combined 60% token cost reduction (output + memory)';
  };

  // Monitoring and optimization
  monitoring: {
    metrics: 'Context window usage tracking';
    alerts: 'Approaching limit warnings';
    optimization: 'Proactive optimization suggestions';
  };
}
```

### Auto-compaction Primitive

Auto-compaction is elevated from a memory-layer concern to a first-class runtime primitive. The runtime owns the compact cycle; core provides the `compact(session, context)` function that the PreCompact hook calls into.

### BASELINE_TOKENS Constant

Define `BASELINE_TOKENS` as a derived constant computed from model context window minus instruction overhead. This is the token budget available for task reasoning after instruction injection.
