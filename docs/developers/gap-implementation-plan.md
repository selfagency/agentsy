# Plan: LLM Stream Parser — Gap Implementation

After reviewing 40+ resources covering OpenAI, Claude, Ollama, Mistral, Gemini, and community projects (openai-partial-stream, claude-stream, Outlines, LangChain parsers), the following gaps were identified against the current codebase. All gaps were confirmed as priority by the user.

## TL;DR

The library has strong XML-based tool call extraction, thinking tag parsing, and basic JSON streaming, but lacks **provider-specific chunk normalization**, **native streaming tool call accumulation**, **enhanced partial JSON field tracking**, **broader JSON Schema validation**, **stream recovery**, **provider format config builders**, and **usage/token tracking**. This plan adds seven capabilities across four phases, each independently verifiable.

---

## Phase 1: Provider Chunk Normalizers (Foundation)

Transform-only normalizers that convert raw provider-specific JSON objects to the library's `StreamChunk` type. No HTTP client — users bring their own.

### Step 1.1: Define normalizer interface and types

- Create `src/normalizers/types.ts` with:
  - `NormalizerResult` type: `{ chunk: StreamChunk; usage?: UsageInfo; rawEvent?: unknown }`
  - `UsageInfo` type: `{ inputTokens?: number; outputTokens?: number; totalTokens?: number }`
  - `NativeToolCallDelta` type: `{ index: number; id?: string; name?: string; argumentsDelta?: string }`
  - Extend `StreamChunk` (or create `NormalizedChunk`) to include optional `usage` and `nativeToolCallDeltas` fields

### Step 1.2: OpenAI Chat Completions normalizer

- Create `src/normalizers/openai.ts`
- Function: `normalizeOpenAIChatChunk(chunk: unknown): NormalizerResult`
- Map `choices[0].delta.content` → `content`
- Map `choices[0].delta.tool_calls` → `tool_calls` (native format) AND capture argument deltas in `nativeToolCallDeltas`
- Map `choices[0].delta.role` (ignore, just track)
- Extract `usage` from final chunk when `stream_options.include_usage` is set
- Handle `finish_reason: "tool_calls" | "stop" | "length"` → `done`

### Step 1.3: OpenAI Responses API normalizer

- Create `src/normalizers/openaiResponses.ts`
- Function: `normalizeOpenAIResponseEvent(event: unknown): NormalizerResult`
- Map `response.output_text.delta` → `content`
- Map `response.function_call_arguments.delta` → `nativeToolCallDeltas`
- Map `response.completed` → `done: true`
- Handle `response.refusal.delta` as warning

### Step 1.4: Claude/Anthropic SSE normalizer

- Create `src/normalizers/anthropic.ts`
- Function: `normalizeAnthropicEvent(event: unknown): NormalizerResult`
- Map `content_block_delta` with `text_delta` → `content`
- Map `content_block_delta` with `thinking_delta` → `thinking`
- Map `content_block_delta` with `input_json_delta` → `nativeToolCallDeltas`
- Map `content_block_start` with `tool_use` type → capture tool name+id
- Map `message_delta` with `usage` → `usage`
- Map `message_stop` → `done: true`
- Handle `content_block_start/stop` events for index tracking

### Step 1.5: Ollama NDJSON normalizer

- Create `src/normalizers/ollama.ts`
- Function: `normalizeOllamaChatChunk(chunk: unknown): NormalizerResult`
- Map `message.content` → `content`
- Map `message.tool_calls` → `tool_calls` (complete per-chunk, not incremental)
- Handle thinking content embedded in `message.content` (Ollama emits `<think>...</think>` inline)
- Map `done: true` → `done: true`
- Extract duration/eval metrics from final chunk into `usage`
- Function: `normalizeOllamaGenerateChunk(chunk: unknown): NormalizerResult`
- Map `response` → `content`, `done` → `done`

### Step 1.6: Gemini normalizer

- Create `src/normalizers/gemini.ts`
- Function: `normalizeGeminiChunk(chunk: unknown): NormalizerResult`
- Map `candidates[0].content.parts[0].text` → `content`
- Map `candidates[0].content.parts` with `functionCall` type → `tool_calls`
- Map `usageMetadata` → `usage`
- Handle `finishReason` → `done`

### Step 1.7: Mistral normalizer

- Create `src/normalizers/mistral.ts`
- Function: `normalizeMistralChunk(chunk: unknown): NormalizerResult`
- Map `choices[0].delta.content` → `content` (OpenAI-compatible format)
- Map `choices[0].delta.tool_calls` → `tool_calls`
- Map `usage` → `usage`
- Handle `finish_reason` → `done`

