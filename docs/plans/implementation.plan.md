# Plan: llm-stream-parser Enhancement — 5-Codebase Synthesis

**TL;DR**: Five codebases (Atuin TUI, Claude Code, TanStack AI, Vercel AI SDK, opencode) reveal 12 concrete capability gaps in `llm-stream-parser`. The enhancements are organized into 7 phases covering: type system enrichment, tool call streaming lifecycle, pipeline composition, agent loop primitives, renderer architecture overhaul, event-sourced UI state, and observability. Each phase is independently releasable. No phase breaks existing public API.

---

## Research Findings Summary

| Capability                     | Atuin | Claude Code     | TanStack            | Vercel                      | opencode                | **Us**                 |
| ------------------------------ | ----- | --------------- | ------------------- | --------------------------- | ----------------------- | ---------------------- |
| Finish reason surfaced         | ✅    | ✅              | ✅                  | ✅ typed enum               | ✅ per-step             | ❌ discarded           |
| Tool call IDs threaded         | ✅    | ✅              | ✅                  | ✅                          | ✅                      | ❌ lost at XmlToolCall |
| Partial tool arg streaming     | ✅    | ✅              | ✅ `ToolCallState`  | ✅ `tool-input-delta`       | partial                 | ❌                     |
| Mid-stream tool emission       | ✅    | ✅              | ✅                  | ✅ concurrent               | ✅ on `tool-call` event | ❌ only on `done`      |
| Multi-turn tool result builder | n/a   | ✅              | ✅                  | ✅                          | ✅                      | ❌                     |
| TransformStream pipeline       | —     | —               | middleware          | ✅ `experimental_transform` | —                       | ❌                     |
| Agent loop primitives          | FSM   | QueryLoop       | `AgentLoopStrategy` | `StopCondition`             | `SessionRetry`          | ❌                     |
| Renderer takes StreamChunk     | ✅    | ✅              | ✅                  | ✅                          | ✅                      | ❌ raw text only       |
| DelayedPromise metadata        | —     | —               | —                   | ✅                          | ✅ promises             | ❌                     |
| Event-sourced UI state         | FSM   | —               | `UIMessage.parts`   | `UIMessageChunk`            | SessionEntryStepper     | ❌                     |
| Per-step usage/cost            | —     | —               | —                   | ✅ `StepResult`             | ✅ `StepFinishPart`     | ❌                     |
| Stall detection                | —     | AbortController | —                   | —                           | ✅ per-chunk timer      | ❌                     |

---

## Phases

### Phase 1 — Type System Enrichment

**Scope**: Add `finishReason`, tool call IDs, step metadata, and `ToolCallState` to the core type layer. Zero behavioral changes — purely additive to `StreamChunk`, `ProcessedOutput`, `XmlToolCall`, and `OutputPart`.

**Inspired by**: Vercel `FinishReason`, TanStack `ToolCallState`, opencode `StepFinishPart`

**Steps**:

1. Add `finishReason?: FinishReason` to `StreamChunk` — update all 9 normalizers to populate it (`stop`, `length`, `tool-calls`, `content-filter`, `other`, `error`)
2. Add `finishReason?: FinishReason` to `ProcessedOutput` — propagate from last chunk with `done: true`
3. Add `id?: string` to `XmlToolCall` — thread from `NativeToolCallDelta.id` through `ToolCallAccumulator` and `mapAccumulatedNativeCalls()`
4. Add `ToolCallState` enum: `'awaiting-input' | 'input-streaming' | 'input-complete' | 'output-available' | 'output-error'` to `src/tool-calls/types.ts` (new file)
5. Add `state: ToolCallState` to `ToolCallPart` in `OutputPart` union
6. Add `tool_call_delta` variant to `OutputPart`: `{ type: 'tool_call_delta'; id: string; name: string; argumentsDelta: string; index: number }`
7. Add `stepIndex?: number` and `stepUsage?: UsageInfo` to `ProcessedOutput` — so per-step accumulation is possible
8. Add `FinishReason` named export to index.ts and index.ts

