# @agentsy/core — Implementation Plan

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
- **`StructuredOutput`**: JSON repair and streaming validation.
- **`Recovery`**: Graceful handling of truncated streams or network interruptions.
- **`ContextManagement`**: Advanced window management with automatic compression triggers (REQ-007).

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
6. **Structured output parsing** — JSON parse/repair and streaming validation for tool results and structured response modes.
7. **Recovery** — stream recovery on partial failures; retry logic at the normalizer layer.
8. **Event Emission** — `LLMStreamProcessor` must emit: `ContextWindowWillOverflow`, `ChatCompressed`, `LoopDetected`, `LoopExceeded`, `Citation`, `Retry`, `InvalidStream` (REQ-006).
9. **Provider Routing** — Ensure `openaiResponses` provider is routable through normalizers and processor pipeline (REQ-020).

---

## Architecture Decision Snapshot (migrated from `plan/DECISION-LOG.md`)

- Adopt layered architecture with clear package boundaries and avoid monolithic agent abstraction.
- Keep core parsing/processing primitives separate and stable (`types`, `xml-filter`, `context`, `formatting`, `sse`, `thinking`, `structured`, `tool-calls`, `processor`, `recovery`).
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