### Step 1.8: Export and index

- Create `src/normalizers/index.ts` — re-export all normalizers
- Add `normalizers/` to `src/index.ts` star-export
- Write tests for each normalizer (`src/normalizers/normalizers.test.ts`)

**Relevant files:**

- `src/processor/LLMStreamProcessor.ts` — `StreamChunk` type to extend
- `src/processor/AccumulatedMessage.ts` — may need `usage` field
- `src/adapters/generic.ts` — `processStream` may accept normalizer

---

## Phase 2: Native Streaming Tool Call Accumulation

Support native JSON tool calls from OpenAI/Claude that arrive as incremental argument deltas, complementing the existing XML-based extraction.

### Step 2.1: Create ToolCallAccumulator

- Create `src/tool-calls/ToolCallAccumulator.ts`
- Class: `ToolCallAccumulator`
  - `addDelta(delta: NativeToolCallDelta): void` — accumulate partial JSON arguments by index
  - `getCompletedCalls(): NativeToolCall[]` — return tool calls whose arguments form valid JSON
  - `flush(): NativeToolCall[]` — force-complete any pending calls (attempt JSON parse/repair)
  - `reset(): void`
- Internal state: `Map<number, { id?: string; name: string; argumentsBuffer: string }>`
- `NativeToolCall` type: `{ id?: string; name: string; arguments: Record<string, unknown> }`
- Edge cases:
  - Name arrives in one delta, arguments in subsequent deltas
  - Multiple tool calls in parallel (by index)
  - Malformed JSON at flush time (attempt repair via `parseJson`)

### Step 2.2: Integrate into LLMStreamProcessor

- Add optional `accumulateNativeToolCalls: boolean` option to `ProcessorOptions` (default: true when `nativeToolCallDeltas` appear)
- When `StreamChunk` contains `nativeToolCallDeltas`, feed them to `ToolCallAccumulator`
- On `content_block_stop` equivalent (or `done`), emit completed calls as `tool_call` events
- Map completed `NativeToolCall` to existing `XmlToolCall` interface (with `format: 'native-json'` added to discriminant)
- Extend `XmlToolCall` type: `format: 'bare-xml' | 'json-wrapped' | 'native-json'`

### Step 2.3: Tests

- Test incremental argument accumulation across chunks
- Test multiple parallel tool calls by index
- Test flush with incomplete JSON (repair)
- Test mixed XML + native tool calls in same stream
- Test name arriving separately from arguments

**Relevant files:**

- `src/tool-calls/extractXmlToolCalls.ts` — `XmlToolCall` type to extend
- `src/processor/LLMStreamProcessor.ts` — integrate accumulator
- `src/processor/AccumulatedMessage.ts` — accumulated tool calls already here

---

## Phase 3: Enhanced Streaming & Recovery

### Step 3.1: Field-by-field partial JSON streaming

- Enhance `src/structured/streamJson.ts`:
  - Add `StreamJsonField` type: `{ path: string; value: unknown; isComplete: boolean }`
  - Add optional `emitFields: boolean` option to `StreamJsonOptions`
  - When enabled, diff successive partial parses to detect newly populated fields
  - Yield `StreamJsonResult<T>` extended with `newFields: StreamJsonField[]`
  - Support array item emission: when an array grows, emit each new complete item
  - Add `status: 'partial' | 'completed'` to `StreamJsonResult` (currently uses `isPartial: boolean` — keep both for backward compat)

### Step 3.2: Stream error recovery utilities

- Create `src/recovery/index.ts` with:
  - `captureStreamState(processor: LLMStreamProcessor): StreamSnapshot` — capture accumulated content, thinking, tool calls, and processor options for resumption
  - `buildContinuationPrompt(snapshot: StreamSnapshot, options?: { provider?: 'openai' | 'anthropic' | 'ollama' }): string | Message[]` — generate provider-appropriate continuation prompt
    - For Claude 4.5 and earlier: prepend partial assistant message
    - For Claude 4.6+: add user message with "continue from where you left off"
    - For OpenAI: append partial assistant message
  - `StreamSnapshot` type: `{ content: string; thinking: string; toolCalls: XmlToolCall[]; options: ProcessorOptions; timestamp: number }`

### Step 3.3: Usage/token tracking

- Add `usage?: UsageInfo` to `ProcessedOutput` and `AccumulatedMessage`
- In `LLMStreamProcessor.process()`, if `StreamChunk` contains `usage`, merge into accumulated usage
- Add `usage` event to `StreamEventMap`: `usage: (usage: UsageInfo) => void`
- Emit `usage` event when usage data is received