**Relevant files**:

- LLMStreamProcessor.ts — `StreamChunk`, `ProcessedOutput`, `buildOutput()`
- extractXmlToolCalls.ts — `XmlToolCall` interface
- openai.ts, anthropic.ts, gemini.ts, all normalizers — add `finishReason` population
- types.ts — `OutputPart`, `ToolCallPart`
- `src/tool-calls/types.ts` — **create new file** for `ToolCallState`, `FinishReason`

**Verification**: `task check-types`, update existing normalizer tests to assert `finishReason` on final chunk, new unit tests for each new type variant

---

### Phase 2 — Tool Call Streaming Lifecycle

**Scope**: Emit `tool_call_delta` parts mid-stream (as argument chunks arrive), emit completed native calls without waiting for `done: true`, and expose streaming partial args through the existing event system.

**Inspired by**: TanStack `TOOL_CALL_ARGS` events, Vercel `tool-input-delta` + concurrent execution, Claude Code `StreamingToolExecutor.getCompletedResults()`, opencode `tool-input-delta` → no-op then `tool-call` triggers execution

**Steps**:

1. In `LLMStreamProcessor.process()`: call `nativeAccumulator.getCompletedCalls()` on every chunk (not just `done: true`) — emit completed calls immediately via `emitOutput()` and `tool_call` event
2. Emit `tool_call_delta` `OutputPart` for every `NativeToolCallDelta` that has `argumentsDelta` — before the call is complete — so consumers can render partial args
3. Track `ToolCallState` transitions in `LLMStreamProcessor`: start `awaiting-input` → on first delta `input-streaming` → on complete call `input-complete`. Set on emitted `ToolCallPart`
4. Thread tool call `id` all the way: `NativeToolCallDelta.id` → `ToolCallAccumulator` slot → `XmlToolCall.id` → `ToolCallPart.call.id`
5. Add `tool_call_delta` to `StreamEventMap` so event listeners receive partial arg updates
6. Add `onToolCallDelta?: (delta: ToolCallDeltaPart) => void` to `BaseRendererOptions`

**Relevant files**:

- LLMStreamProcessor.ts — `process()`, `buildOutput()`, `emitOutput()`, `StreamEventMap`
- ToolCallAccumulator.ts — `getCompletedCalls()`, `flush()`
- types.ts — `BaseRendererOptions`, `OutputPart`

**Verification**: New tests: feed 3 `nativeToolCallDeltas` for call 0, then 2 for call 1 — verify call 0 emitted before call 1 completes; verify `tool_call_delta` parts emitted for each delta

---

### Phase 3 — Multi-turn Tool Result Builders

**Scope**: Utilities to construct properly-formatted tool result messages for multi-turn conversations, for all major provider formats. This is the missing piece that makes the parser usable for agentic loops.

**Inspired by**: opencode `toModelMessagesEffect()`, Vercel `tool()` result injection, Claude Code `queryLoop` `toolUseContext`

**Steps**:

1. Create `src/tool-calls/buildToolResultMessage.ts` with `buildToolResultMessage(toolCall: XmlToolCall, result: string | object, options?: { isError?: boolean }): ToolResultMessage`
2. `ToolResultMessage` is a provider-agnostic format: `{ role: 'tool'; tool_call_id: string; name: string; content: string }`
3. Create `buildAnthropicToolResult(toolCall, result)` → `{ role: 'user'; content: [{ type: 'tool_result'; tool_use_id; content }] }`
4. Create `buildOpenAIToolResult(toolCall, result)` → `{ role: 'tool'; tool_call_id; content }`
5. Create `buildGeminiToolResult(toolCall, result)` → `{ role: 'user'; parts: [{ functionResponse: { name; response } }] }`
6. Export `buildToolResultMessage`, `buildAnthropicToolResult`, `buildOpenAIToolResult`, `buildGeminiToolResult` from index.ts
7. Add `src/tool-calls/buildToolResultMessage.test.ts`