### Step 3.4: Tests

- Test field-by-field emission with nested objects and arrays
- Test array item streaming (each complete item emitted individually)
- Test stream state capture and continuation prompt generation
- Test usage accumulation from multiple chunks

**Relevant files:**

- `src/structured/streamJson.ts` — enhance with field tracking
- `src/processor/LLMStreamProcessor.ts` — add usage tracking
- `src/processor/AccumulatedMessage.ts` — add usage field

---

## Phase 4: Schema Validation & Format Builders

### Step 4.1: JSON Schema validation improvements

- Enhance `src/structured/validateJsonSchema.ts`:
  - Add `oneOf` support: validate against each sub-schema, exactly one must match
  - Add `anyOf` support: validate against each sub-schema, at least one must match
  - Add `allOf` support: validate against all sub-schemas, all must match
  - Add `not` support: validate sub-schema does NOT match
  - Add `const` support: value must equal const exactly
  - Add `$defs` / `$ref` support: resolve local references (`#/$defs/Foo`)
  - Add string `format` validation for common formats: `date`, `date-time`, `email`, `uri`, `uuid`, `ipv4`, `ipv6`
    - Use simple regex patterns (not full RFC compliance — pragmatic)
  - Keep existing depth/key limits and ReDoS protections
  - **Not adding:** remote `$ref` resolution (security risk — SSRF)

### Step 4.2: Provider format builders

- Create `src/structured/providerFormats.ts` with:
  - `buildOpenAIResponseFormat(schema: Record<string, unknown>, options?: { name?: string; strict?: boolean }): object`
    - Returns `{ type: "json_schema", json_schema: { name, strict, schema } }`
  - `buildOllamaFormat(schema: Record<string, unknown>): object | "json"`
    - Returns the JSON schema directly (Ollama's `format` parameter accepts JSON Schema or `"json"`)
  - `buildGeminiResponseSchema(schema: Record<string, unknown>): object`
    - Returns Gemini-formatted `response_schema` with `responseMimeType: "application/json"`
  - These are pure data transformers — no API calls

### Step 4.3: Tests

- Test oneOf/anyOf/allOf/not validation with various schemas
- Test $ref/$defs resolution (including circular ref detection → error)
- Test const validation
- Test string format validation (valid + invalid cases per format)
- Test provider format builder output shapes
- Test format builders with complex nested schemas

**Relevant files:**

- `src/structured/validateJsonSchema.ts` — extend validation
- `src/structured/index.ts` — export new builders

---

## Verification

1. `pnpm run check-types` — must pass with no errors
2. `pnpm run test` — all existing + new tests pass
3. Manual review: each normalizer tested with real provider response fixtures (captured from API docs in tests)
4. Verify backward compatibility: no breaking changes to existing public API
   - `XmlToolCall.format` adding `'native-json'` is additive
   - `StreamChunk` extensions are optional fields
   - `StreamJsonResult` additions are backward-compatible
5. Verify exports: `import { normalizeOpenAIChatChunk, ... } from 'llm-stream-parser'` works

---

## Decisions

1. **Transform-only normalizers** — no HTTP clients, SSE parsers, or WebSocket support. Users bring their own transport.
2. **No remote $ref resolution** — security risk (SSRF). Only local `#/$defs/` references.
3. **NativeToolCall mapped to extended XmlToolCall** — avoids proliferating types; `format` discriminant distinguishes origin.
4. **Backward compatible** — all new fields are optional; no breaking changes to existing APIs.
5. **No Claude signature verification** — out of scope (cryptographic verification belongs in a provider SDK).
6. **No WebSocket support** — transport layer is out of scope.
7. **String format validation is pragmatic** — simple regex, not full RFC compliance.

## Further Considerations

1. **Should normalizers validate input shape?** Recommendation: Yes, use lightweight runtime type checks (typeof/in) and return `null` for unrecognizable chunks rather than throwing. This allows the processor pipeline to skip unknown events gracefully.
2. **Should `ToolCallAccumulator` use `parseJson` for repair?** Recommendation: Yes, reuse existing `parseJson` with `repairIncomplete: true` for flush scenarios where the stream was interrupted mid-argument.
3. **Phase ordering**: Phases 1 and 4 are independent and can be developed in parallel. Phase 2 depends on Phase 1 types. Phase 3 is independent of Phases 1-2 but the usage tracking uses types from Phase 1.