**Relevant files**:

- `src/tool-calls/buildToolResultMessage.ts` — **create new**
- index.ts — add exports
- package.json — no new exports needed (already under `./tool-calls`)

**Verification**: Unit tests for each format; verify IDs are correctly threaded; test error case with `isError: true`

---

### Phase 4 — TransformStream Pipeline Composition

**Scope**: Open an extension point in the processor pipeline via `TransformStream[]` composition. Enables consumer-supplied transforms (output smoothing, content filtering, rate limiting) without forking the library.

**Inspired by**: Vercel `experimental_transform: Arrayable<StreamTextTransform>`, TanStack middleware composition, `smoothStream()` built-in transform

**Steps**:

1. Create `src/pipeline/transform.ts`: `PipelineTransform = TransformStream<OutputPart, OutputPart>` type alias; `createSmoothStream(options?: { delayMs?: number; chunkSize?: number }): PipelineTransform` — buffers and throttles text deltas for visual smoothness
2. Create `createThinkingFilter(): PipelineTransform` — strips `thinking` parts (for consumers that always suppress)
3. Create `createToolCallFilter(toolNames: string[]): PipelineTransform` — emits only tool calls matching the given names
4. Add `transforms?: PipelineTransform[]` to `LLMStreamProcessorOptions` — chained via `ReadableStream.pipeThrough()` on the internal parts stream
5. Expose `processor.partsStream: ReadableStream<OutputPart>` getter — allows external consumers to compose their own transform chains
6. Add `src/pipeline/transform.ts` to barrel exports + tsup entry points

**Relevant files**:

- LLMStreamProcessor.ts — add `transforms` option, `partsStream` getter
- `src/pipeline/transform.ts` — **create new** (currently pipeline exists as `pipeline.ts`)
- index.ts — add transform exports
- tsup.config.ts — no new entry needed (already `./pipeline`)

**Verification**: Test that `createSmoothStream(50)` delays text deltas; test that `createThinkingFilter` strips `thinking` parts; test that custom transforms receive and can mutate parts

---

### Phase 5 — Agent Loop Primitives

**Scope**: `createAgentLoop()` factory for multi-step agentic execution with configurable stop conditions, stitchable streams, doom-loop detection, and per-step callbacks.

**Inspired by**: Vercel `createStitchableStream()` + `StopCondition` + `onStepFinish`, opencode doom-loop detection, TanStack `AgentLoopStrategy`, Claude Code `queryLoop` `State` object

**Steps**:

1. Create `src/agent/` directory with `createAgentLoop.ts`, `stopConditions.ts`, `types.ts`, `index.ts`
2. `StopCondition = (state: AgentLoopState) => boolean` type
3. Built-in stop conditions in `stopConditions.ts`:
   - `isStepCount(n: number): StopCondition`
   - `hasNoToolCalls(): StopCondition`
   - `finishReasonIs(...reasons: FinishReason[]): StopCondition`
   - `detectDoomLoop(threshold?: number): StopCondition` — identical `(name, serialized_args)` n times triggers
4. `AgentLoopState`: `{ steps: StepResult[]; stepIndex: number; lastOutput: ProcessedOutput; toolCallCount: number; consecutiveIdenticalCalls: number }`
5. `StepResult`: `{ output: ProcessedOutput; toolCalls: XmlToolCall[]; finishReason?: FinishReason; usage?: UsageInfo }`
6. `createAgentLoop(options: AgentLoopOptions): AgentLoopHandle`:
   - `options.execute(messages): AsyncIterable<StreamChunk>` — caller supplies the LLM call
   - `options.stopWhen: StopCondition | StopCondition[]` — all must pass to continue
   - `options.onStep?: (result: StepResult) => void | Promise<void>`
   - `options.maxSteps?: number` — hard cap (default 20)
   - `options.buildToolResultMessages(toolCalls): Promise<StreamChunk[]>` — caller injects results
7. `AgentLoopHandle`: `{ run(initialMessages): AsyncGenerator<OutputPart>; abort(): void }`
8. Add `src/agent/` to tsup + package.json exports as `./agent`

**Relevant files**:

- `src/agent/` — **create new directory**
- src/tool-calls/buildToolResultMessage.ts — used by agent loop
- package.json — add `./agent` export
- tsup.config.ts — add `src/agent/index.ts` entry

**Verification**: Integration test: mock LLM returning tool calls on step 1, results on step 2, text on step 3 — verify 3 steps emitted; verify `isStepCount(2)` stops after step 2; verify doom loop fires after 3 identical calls

---

### Phase 6 — Renderer Architecture Overhaul

**Scope**: Renderers currently only accept raw text strings via `write(chunk: string)`. This prevents them from receiving pre-normalized `StreamChunk` objects (which carry thinking, tool calls, done signals, usage, finishReason). Overhaul the renderer interface to accept both, and expose `finishReason`/`usage` via end callbacks.

**Inspired by**: Vercel `UIMessageStreamWriter`, TanStack `StreamProcessorEvents` callbacks, opencode `PartDelta` bus events, Claude Code per-tool rendering methods

**Steps**:

1. Add `writeChunk(chunk: StreamChunk): Promise<void>` to `RendererHandle` — alongside existing `write(text: string)` (backward compatible)
2. Add to `BaseRendererOptions`:
   - `onFinish?: (reason: FinishReason, usage?: UsageInfo) => void` — fires from `end()`
   - `onStep?: (stepIndex: number, usage?: UsageInfo) => void` — fires when `stepIndex` changes
   - `onToolCallDelta?: (delta: ToolCallDeltaPart) => void` — partial arg streaming
3. Update all 4 renderers to implement `writeChunk()` — internally feeds structured fields (`thinking`, `tool_calls`, `done`, `usage`, `finishReason`) directly without re-parsing
4. Update VS Code renderer `writeChunk()` to call `onFinish` with `finishReason` and `usage` when `chunk.done === true`
5. Add streaming partial tool call display in VS Code renderer: when `onToolCallDelta` fires, render `stream.progress("⚙️ ${name}(${partialArgs}…)")`
6. Update `createVSCodeCopilotAdapter` in vscode.ts to mirror same interface changes

**Relevant files**:

- types.ts — `RendererHandle`, `BaseRendererOptions`
- createPlainTextRenderer.ts
- createCliRenderer.ts
- createStreamingMarkdownRenderer.ts
- createVSCodeChatRenderer.ts
- vscode.ts

**Verification**: Tests for each renderer: `writeChunk({ thinking: '...', content: '...', done: false })` and verify correct routing without raw-text wrapping; test `onFinish` fires on `writeChunk({ done: true, finishReason: 'stop', usage: {...} })`

---

### Phase 7 — Event-Sourced UI State Machine

**Scope**: A pure, framework-agnostic event-sourcing state machine that reconstructs a `Conversation` (array of typed `Message` with `Part[]`) from a stream of `StreamEvent`s. Renderers and UI frameworks can subscribe and drive rendering from this — no custom integration per framework.

**Inspired by**: opencode `SessionEntryStepper` + `SessionEvent.Event.match()` + immer `produce()`, TanStack `UIMessage.parts` + `MessagePart` union, Vercel `UIMessageChunk` wire format

**Steps**:

1. Create `src/ui/` directory with `types.ts`, `eventSourcing.ts`, `index.ts`
2. `UIMessage` type: `{ id: string; role: 'user' | 'assistant'; parts: UIMessagePart[]; createdAt: Date }`
3. `UIMessagePart` union: `TextPart`, `ThinkingPart`, `ToolCallPart` (with `state: ToolCallState`, `argumentsDelta`, `result?`), `StepPart`, `ErrorPart`
4. `UIConversation`: `{ messages: UIMessage[]; status: 'idle' | 'streaming' | 'error'; currentStepIndex: number; totalUsage: UsageInfo }`
5. `ConversationEvent` discriminated union emitted by `LLMStreamProcessor` (new `StreamEventMap` entries): `text_started`, `text_delta`, `text_ended`, `thinking_started`, `thinking_delta`, `thinking_ended`, `tool_input_started`, `tool_input_delta`, `tool_input_complete`, `step_started`, `step_finished`, `stream_done`, `stream_error`
6. `applyConversationEvent(state: UIConversation, event: ConversationEvent): UIConversation` — pure function (no mutation), returns new state
7. `createConversationStore(options?)`: wraps processor + applies events → `{ state: UIConversation; subscribe(fn): Unsubscribe; dispatch(event): void }`
8. Export from `src/ui/index.ts` and add `./ui` to tsup + package.json

**Relevant files**:

- `src/ui/` — **create new directory**
- LLMStreamProcessor.ts — extend `StreamEventMap` with granular `ConversationEvent` types
- package.json — add `./ui` export
- tsup.config.ts — add `src/ui/index.ts` entry

**Verification**: Test `applyConversationEvent` pure function: apply sequence of events and verify final `UIConversation` state matches expected structure; test `createConversationStore` subscription fires on each event

---

## Relevant Files Summary

| Phase | New Files                                        | Modified Files                                                             |
| ----- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| 1     | `src/tool-calls/types.ts`                        | All 9 normalizers, `LLMStreamProcessor.ts`, `renderers/types.ts`, index.ts |
| 2     | —                                                | `LLMStreamProcessor.ts`, `ToolCallAccumulator.ts`, `renderers/types.ts`    |
| 3     | `src/tool-calls/buildToolResultMessage.ts`, test | index.ts                                                                   |
| 4     | `src/pipeline/transform.ts`                      | `LLMStreamProcessor.ts`, index.ts                                          |
| 5     | `src/agent/` (4 files + tests)                   | package.json, tsup.config.ts                                               |
| 6     | —                                                | All 4 renderers, `renderers/types.ts`, `adapters/vscode.ts`                |
| 7     | `src/ui/` (3 files + tests)                      | `LLMStreamProcessor.ts`, package.json, tsup.config.ts                      |

---

## Verification (Cross-Phase)

1. `task check-types` — zero errors throughout
2. `task unit-tests` — all 567 existing tests still pass after each phase
3. New test count target: +80–120 tests across 7 phases
4. `task compile` — 21 existing + 2 new entry points build cleanly
5. Integration test: full agent loop (phases 1+2+3+5) executing 2 tool calls across 2 steps, all `finishReason`/`usage` surfaced

---

## Decisions

- **No breaking changes**: `write(chunk: string)` stays on `RendererHandle`; `writeChunk` is additive
- **No new required deps**: all phases zero new runtime dependencies
- **`finishReason` as string union** (not enum class) — matches TypeScript pattern in this codebase
- **Agent loop is pure utility** — does not couple to any HTTP client or provider SDK
- **`src/ui/` state machine is immutable** (pure function per event) — no framework reactivity built in; React/Svelte/Vue/Solid adapters can wrap `subscribe()` externally
- **Excluded from this plan**: AG-UI protocol conformance, OTel integration, multi-modal support, WebSocket tool execution (all out of scope for this library's zero-dep charter)

---

## Further Considerations

1. **Phase ordering**: Phases 1 → 2 → 3 are tightly coupled (each builds on the prior). Phases 4, 5, 6, 7 are independent and can run in parallel once Phase 1 is merged.
2. **`ToolCallState` on XML tool calls**: XML tool calls extracted from text don't have a natural streaming lifecycle. They're extracted from fully-formed text. Should `state` on `ToolCallPart` default to `input-complete` for XML-extracted calls? Recommendation: yes — avoids null checks.
3. **`src/tool-calls/types.ts` vs existing files**: `ToolCallState` and `FinishReason` could live in LLMStreamProcessor.ts. Recommendation: new `types.ts` to avoid circular imports since renderers need these types but should not import from processor.
