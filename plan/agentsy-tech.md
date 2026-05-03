---
goal: '@agentsy platform — technical design with full TypeScript API surface'
version: '1.0'
date_created: '2026-05-02'
last_updated: '2026-05-02'
owner: 'selfagency'
status: 'Planned'
tags: ['technical', 'api', 'typescript', 'agentsy', 'architecture']
---

# @agentsy Platform — Technical Design

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Complete technical specification for all 15 `@agentsy/*` packages. Includes TypeScript type signatures, data flow diagrams, module architecture, and implementation notes with primary source citations.

---

## 1. Requirements & Constraints

- **CON-001**: Node.js ≥ 22. ESM-first. `.js` extensions in relative imports.
- **CON-002**: TypeScript strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, ES2022. Zero `any`.
- **CON-003**: `@agentsy/core` zero runtime deps.
- **CON-004**: pnpm workspaces + turbo + tsup dual-output + vitest per package.
- **CON-005**: Factory functions (`create*`) over direct `new`.
- **CON-006**: Options objects with `??` defaults; `DEFAULT_*` constants exported.

---

## 2. Package Dependency Graph

```text
@agentsy/core (zero deps)
    ├── @agentsy/normalizers  (→ core)
    ├── @agentsy/processor    (→ core, normalizers)
    │       ├── @agentsy/ag-ui    (→ core, processor)
    │       └── @agentsy/renderers (→ core, processor)          ← standalone; no agent-layer deps
    │               ├── @agentsy/renderers/plain    (zero peer deps)
    │               ├── @agentsy/renderers/cli      (peer: cli-markdown)
    │               ├── @agentsy/renderers/ink      (peer: ink, react)
    │               ├── @agentsy/renderers/vscode   (duck-typed; no vscode dep)
    │               └── @agentsy/renderers/browser  (peer: streaming-markdown, dompurify)
    ├── @agentsy/session      (→ core)
    ├── @agentsy/cost-tracker (→ core)
    └── @agentsy/agent        (→ core, processor, session, cost-tracker, context-manager)
            ├── @agentsy/runtime  (→ core, agent)
            ├── @agentsy/context-manager (→ core, processor)
            ├── @agentsy/adapters (→ core, agent)
            ├── @agentsy/mcp      (→ core, agent)
            ├── @agentsy/providers (→ core, normalizers)
            └── @agentsy/memory   (→ core, agent, session)
                    └── @agentsy/retrieval (→ core, memory)

@agentsy/telemetry (→ core, optional peer dep for all)
@selfagency/llm-stream-parser (shim → core, normalizers, processor, renderers, agent, adapters, ag-ui)

Future product-layer packages (see agentsy-standalone-v1.md):
    @agentsy/renderer-gui    (→ renderers — DisplayPort over Electron IPC / Tauri commands / WebView)
    @agentsy/extension-vscode (→ agent, renderers/vscode, mcp — VS Code Copilot chat participant)
    @agentsy/desktop          (→ agent, renderer-gui — Electron/Tauri desktop app factory)
```

**CON-006 compliance**: `@agentsy/core` has no `@agentsy/*` dependencies.
**REQ-021 compliance**: Acyclic dependency graph; installing any single leaf pulls only its ancestors.

---

## 3. Data Flow Architecture

### 3.1 Stream Processing Pipeline

```text
Raw HTTP response body (ReadableStream<Uint8Array>)
    │
    ▼
@agentsy/normalizers — NormalizerAdapter
    │  parseChunk(chunk: Uint8Array): StreamDelta[]
    │  Provider-specific wire format → internal StreamDelta
    │
    ▼
@agentsy/processor — LLMStreamProcessor
    │  process(stream, options): AsyncIterable<ProcessorEvent>
    │  Per-message state: Map<messageId, MessageStreamState>
    │  Per-tool-call: Map<toolCallId, ToolCallStreamState>
    │  Lazy assistant message creation (first content chunk)
    │
    ▼
ProcessorEvent stream
    ├── TextDelta, ThinkingDelta, ToolCallStart, ToolCallDelta,
    │   ToolCallEnd, ToolCallResult, MessageComplete,
    │   ContextWindowWillOverflow, ChatCompressed, LoopDetected,
    │   LoopExceeded, Citation, Retry, InvalidStream
    │
    ├── → @agentsy/ag-ui — AGUIAdapter
    │       Converts ProcessorEvent → AG-UI protocol events
    │       TOOL_CALL_END dual role (args-final vs result-inline)
    │       MESSAGES_SNAPSHOT for session resume
    │
    └── → @agentsy/adapters — GenericAdapter / VSCodeAdapter
            Consumer-facing normalized event subscription
```

### 3.2 Agent Loop Data Flow

```text
User messages (UIMessage[])
    │
    ▼
@agentsy/agent — createAgentLoop()
    │
    ├─ prepareStep() hook fires before each LLM call
    │   └─ can swap model, tools, instructions per step (SRC-7 vercel/ai)
    │
    ├─ @agentsy/context-manager — ContextManager.check()
    │   └─ token budget check → auto-compact if threshold exceeded
    │   └─ skip if isToolCallActive: true (SRC-2 nanobot)
    │
    ├─ LLM call → @agentsy/normalizers + @agentsy/processor
    │
    ├─ Tool calls dispatched → @agentsy/runtime — ToolExecutor
    │   ├─ ApprovalEngine.evaluate(toolCall)
    │   │   ├─ PreToolUse hooks (SRC-1 Claude Code, fires before policy)
    │   │   ├─ alwaysDenyRules → alwaysAllowRules → alwaysAskRules
    │   │   └─ Returns: ApprovalResult (allow|ask|deny|plan)
    │   │       ask/plan → returns ApprovalRequired (not throws)
    │   │
    │   └─ executeAll(calls, { concurrency, signal })
    │       → deterministic result ordering
    │       → repairToolCall() on malformed args (SRC-7 vercel/ai)
    │
    ├─ StopCondition predicates evaluated after each step
    │   isStepCount(n) | hasToolCall(...) | untilFinishReason([...])
    │   combineStrategies([...]) — OR composition
    │   Pass full loop state: { steps, messages, finishReason }
    │
    ├─ @agentsy/session — FileSystemSessionStore
    │   ├─ User turn: await save() (blocking — SRC-1/SRC-2)
    │   ├─ Assistant turn: enqueue (fire-and-forget ordered)
    │   └─ Atomic write: .tmp → verify → rename (SRC-2 nanobot)
    │
    └─ @agentsy/memory (optional) — MemoryEngine
        ├─ startTask() at loop start
        ├─ Retrieved context injected as <memory_context> XML
        └─ endTask() at loop end → wiki synthesis trigger
```

### 3.3 Memory Architecture (3-Layer)

```text
Agent turn events
    │
    ▼
Layer 0: RawEventLog (append-only JSONL)
    ~/.agentsy/sessions/<sessionId>/events.jsonl
    .cursor        ← ContextManager read position (SRC-2 nanobot)
    .dream_cursor  ← MemoryLifecycle synthesis read position
    │
    ▼ (ContextManager triggers when .cursor lags > threshold)
Layer 1: WikiStore (synthesized wiki pages)
    ~/.agentsy/wiki/
    ├── entities/       ← USER.md equivalent (SRC-2 nanobot)
    ├── concepts/       ← MEMORY.md equivalent
    ├── synthesis/      ← SOUL.md + cross-cutting summaries
    └── sources/        ← raw source citations
    │
    ▼ (MemoryLifecycle.endTask() triggers synthesis + indexing)
Layer 2: VectorIndex (libSQL/Turso)
    ~/.agentsy/vectors.db
    ├── wiki_pages table (id, category, title, content, embedding[1536])
    └── FTS5 virtual table wiki_fts (optional, ADR-013)

Retrieval path:
    memory_search(query) → embed(query) → cosine similarity → top-K pages
                         → <memory_context> XML injection (REQ-019)
```

---

## 4. Package-by-Package API Design

### 4.1 `@agentsy/core`

**Zero runtime dependencies. Foundational stream primitives.**

```typescript
// ─── Core Types ───────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ModelMessage {
  role: MessageRole;
  content: string | ContentPart[];
  name?: string;
  tool_call_id?: string;
}

export interface ContentPart {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'image';
  text?: string;
  tool_use_id?: string;
  tool_name?: string;
  input?: Record<string, unknown>;
  content?: string | ContentPart[];
  thinking?: string;
  image_url?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
  // Predicate methods (SRC-1 Claude Code Tool.ts)
  isConcurrencySafe?: () => boolean; // default: false
  isReadOnly?: () => boolean; // default: false
  isDestructive?: () => boolean; // default: false
  interruptBehavior?: () => 'cancel' | 'block'; // default: 'cancel'
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string (may be partial during streaming)
  parsedArguments?: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
  isError?: boolean;
}

// ─── XML Primitives ───────────────────────────────────────────────────────

export interface XmlStreamFilterOptions {
  stripTags?: string[];
  enforcePrivacyTags?: boolean; // default: true
  privacyTagNames?: string[]; // default: PRIVACY_TAG_NAMES
}

export function createXmlStreamFilter(options?: XmlStreamFilterOptions): {
  write(chunk: string): string;
  end(): string;
};

// Extracts <tool_call>...</tool_call> blocks from streamed XML
export function extractXmlToolCalls(xml: string): ToolCall[];

// Context XML pipeline (REQ-019)
export function splitLeadingXmlContext(text: string): { context: string; rest: string };
export function dedupeXmlContext(context: string): string;
export function stripXmlContextTags(context: string): string;

// ─── SSE ──────────────────────────────────────────────────────────────────

export function parseSSEStream(body: ReadableStream<Uint8Array>): AsyncIterable<string>;

// ─── Thinking Parser ──────────────────────────────────────────────────────

export class ThinkingParser {
  constructor(options?: { tagName?: string });
  addContent(chunk: string): void;
  flush(): { thinking: string; response: string };
}

// ─── Structured Output ────────────────────────────────────────────────────

export function parseJson<T = unknown>(text: string, options?: { schema?: ZodSchema<T>; repair?: boolean }): T;

export function autoRepairJson(malformed: string): string;

// ─── Tool Call System Prompt ──────────────────────────────────────────────

export function buildXmlToolSystemPrompt(tools: ToolDefinition[]): string;
```

---

### 4.2 `@agentsy/normalizers`

**Provider wire format → internal `StreamDelta`. Zero LLM provider SDK deps.**

```typescript
export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'mistral'
  | 'cohere'
  | 'ollama'
  | 'openaiResponses'
  | 'bedrock'
  | 'hfTgi';

export interface StreamDelta {
  type: 'text' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'thinking' | 'usage' | 'finish' | 'error';
  index?: number; // message index
  toolCallIndex?: number; // tool call index within message
  toolCallId?: string;
  toolName?: string;
  content?: string;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: Error;
}

export interface NormalizerAdapter {
  readonly providerId: ProviderId;
  parseChunk(chunk: Uint8Array | string): StreamDelta[];
  buildRequest(messages: ModelMessage[], options: LLMCallOptions): ProviderRequest;
  parseResponse(response: unknown): ModelMessage;
}

export type LLMCallOptions = {
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  systemPrompt?: string;
  stream?: boolean;
  abortSignal?: AbortSignal;
};

export function createNormalizer(providerId: ProviderId): NormalizerAdapter;

// Per-provider constructors also exported for direct use:
export function createOpenAINormalizer(): NormalizerAdapter;
export function createAnthropicNormalizer(): NormalizerAdapter;
export function createGeminiNormalizer(): NormalizerAdapter;
export function createOpenAIResponsesNormalizer(): NormalizerAdapter;
// ... etc
```

---

### 4.3 `@agentsy/processor`

**Event state machine. Per-message Map tracking. Lazy message creation.**

```typescript
// ─── Event Types ──────────────────────────────────────────────────────────

export type ProcessorEvent =
  | { type: 'message_start'; messageId: string; role: MessageRole }
  | { type: 'text_delta'; messageId: string; delta: string }
  | { type: 'thinking_delta'; messageId: string; delta: string }
  | { type: 'tool_call_start'; messageId: string; toolCallId: string; toolName: string }
  | { type: 'tool_call_delta'; messageId: string; toolCallId: string; argumentsDelta: string }
  | { type: 'tool_call_end'; messageId: string; toolCallId: string; result?: string } // ADR-011
  | { type: 'message_complete'; messageId: string; message: ModelMessage }
  | { type: 'context_window_will_overflow'; currentTokens: number; limit: number }
  | { type: 'chat_compressed'; previousTokens: number; newTokens: number; summary: string }
  | { type: 'loop_detected'; stepCount: number; isFirstWarning: boolean } // ADR-008
  | { type: 'loop_exceeded'; stepCount: number }
  | { type: 'citation'; source: string; text: string }
  | { type: 'retry'; attempt: number; reason: string; delayMs: number }
  | { type: 'invalid_stream'; error: Error }
  | { type: 'cost_update'; deltaUsd: number; totalUsd: number }
  | { type: 'messages_snapshot'; messages: ModelMessage[] }; // ADR from SRC-8 TanStack

// ─── Per-Message State ────────────────────────────────────────────────────
// (ADR-003 — SRC-8 TanStack AI StreamProcessor pattern)

interface MessageStreamState {
  messageId: string;
  role: MessageRole;
  textAccumulator: string;
  thinkingAccumulator: string;
  toolCalls: Map<string, ToolCallStreamState>;
  isComplete: boolean;
  createdAt: number; // timestamp of first content chunk (lazy creation — ADR-004)
}

interface ToolCallStreamState {
  toolCallId: string;
  toolName: string;
  argumentsAccumulator: string;
  isArgumentsComplete: boolean;
  result?: string;
  approvalState?: 'pending' | 'approved' | 'denied';
}

// ─── Processor Options ────────────────────────────────────────────────────

export interface LLMStreamProcessorOptions {
  normalizer: NormalizerAdapter;
  chunkStrategy?: ChunkStrategy; // ADR from SRC-8 TanStack
  maxDepth?: number; // default: DEFAULT_MAX_JSON_DEPTH
  onWarning?: (warning: string) => void;
}

export const DEFAULT_CHUNK_STRATEGY: ChunkStrategy; // ImmediateStrategy

export interface ChunkStrategy {
  shouldEmit(chunkPortion: string, currentText: string): boolean;
  reset?(): void;
}

export class ImmediateStrategy implements ChunkStrategy {
  shouldEmit(_: string, __: string): boolean {
    return true;
  }
}

export class WordBoundaryStrategy implements ChunkStrategy {
  // Emits on word boundary — reduces React re-renders ~60-80% (SRC-8 TanStack)
  shouldEmit(portion: string, _: string): boolean;
}

export class PunctuationStrategy implements ChunkStrategy {
  shouldEmit(portion: string, _: string): boolean;
}

// ─── Processor Class ──────────────────────────────────────────────────────

export class LLMStreamProcessor {
  constructor(options: LLMStreamProcessorOptions);

  // Process a raw stream from the LLM provider
  process(
    stream: ReadableStream<Uint8Array> | AsyncIterable<string>,
    options?: { messageId?: string; signal?: AbortSignal },
  ): AsyncIterable<ProcessorEvent>;

  // Per-message state access
  getMessageState(messageId: string): MessageStreamState | undefined;
  areAllToolsComplete(): boolean; // ADR from SRC-8 TanStack

  // Session resume (ADR from SRC-8 TanStack MESSAGES_SNAPSHOT)
  setMessages(messages: ModelMessage[]): void;
  readonly messages: ReadonlyArray<ModelMessage>;

  // Test recording/replay (ADR-010 from SRC-8 TanStack)
  startRecording(): void;
  getRecording(): ChunkRecording;
  static replay(recording: ChunkRecording): AsyncIterable<ProcessorEvent>;
}

export interface ChunkRecording {
  events: Array<{ type: string; data: unknown; timestampMs: number }>;
  metadata: { normalizer: string; capturedAt: string };
}

export function createPipeline(options: PipelineOptions): Pipeline;

export interface PipelineOptions {
  normalizer: ProviderId | NormalizerAdapter;
  processor?: Partial<LLMStreamProcessorOptions>;
}

export interface Pipeline {
  process(stream: ReadableStream<Uint8Array>, options?: { signal?: AbortSignal }): AsyncIterable<ProcessorEvent>;
}
```

---

### 4.4 `@agentsy/agent`

**The agent loop. Stop conditions. prepareStep. mergeCallbacks. Subagent spawning.**

```typescript
// ─── Stop Conditions (ADR-002 — SRC-7 vercel/ai + SRC-8 TanStack consensus) ─

export type StopConditionState = {
  steps: StepResult[];
  messages: ModelMessage[];
  iterationCount: number;
  finishReason: string | null;
};

export type StopCondition = (state: StopConditionState) => PromiseLike<boolean> | boolean;

// Built-in factories:
export function isStepCount(n: number): StopCondition;
export function isLoopFinished(): StopCondition;
export function hasToolCall(...toolNames: string[]): StopCondition;
export function untilFinishReason(reasons: string[]): StopCondition; // SRC-8 TanStack
export function combineStrategies(conditions: StopCondition[]): StopCondition; // OR composition

// ─── prepareStep (SRC-7 vercel/ai pattern) ────────────────────────────────

export type PrepareStepFn = (step: StepState) => Promise<Partial<AgentLoopOptions>> | Partial<AgentLoopOptions>;

export interface StepState {
  stepIndex: number;
  previousSteps: StepResult[];
  messages: ModelMessage[];
  currentOptions: Readonly<AgentLoopOptions>;
}

// ─── Agent Loop Options ───────────────────────────────────────────────────

export interface AgentLoopOptions {
  // Required
  model: ModelClient;
  tools?: ToolDefinition[];

  // Stop conditions (REQ-023)
  stopWhen?: StopCondition[]; // OR-composed

  // Per-step dynamic reconfiguration (REQ-024 — SRC-7 vercel/ai)
  prepareStep?: PrepareStepFn;

  // Tool approval (ADR-006)
  approval?: ApprovalOptions;

  // Memory engine (REQ-005)
  memoryEngine?: MemoryEngine;

  // Session persistence (REQ-011)
  sessionStore?: SessionStore;

  // Context management (REQ-007)
  contextManager?: ContextManager;

  // Cost tracking (REQ-008)
  costTracker?: CostTracker;

  // Lifecycle hooks (REQ-004) — merged via mergeCallbacks (SRC-7 vercel/ai)
  beforeStep?: (state: StepState) => Promise<void> | void;
  afterStep?: (result: StepResult) => Promise<void> | void;
  beforeToolCall?: (call: ToolCall) => Promise<void> | void;
  afterToolCall?: (call: ToolCall, result: ToolResult) => Promise<void> | void;
  onError?: (error: Error, state: StepState) => Promise<void> | void;
  onAbort?: (signal: AbortSignal) => Promise<void> | void;

  // Telemetry (optional)
  telemetry?: TelemetryAdapter;

  // Max depth for subagents (REQ-014)
  maxSubagentDepth?: number; // default: DEFAULT_MAX_SUBAGENT_DEPTH = 5
}

export const DEFAULT_MAX_SUBAGENT_DEPTH = 5;
export const DEFAULT_STOP_CONDITIONS: StopCondition[] = [isStepCount(20)];

// ─── Agent Loop Return Types ──────────────────────────────────────────────

export type AgentLoopResult =
  | { type: 'success'; messages: ModelMessage[]; steps: StepResult[]; cost?: CostSummary }
  | { type: 'approval-required'; pendingCall: ToolCall; sessionId: string }
  | { type: 'stopped'; reason: string; steps: StepResult[] }
  | { type: 'error'; error: Error; partialSteps: StepResult[] };

export interface StepResult {
  stepIndex: number;
  input: ModelMessage[];
  output: ModelMessage;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  finishReason: string;
  usage: { promptTokens: number; completionTokens: number };
  durationMs: number;
}

// ─── Agent Loop Factory ───────────────────────────────────────────────────

export interface AgentLoop {
  run(params: { messages: ModelMessage[]; signal?: AbortSignal; sessionId?: string }): Promise<AgentLoopResult>;

  // Resume after approval-required halt (ADR-006)
  continue(response: {
    toolCallId: string;
    approved: boolean;
    modifiedInput?: Record<string, unknown>;
  }): Promise<AgentLoopResult>;

  // Resume from session checkpoint (REQ-011)
  resume(sessionId: string): Promise<AgentLoopResult>;
}

export function createAgentLoop(options: AgentLoopOptions): AgentLoop;

// ─── mergeCallbacks utility (REQ-024 — SRC-7 vercel/ai) ──────────────────

export function mergeCallbacks<T extends (...args: unknown[]) => unknown>(a?: T, b?: T): T | undefined;

// ─── Subagent (REQ-014 — SRC-4 Codex spawn modes, SRC-6 OpenCode @general) ─

export type SubagentSpawnMode = 'default' | 'fork' | 'worktree' | 'remote';
// v0.3.0: 'default' and 'fork' implemented; 'worktree'/'remote' post-v0.3.0

export interface SubagentOptions extends AgentLoopOptions {
  spawnMode?: SubagentSpawnMode; // default: 'default'
  name?: string; // for named subagent addressing (SRC-6 @general)
  parentLoop?: AgentLoop; // for depth tracking
}

export function createSubagent(options: SubagentOptions): AgentLoop;

// ─── ModelClient interface (provider-agnostic) ────────────────────────────

export interface ModelClient {
  complete(messages: ModelMessage[], options: LLMCallOptions): Promise<ReadableStream<Uint8Array>>;

  countTokens?(messages: ModelMessage[]): Promise<number>;
  readonly modelId: string;
  readonly contextWindow: number;
}
```

---

### 4.5 `@agentsy/runtime`

**Tool approval engine. Sandbox enforcement. Plugin/skill loading.**

```typescript
// ─── Approval Types (REQ-010 — SRC-1 Claude Code, SRC-4 Codex, SRC-6 OpenCode) ─

export type ApprovalMode = 'allow' | 'ask' | 'deny' | 'auto' | 'plan';
// 'plan' = read-only analysis mode: deny all write/exec tools (SRC-6 OpenCode)

export interface ApprovalRule {
  pattern: string | RegExp; // matches tool name or path
  mode: ApprovalMode;
  reason?: string;
}

export interface ApprovalOptions {
  mode: ApprovalMode;
  rules?: ApprovalRule[]; // evaluated: denyRules → allowRules → askRules (ADR-009)
  preToolUseHooks?: PreToolUseHook[]; // fire BEFORE rule evaluation (SRC-1 Claude Code)
  handler?: ApprovalHandler;
}

export type PreToolUseHook = (
  call: ToolCall,
) => Promise<'approve' | 'deny' | { modifiedInput: Record<string, unknown> }>;

export type ApprovalHandler = (
  call: ToolCall,
  reason: string,
) => Promise<'approve' | 'deny' | { modifiedInput: Record<string, unknown> }>;

export interface ApprovalResult {
  decision: 'allow' | 'ask' | 'deny';
  modifiedInput?: Record<string, unknown>;
  reason?: string;
}

export interface ApprovalEngine {
  evaluate(call: ToolCall): Promise<ApprovalResult>;
}

export function createApprovalEngine(options: ApprovalOptions): ApprovalEngine;

// ─── Sandbox (REQ-002, SEC-001, SEC-002 — SRC-4 Codex sandbox modes) ──────

export type SandboxMode = 'read-only' | 'process' | 'full-access';
// 'process' = workspace-write: writes within workspace + ~/.agentsy/memory/ (ADR-018)
// 'read-only' = no writes allowed (default safe mode)
// 'full-access' = no sandboxing (container/CI only)

export interface SandboxOptions {
  mode: SandboxMode;
  workspaceRoot?: string; // defaults to cwd()
  additionalWritablePaths?: string[];
}

export interface SandboxPolicy {
  canRead(path: string): boolean;
  canWrite(path: string): boolean;
  canExecute(command: string): boolean;
  canFetchUrl(url: string): boolean; // SSRF prevention (SEC-008)
}

export function createSandboxPolicy(options: SandboxOptions): SandboxPolicy;

// ─── Tool Executor (REQ-009 — SRC-7 vercel/ai repairToolCall) ─────────────

export interface ToolExecutorOptions {
  tools: Map<string, ToolDefinition & { execute: ToolExecuteFn }>;
  approval: ApprovalEngine;
  sandbox: SandboxPolicy;
  maxConcurrency?: number; // default: 5
  repairToolCall?: ToolCallRepairFn; // SRC-7 vercel/ai
}

export type ToolExecuteFn = (
  args: Record<string, unknown>,
  options: { signal: AbortSignal; sessionId?: string },
) => Promise<string>;

export type ToolCallRepairFn = (
  toolName: string,
  malformedArgs: string,
  schema: Record<string, unknown>,
) => Promise<string>;

export interface ToolExecutor {
  executeAll(calls: ToolCall[], options: { signal: AbortSignal; sessionId?: string }): Promise<ToolResult[]>;
}

export function createToolExecutor(options: ToolExecutorOptions): ToolExecutor;

// ─── Plugin / Skill Loader (REQ-015 — SRC-4 Codex remote URL, SRC-1 SkillTool) ─

export interface SkillManifest {
  name: string;
  description: string;
  path?: string; // local filesystem path
  remoteUrl?: string; // HTTP(S) URL (SRC-4 Codex remote skill API)
  checksum?: string; // SHA-256 (required for remote, recommended local)
  version?: string;
}

export interface PluginManifest extends SkillManifest {
  tools: ToolDefinition[];
  main: string; // entry point file
}

export interface SkillLoader {
  load(manifest: SkillManifest): Promise<string>; // returns skill content
  loadAll(directory: string): Promise<Map<string, string>>;
}

export interface PluginLoader {
  load(manifest: PluginManifest): Promise<Plugin>;
  verify(manifest: PluginManifest): Promise<boolean>; // checksum verify (SEC-004)
}

export interface Plugin {
  manifest: PluginManifest;
  tools: Map<string, ToolDefinition & { execute: ToolExecuteFn }>;
}

export function createSkillLoader(): SkillLoader;
export function createPluginLoader(options?: { allowRemote?: boolean }): PluginLoader;
```

---

### 4.6 `@agentsy/context-manager`

**Token budget monitoring. Context compression. Compact boundary tracking.**

```typescript
export interface ContextManagerOptions {
  tokenLimit: number;
  compressionThreshold?: number; // default: 0.85 (85% of limit)
  tokenCounter?: TokenCounter;
  compressor?: ConversationCompressor;
  onWarning?: (warning: string) => void;
}

export interface TokenCounter {
  count(messages: ModelMessage[]): Promise<number>;
}

export interface CompressionResult {
  compressedMessages: ModelMessage[];
  summary: string;
  previousTokens: number;
  newTokens: number;
}

export interface ConversationCompressor {
  compress(messages: ModelMessage[], options: { targetTokens: number; model: ModelClient }): Promise<CompressionResult>;
}

export interface ContextManager {
  // Call before each LLM invocation (ADR-012 — SRC-2 nanobot)
  check(options: {
    messages: ModelMessage[];
    isToolCallActive?: boolean; // MUST be true when a tool is in-flight
    model: ModelClient;
  }): Promise<{
    messages: ModelMessage[]; // possibly compressed
    compressed: boolean;
    stats: { currentTokens: number; limit: number };
  }>;

  // Insert compact_boundary marker (SRC-1 Claude Code)
  insertCompactBoundary(messages: ModelMessage[]): ModelMessage[];
  getMessagesAfterCompactBoundary(messages: ModelMessage[]): ModelMessage[];
}

export function createContextManager(options: ContextManagerOptions): ContextManager;

// Compression strategies (SRC-1 Claude Code three strategies)
export function createAutoCompactCompressor(model: ModelClient): ConversationCompressor;
export function createSnipCompressor(): ConversationCompressor; // removes zombie messages
export function createContextCollapseCompressor(): ConversationCompressor; // restructures context
```

---

### 4.7 `@agentsy/session`

**Crash-safe session persistence. Atomic writes. Auto-repair.**

```typescript
export interface StreamSnapshot {
  sessionId: string;
  messages: ModelMessage[];
  stepIndex: number;
  metadata?: Record<string, unknown>;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface SessionStore {
  // Blocking save for user messages (ADR-005 — SRC-1 Claude Code, SRC-2 nanobot)
  saveUser(sessionId: string, message: ModelMessage): Promise<void>;

  // Fire-and-forget queue for assistant messages
  saveAssistant(sessionId: string, message: ModelMessage): void;

  // Full snapshot save (blocking)
  save(sessionId: string, snapshot: StreamSnapshot): Promise<void>;

  load(sessionId: string): Promise<StreamSnapshot | null>;

  list(): Promise<string[]>;
  delete(sessionId: string): Promise<void>;

  // MESSAGES_SNAPSHOT equivalent for AG-UI integration (SRC-8 TanStack)
  loadAsSnapshot(sessionId: string): Promise<{ messages: ModelMessage[] } | null>;
}

export interface FileSystemSessionStoreOptions {
  directory?: string; // default: ~/.agentsy/sessions
  processPrefix?: boolean; // prefix session IDs with PID (ADR from SRC-4 Codex)
}

export function createFileSystemSessionStore(options?: FileSystemSessionStoreOptions): SessionStore;
// Implements:
// - Lazy session file creation (ADR-004 — SRC-2 nanobot lazy session creation)
// - Atomic write: write .tmp, verify JSON, rename (ADR-010 — SRC-2 nanobot)
// - Startup scan: repair *.json.tmp orphan files or delete invalid ones
// - Process-scoped session IDs: <pid>-<sessionId> (SRC-4 Codex thread-store)
```

---

### 4.8 `@agentsy/cost-tracker`

**Provider pricing map. Budget enforcement. Cost event emission.**

```typescript
export interface ProviderPricing {
  providerId: string;
  modelId: string;
  promptCostPer1kTokens: number; // USD
  completionCostPer1kTokens: number;
  cacheReadCostPer1kTokens?: number;
  cacheWriteCostPer1kTokens?: number;
}

export interface CostTrackerOptions {
  pricing?: ProviderPricing[]; // overrides default built-in map
  budgetLimitUsd?: number; // emits CostThresholdExceeded at 80% and 100%
  onCostUpdate?: (update: CostUpdate) => void;
  onBudgetExceeded?: (total: number, limit: number) => void;
}

export interface CostUpdate {
  sessionId: string;
  stepIndex: number;
  deltaCostUsd: number;
  totalCostUsd: number;
  usage: { promptTokens: number; completionTokens: number };
}

export interface CostSummary {
  totalUsd: number;
  byModel: Map<string, number>;
  totalPromptTokens: number;
  totalCompletionTokens: number;
}

export interface CostTracker {
  record(usage: { promptTokens: number; completionTokens: number; modelId: string; providerId: string }): void;
  getSummary(): CostSummary;
  reset(): void;
}

export function createCostTracker(options?: CostTrackerOptions): CostTracker;
export const DEFAULT_PROVIDER_PRICING: ProviderPricing[];
```

---

### 4.9 `@agentsy/mcp`

**MCP 2025-06-18 client. WebSocket idle timeout. Trust filtering.**

```typescript
export type MCPTransport = 'stdio' | 'websocket' | 'http';
export type MCPTrustLevel = 'trusted' | 'untrusted' | 'readonly';

export interface MCPServerConfig {
  name: string;
  transport: MCPTransport;
  // stdio
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // websocket / http
  url?: string;
  // Trust and timeouts
  trustLevel?: MCPTrustLevel; // default: 'untrusted'
  connectionIdleTimeoutMs?: number; // default: 30_000 (ADR-014 — SRC-4 Codex)
  startupTimeoutMs?: number; // default: 10_000
}

export interface MCPCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  sampling?: boolean;
}

export interface MCPOrchestratorOptions {
  servers: MCPServerConfig[];
  acpEnabled?: boolean; // future ACP support (SRC-3 Hermes + SRC-5 Gemini CLI)
  onServerError?: (serverName: string, error: Error) => void;
}

export interface MCPOrchestrator {
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(serverName: string): Promise<void>;

  listTools(): Promise<ToolDefinition[]>;
  callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown>;

  getCapabilities(serverName: string): Promise<MCPCapabilities>;
  getServerStatus(serverName: string): 'running' | 'stopped' | 'error';
}

export function createMCPOrchestrator(options: MCPOrchestratorOptions): MCPOrchestrator;
```

---

### 4.10 `@agentsy/providers`

**Provider capability matrix. Fallback chain routing.**

```typescript
export interface ProviderCapabilities {
  contextWindow: number;
  supportsVision: boolean;
  supportsToolCalling: boolean;
  supportsStreaming: boolean;
  supportsThinking?: boolean;
  supportsCaching?: boolean;
  maxOutputTokens?: number;
}

export interface ProviderConfig {
  providerId: ProviderId;
  modelId: string;
  apiKey?: string; // prefer env var via process.env
  baseUrl?: string;
  capabilities?: Partial<ProviderCapabilities>; // overrides built-in matrix
}

export interface FallbackChainOptions {
  primary: ProviderConfig;
  fallbacks: ProviderConfig[];
  retryOn?: Array<'rate_limit' | 'server_error' | 'context_exceeded' | 'timeout'>;
  maxRetries?: number; // default: 3
}

export interface ProviderStrategy {
  getClient(requirements?: Partial<ProviderCapabilities>): ModelClient;
  withFallback(options: FallbackChainOptions): ModelClient;
  getCapabilities(modelId: string): ProviderCapabilities | undefined;
}

export function createProviderStrategy(configs: ProviderConfig[]): ProviderStrategy;
export const PROVIDER_CAPABILITY_MATRIX: Map<string, ProviderCapabilities>;
```

---

### 4.11 `@agentsy/memory`

**3-layer blended memory. Karpathy wiki architecture. 2-stage pipeline.**

```typescript
// ─── Layer 0: Raw Event Log ────────────────────────────────────────────────
// Cursor-based append-only JSONL (ADR-017 — SRC-2 nanobot history.jsonl)

export interface RawEventLogOptions {
  directory: string; // e.g., ~/.agentsy/sessions/<sessionId>/
  cursorFileName?: string; // default: '.cursor'
  dreamCursorFileName?: string; // default: '.dream_cursor'
}

export interface RawEventLog {
  append(event: SessionEvent): Promise<void>;
  readSince(cursor: number): AsyncIterable<SessionEvent>;
  getCursorPosition(): Promise<number>;
  advanceCursor(position: number): Promise<void>;
  getDreamCursorPosition(): Promise<number>;
  advanceDreamCursor(position: number): Promise<void>;
}

export interface SessionEvent {
  sessionId: string;
  timestamp: string;
  type: 'user_message' | 'assistant_message' | 'tool_call' | 'tool_result' | 'summary';
  content: string;
  metadata?: Record<string, unknown>;
}

// ─── Layer 1: Wiki Store ───────────────────────────────────────────────────
// Synthesized wiki pages (SRC-2 nanobot 4-file roles, ADR from research)

export type WikiCategory = 'entities' | 'concepts' | 'synthesis' | 'sources';

export interface WikiPage {
  id: string;
  category: WikiCategory;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  projectId?: string; // for scope isolation (SEC-005)
}

export interface WikiStoreOptions {
  directory: string;
  projectId?: string;
}

export interface WikiStore {
  upsert(page: Omit<WikiPage, 'id' | 'createdAt' | 'updatedAt'>): Promise<WikiPage>;
  get(id: string): Promise<WikiPage | null>;
  list(category?: WikiCategory): Promise<WikiPage[]>;
  delete(id: string): Promise<void>;
  search(query: string): Promise<WikiPage[]>; // text search, NOT vector (FTS5 optional)

  // Well-known page accessors (SRC-2 nanobot USER.md/MEMORY.md/SOUL.md roles)
  getEntitiesPage(title: string): Promise<WikiPage | null>;
  getConceptsPage(title: string): Promise<WikiPage | null>;
  getSynthesisPage(title: string): Promise<WikiPage | null>;
}

// ─── Memory Lifecycle (2-stage — ADR-007, SRC-2 nanobot Dream config) ──────

export interface MemoryLifecycleOptions {
  synthesisIntervalHours?: number; // default: 2 (SRC-2 nanobot intervalH)
  synthesisModelOverride?: ModelClient; // optional cheaper model for synthesis
  maxBatchSize?: number; // default: 20 (SRC-2 nanobot maxBatchSize)
  maxSynthesisIterations?: number; // default: 10 (SRC-2 nanobot maxIterations)
}

export interface MemoryLifecycle {
  // Stage 1: Consolidator — auto-compact context → append to history.jsonl
  consolidate(options: { messages: ModelMessage[]; model: ModelClient }): Promise<{
    summary: string;
    appendedToLog: boolean;
  }>;

  // Stage 2: Dream — synthesize history.jsonl into wiki pages
  synthesize(options: { model: ModelClient; force?: boolean }): Promise<{
    pagesUpdated: number;
    pagesCreated: number;
    batchProcessed: number;
  }>;

  // Called at agent loop start (REQ-005)
  startTask(sessionId: string): Promise<void>;

  // Called at agent loop end (REQ-005) — triggers Stage 2 synthesis
  endTask(sessionId: string): Promise<void>;
}

// ─── Memory Engine (top-level facade — REQ-016 through REQ-019) ───────────

export interface MemoryEngineOptions {
  wikiStore: WikiStoreOptions;
  rawEventLog?: RawEventLogOptions; // optional: enables Layer 0
  retrieval?: RetrievalEngineOptions; // optional: enables Layer 2 RAG
  lifecycle?: MemoryLifecycleOptions;
  securityOptions?: {
    projectId?: string; // for scope isolation (SEC-005)
    sanitizeRetrieved?: boolean; // strip injection patterns (SEC-009) default: true
  };
}

export interface MemoryEngine {
  startTask(sessionId: string): Promise<void>;
  endTask(sessionId: string): Promise<void>;

  // REQ-018 Memory tools
  search(query: string, options?: { topK?: number; scope?: 'project' | 'global' }): Promise<WikiPage[]>;
  capture(content: string, options?: { category?: WikiCategory; title?: string }): Promise<WikiPage>;
  list(options?: { category?: WikiCategory }): Promise<WikiPage[]>;
  stats(): Promise<{ totalPages: number; totalEvents: number; wikiSizeBytes: number }>;
  lint(): Promise<Array<{ pageId: string; issue: string; severity: 'error' | 'warning' }>>;

  // REQ-019: Build <memory_context> XML for injection
  buildContextXml(retrievedPages: WikiPage[]): string;
}

export function createMemoryEngine(options: MemoryEngineOptions): MemoryEngine;
```

---

### 4.12 `@agentsy/retrieval`

**Vector store abstraction. libSQL/Turso backend. Wiki page indexing.**

```typescript
// ─── Vector Store Interface ────────────────────────────────────────────────

export interface VectorEntry {
  id: string;
  content: string;
  embedding: number[]; // typically 1536-dim for text-embedding-3-small
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  entry: VectorEntry;
  similarity: number; // cosine similarity [0, 1]
}

export interface VectorStore {
  insert(entry: VectorEntry): Promise<void>;
  insertBatch(entries: VectorEntry[]): Promise<void>;
  search(embedding: number[], topK: number): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  stats(): Promise<{ totalEntries: number; dimensionality: number }>;
}

// ─── Embedding Provider ───────────────────────────────────────────────────

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimensionality: number;
}

// ─── Retrieval Engine ─────────────────────────────────────────────────────

export interface RetrievalEngineOptions {
  vectorStore: VectorStoreConfig;
  embedder: EmbeddingProvider;
  topK?: number; // default: 5
}

export type VectorStoreConfig =
  | { backend: 'libsql'; path: string } // local SQLite with vector extension (CON-007)
  | { backend: 'turso'; url: string; authToken: string }
  | { backend: 'custom'; store: VectorStore };

export interface RetrievalEngine {
  // Index a wiki page (REQ-017 — index wiki pages NOT raw events)
  indexPage(page: WikiPage): Promise<void>;
  indexPages(pages: WikiPage[]): Promise<void>;
  removePage(pageId: string): Promise<void>;

  // Semantic search
  search(
    query: string,
    options?: {
      topK?: number;
      minSimilarity?: number; // default: 0.7
    },
  ): Promise<Array<WikiPage & { similarity: number }>>;

  // FTS5 text search (ADR-013 — SRC-3 Hermes FTS5 pattern)
  fullTextSearch?(query: string, options?: { limit?: number }): Promise<WikiPage[]>;
}

export function createRetrievalEngine(options: RetrievalEngineOptions): RetrievalEngine;
export function createLibSQLVectorStore(path: string): VectorStore;
```

---

### 4.13 `@agentsy/ag-ui`

**AG-UI protocol adapter. Converts agent loop events to AG-UI wire format.**

```typescript
// AG-UI event types (subset — full spec at https://github.com/ag-ui-protocol/ag-ui)
export type AGUIEventType =
  | 'RUN_STARTED'
  | 'RUN_FINISHED'
  | 'RUN_ERROR'
  | 'TEXT_MESSAGE_START'
  | 'TEXT_MESSAGE_CONTENT'
  | 'TEXT_MESSAGE_END'
  | 'TOOL_CALL_START'
  | 'TOOL_CALL_ARGS_DELTA'
  | 'TOOL_CALL_END'
  | 'STATE_SNAPSHOT'
  | 'MESSAGES_SNAPSHOT';

export interface AGUIEvent {
  type: AGUIEventType;
  runId?: string;
  messageId?: string;
  toolCallId?: string;
  toolName?: string;
  delta?: string;
  result?: string; // TOOL_CALL_END with result = server tool (ADR-011 — SRC-8 TanStack)
  messages?: ModelMessage[]; // MESSAGES_SNAPSHOT
  timestamp?: number;
}

export interface AGUIAdapterOptions {
  onEvent?: (event: AGUIEvent) => void;
  onMessagesChange?: (messages: ModelMessage[]) => void;
}

export interface AGUIAdapter {
  // Convert ProcessorEvent → AGUIEvent[]
  handleProcessorEvent(event: ProcessorEvent): AGUIEvent[];

  // Add tool result (client-executed tool round-trip)
  addToolResult(toolCallId: string, result: string): void;

  // Session resume — emits MESSAGES_SNAPSHOT (SRC-8 TanStack)
  loadSession(messages: ModelMessage[]): void;

  readonly messages: ReadonlyArray<ModelMessage>;
}

export function createAGUIAdapter(options?: AGUIAdapterOptions): AGUIAdapter;

// Bridge function: agent loop → AG-UI stream (SRC-7 vercel/ai createAgentUIStream)
export async function createAgentUIStream(options: {
  loop: AgentLoop;
  messages: ModelMessage[];
  signal?: AbortSignal;
  onStepFinish?: (result: StepResult) => void;
}): Promise<ReadableStream<AGUIEvent>>;
```

---

### 4.14 `@agentsy/telemetry`

**OpenTelemetry instrumentation. Lazy-loaded. Zero cost when unused.**

```typescript
// Lazy-loaded: importing this package does not activate instrumentation
// until setupTelemetry() is called (SRC-5 Gemini CLI OTel lazy load pattern)

export interface TelemetryOptions {
  serviceName?: string; // default: 'agentsy'
  serviceVersion?: string;
  exporter?: SpanExporter; // default: ConsoleSpanExporter in dev, OTLP in prod
  sampleRate?: number; // default: 1.0
}

export interface TelemetryAdapter {
  startSpan(name: string, attributes?: Record<string, string | number>): Span;
  recordMetric(name: string, value: number, attributes?: Record<string, string>): void;
  shutdown(): Promise<void>;
}

export interface Span {
  setAttribute(key: string, value: string | number | boolean): this;
  setStatus(status: 'ok' | 'error', message?: string): this;
  end(): void;
  recordException(error: Error): void;
}

export function setupTelemetry(options?: TelemetryOptions): TelemetryAdapter;
export function createNoopTelemetry(): TelemetryAdapter; // zero-cost default
```

---

### 4.15 `@agentsy/adapters`

**Generic and VS Code adapter integrations.**

```typescript
export interface GenericAdapterOptions {
  processor: LLMStreamProcessor;
  onEvent?: (event: ProcessorEvent) => void;
  onComplete?: (messages: ModelMessage[]) => void;
}

export function createGenericAdapter(options: GenericAdapterOptions): {
  process(stream: ReadableStream<Uint8Array>): Promise<ModelMessage[]>;
  processStream(stream: ReadableStream<Uint8Array>): AsyncIterable<ProcessorEvent>;
};

export interface VSCodeAdapterOptions extends GenericAdapterOptions {
  outputChannel?: { appendLine: (line: string) => void };
  statusBarItem?: { text: string };
}

export function createVSCodeAdapter(options: VSCodeAdapterOptions): {
  process(stream: ReadableStream<Uint8Array>): Promise<ModelMessage[]>;
  processStream(stream: ReadableStream<Uint8Array>): AsyncIterable<ProcessorEvent>;
  dispose(): void;
};
```

---

### 4.16 `@selfagency/llm-stream-parser` (shim)

**100% backward-compatible re-export shim. All existing consumers continue to work.**

```typescript
// packages/shim/src/index.ts
export * from '@agentsy/core';
export * from '@agentsy/normalizers';
export * from '@agentsy/processor';
export * from '@agentsy/agent';
export * from '@agentsy/adapters';
export * from '@agentsy/ag-ui';

// All subpath exports (e.g., @selfagency/llm-stream-parser/thinking)
// are mapped in packages/shim/package.json exports field to corresponding
// @agentsy/* package subpath exports.
```

---

## 5. Key Implementation Notes

### 5.1 Turbo Pipeline Configuration

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".tsbuildinfo"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {},
    "format": {}
  }
}
```

**Critical**: `build` must depend on `^build` (caret = upstream packages). Without this, a package may build before its `@agentsy/*` dependencies, causing import resolution failures.

### 5.2 Agent Loop Warning-First Guardrail

Implementation of ADR-008 (SRC-3 Hermes + SRC-1 Claude Code):

```typescript
// In createAgentLoop.ts
let consecutiveLoopDetections = 0;

function checkForLoop(steps: StepResult[]): 'ok' | 'warning' | 'abort' {
  const lastTwo = steps.slice(-2);
  const isLoop = lastTwo.length === 2 && lastTwo[0]!.output.content === lastTwo[1]!.output.content;

  if (!isLoop) {
    consecutiveLoopDetections = 0;
    return 'ok';
  }

  consecutiveLoopDetections++;
  if (consecutiveLoopDetections === 1) return 'warning'; // emit LoopDetected, continue
  return 'abort'; // emit LoopExceeded, halt
}
```

### 5.3 Allow-Rule Precedence (ADR-009)

```typescript
// In ApprovalEngine.evaluate()
// Order: deny rules → allow rules (allow can override deny if more specific)
// Unit test REQUIRED for this counter-intuitive behavior

function evaluateRules(call: ToolCall, rules: ApprovalRule[]): ApprovalMode | null {
  const denyRules = rules.filter(r => r.mode === 'deny');
  const allowRules = rules.filter(r => r.mode === 'allow');

  const matchedDeny = denyRules.find(r => matches(call, r.pattern));
  const matchedAllow = allowRules.find(r => matches(call, r.pattern));

  if (matchedAllow && matchedDeny) {
    // More specific pattern wins (allow overrides deny)
    return specificity(matchedAllow.pattern) >= specificity(matchedDeny.pattern) ? 'allow' : 'deny';
  }
  if (matchedDeny) return 'deny';
  if (matchedAllow) return 'allow';
  return null; // fall through to ask rules / default mode
}
```

### 5.4 Atomic Session Write

```typescript
// In FileSystemSessionStore
async save(sessionId: string, snapshot: StreamSnapshot): Promise<void> {
  const filePath = this.pathFor(sessionId)
  const tmpPath = `${filePath}.tmp`
  const content = JSON.stringify(snapshot, null, 2)

  await fs.writeFile(tmpPath, content, 'utf8')
  // Verify written content is valid JSON before rename
  const written = await fs.readFile(tmpPath, 'utf8')
  JSON.parse(written)  // throws if corrupt
  await fs.rename(tmpPath, filePath)
}

// On startup: scan and repair orphan .tmp files
async repairOrphanFiles(directory: string): Promise<void> {
  const tmpFiles = await glob(`${directory}/**/*.json.tmp`)
  for (const tmpFile of tmpFiles) {
    const target = tmpFile.replace(/\.tmp$/, '')
    try {
      const content = await fs.readFile(tmpFile, 'utf8')
      JSON.parse(content)  // throws if invalid
      await fs.rename(tmpFile, target)
    } catch {
      // Invalid: log warning, delete orphan
      await fs.unlink(tmpFile)
    }
  }
}
```

### 5.5 mergeCallbacks Utility

```typescript
// In @agentsy/agent/utils.ts (SRC-7 vercel/ai pattern)
export function mergeCallbacks<T extends (...args: unknown[]) => Promise<void> | void>(a?: T, b?: T): T | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;
  return (async (...args: Parameters<T>) => {
    await a(...args);
    await b(...args);
  }) as T;
}
```

### 5.6 Lazy Assistant Message Creation

```typescript
// In LLMStreamProcessor
private pendingMessage: Partial<MessageStreamState> | null = null

prepareAssistantMessage(messageId: string): void {
  // Store intent but do NOT push to messages array yet (ADR-004 — SRC-8 TanStack)
  this.pendingMessage = { messageId, role: 'assistant', textAccumulator: '', toolCalls: new Map() }
}

private handleFirstContent(messageId: string): void {
  if (this.pendingMessage?.messageId === messageId) {
    // First content chunk — now create the message
    this.messageStateMap.set(messageId, this.pendingMessage as MessageStreamState)
    this.pendingMessage = null
    this.emit({ type: 'message_start', messageId, role: 'assistant' })
  }
}

finalizeStream(): void {
  // Remove whitespace-only messages (SRC-8 TanStack guard)
  this.messages = this.messages.filter(m =>
    m.role !== 'assistant' ||
    typeof m.content !== 'string' ||
    m.content.trim().length > 0
  )
}
```

---

## 6. Migration Path: `@selfagency/llm-stream-parser` → `@agentsy/*`

| Old import path                             | New import path                  |
| ------------------------------------------- | -------------------------------- |
| `@selfagency/llm-stream-parser`             | `@agentsy/core` (or any package) |
| `@selfagency/llm-stream-parser/thinking`    | `@agentsy/core/thinking`         |
| `@selfagency/llm-stream-parser/xml-filter`  | `@agentsy/core/xml-filter`       |
| `@selfagency/llm-stream-parser/tool-calls`  | `@agentsy/core/tool-calls`       |
| `@selfagency/llm-stream-parser/structured`  | `@agentsy/core/structured`       |
| `@selfagency/llm-stream-parser/context`     | `@agentsy/core/context`          |
| `@selfagency/llm-stream-parser/formatting`  | `@agentsy/core/formatting`       |
| `@selfagency/llm-stream-parser/markdown`    | `@agentsy/core/markdown`         |
| `@selfagency/llm-stream-parser/processor`   | `@agentsy/processor`             |
| `@selfagency/llm-stream-parser/adapters`    | `@agentsy/adapters`              |
| `@selfagency/llm-stream-parser/ag-ui`       | `@agentsy/ag-ui`                 |
| `@selfagency/llm-stream-parser/normalizers` | `@agentsy/normalizers`           |
| `@selfagency/llm-stream-parser/agent`       | `@agentsy/agent`                 |
| `@selfagency/llm-stream-parser/sse`         | `@agentsy/core/sse`              |
| `@selfagency/llm-stream-parser/recovery`    | `@agentsy/core/recovery`         |
| `@selfagency/llm-stream-parser/pipeline`    | `@agentsy/processor/pipeline`    |

**sed migration one-liners** (TASK-R1-003):

```bash
# Replace all @selfagency/llm-stream-parser imports in src/
find . -name "*.ts" -not -path "*/node_modules/*" | xargs sed -i \
  "s|@selfagency/llm-stream-parser/processor|@agentsy/processor|g" \
  "s|@selfagency/llm-stream-parser/adapters|@agentsy/adapters|g" \
  "s|@selfagency/llm-stream-parser/ag-ui|@agentsy/ag-ui|g" \
  "s|@selfagency/llm-stream-parser/normalizers|@agentsy/normalizers|g" \
  "s|@selfagency/llm-stream-parser/agent|@agentsy/agent|g" \
  "s|@selfagency/llm-stream-parser|@agentsy/core|g"
```

---

## 6.5 Feature Extension Packages

### `@agentsy/caveman`

Token compression via SKILL.md prompt injection and MCP tool-description proxy.

```typescript
// packages/caveman/src/index.ts

export type CavemanMode = 'lite' | 'full' | 'ultra' | 'wenyan-lite' | 'wenyan-full' | 'wenyan-ultra';

export interface CavemanOptions {
  mode?: CavemanMode; // default: 'full'
  skillsDir?: string; // default: bundled skills
}

export interface CavemanManager {
  activate(mode?: CavemanMode): void;
  deactivate(): void;
  isActive(): boolean;
  getMode(): CavemanMode | null;
  /** Returns the SKILL.md content to inject into the system prompt */
  getSkillContent(mode?: CavemanMode): string;
  /** Returns the cavemanShrink MCP server command config for MCPOrchestrator */
  getShrinkServerConfig(): { command: string; args: string[] };
  /** Returns bundled cavecrew SKILL.md for a subagent variant */
  getCavecrewSkill(variant: 'investigator' | 'builder' | 'reviewer'): string;
}

export function createCavemanManager(options?: CavemanOptions): CavemanManager;

/**
 * Compresses a tool description string using caveman compression rules.
 * Preserves code literals, URLs, and identifiers. For use in caveman-shrink proxy.
 */
export function compressDescription(description: string, mode?: CavemanMode): string;
```

---

### `@agentsy/skills`

Node.js programmatic wrapper around the `npx skills` CLI (vercel-labs/skills).

```typescript
// packages/skills/src/index.ts

export interface SkillSearchResult {
  name: string;
  description: string;
  author: string;
  version: string;
  installCommand: string;
  sourceUrl: string;
}

export interface InstalledSkill {
  name: string;
  path: string;
  version: string;
  description: string;
}

export interface SkillsManagerOptions {
  /** Root directory containing .agents/skills/ (default: cwd) */
  workspaceRoot?: string;
  /** Timeout for npx skills subprocess calls in ms (default: 30000) */
  timeout?: number;
}

export interface SkillsManager {
  /** Search the public skills registry by natural language query */
  find(query: string): Promise<SkillSearchResult[]>;
  /** Install a skill by registry slug or 'owner/repo' ref (SEC-011: validated) */
  add(ref: string): Promise<InstalledSkill>;
  /** List installed skills */
  list(): Promise<InstalledSkill[]>;
  /** Remove an installed skill by name */
  remove(name: string): Promise<void>;
  /** Update an installed skill to latest version */
  update(name: string): Promise<InstalledSkill>;
  /** Initialize a new SKILL.md in the workspace */
  init(skillName: string, targetPath?: string): Promise<string>;
}

export function createSkillsManager(options?: SkillsManagerOptions): SkillsManager;
```

---

### `@agentsy/superpowers`

Context-activated methodology skills from obra/superpowers v5.0.7.

```typescript
// packages/superpowers/src/index.ts

export type SuperpowerSkillName =
  | 'brainstorming'
  | 'git-worktrees'
  | 'writing-plans'
  | 'subagent-driven-development'
  | 'tdd'
  | 'code-review'
  | 'finish-branch';

export interface SuperpowersContext {
  /** Indicates test files are present in the workspace */
  hasTestFiles?: boolean;
  /** Indicates a diff or PR diff has been injected */
  hasDiffContext?: boolean;
  /** Indicates the session started with an open-ended planning request */
  isOpenEndedPlanning?: boolean;
  /** Additional arbitrary context signals for custom activation rules */
  signals?: Record<string, boolean>;
}

export interface SuperpowersOptions {
  /** Skills to always activate regardless of context (default: []) */
  alwaysActive?: SuperpowerSkillName[];
  /** Skills to never activate (default: []) */
  disabled?: SuperpowerSkillName[];
}

export interface SuperpowersActivator {
  /**
   * Returns SKILL.md content for skills relevant to the given context.
   * ADR-022: context-activated, not always-on.
   */
  selectSkills(context: SuperpowersContext): string[];
  /** Returns the full SKILL.md content for a specific skill */
  getSkillContent(name: SuperpowerSkillName): string;
  /** Returns all available skill names */
  listSkills(): SuperpowerSkillName[];
}

export function createSuperpowersActivator(options?: SuperpowersOptions): SuperpowersActivator;
```

---

### `@agentsy/slash-commands`

Pre-model slash command interception and registry.

```typescript
// packages/slash-commands/src/index.ts

export interface SlashCommandFrontmatter {
  description: string;
  'allowed-tools'?: string[];
  model?: string;
  'argument-hint'?: string;
}

export interface SlashCommandManifest {
  name: string;
  frontmatter: SlashCommandFrontmatter;
  /** Path to the SKILL.md file */
  skillPath: string;
  /** Whether this is a stock built-in command */
  builtin: boolean;
}

export interface SlashCommandExecutionResult {
  /** Synthetic assistant message to return directly, bypassing model */
  type: 'synthetic-response';
  content: string;
}

export interface SlashCommandRegistryOptions {
  /** Root directory to discover .agents/skills/<name>/SKILL.md files */
  workspaceRoot?: string;
  /** Enable stock built-in commands (default: true) */
  includeBuiltins?: boolean;
}

export interface SlashCommandRegistry {
  /** Returns true if the message starts with a registered slash command */
  isSlashCommand(message: string): boolean;
  /**
   * Execute a slash command. Returns a synthetic response.
   * ADR-023: intercepts before any model call.
   */
  execute(message: string, args?: Record<string, string>): Promise<SlashCommandExecutionResult>;
  /** List all registered commands */
  list(): SlashCommandManifest[];
  /** Register a custom command programmatically */
  register(manifest: SlashCommandManifest, handler: (args: string) => Promise<string>): void;
}

export function createSlashCommandRegistry(options?: SlashCommandRegistryOptions): SlashCommandRegistry;

// Stock command names
export const BUILTIN_COMMANDS: readonly string[];
```

---

### `@agentsy/connectors`

Multi-channel chat connector gateway. ADR-024: pure library, no embedded process manager.

```typescript
// packages/connectors/src/index.ts

export interface InboundMessage {
  channelId: string;
  conversationId: string;
  userId: string;
  text: string;
  /** Raw platform-specific payload (treated as untrusted, sanitized before use) */
  raw: unknown;
  timestamp: Date;
  replyToMessageId?: string;
}

export interface OutboundMessage {
  channelId: string;
  conversationId: string;
  text: string;
  /** Optional platform-specific extras (buttons, attachments, etc.) */
  metadata?: Record<string, unknown>;
}

export interface ChannelAdapter {
  readonly channelId: string;
  /** Start receiving inbound messages */
  connect(): Promise<void>;
  /** Stop receiving inbound messages */
  disconnect(): Promise<void>;
  /** Send a message to this channel */
  send(message: OutboundMessage): Promise<void>;
  /** Register a handler for inbound messages */
  onMessage(handler: (message: InboundMessage) => Promise<void>): void;
}

export interface MessageRouter {
  /** Route an inbound message to the appropriate AgentSession */
  route(message: InboundMessage): Promise<void>;
  /** Register a channel adapter */
  addAdapter(adapter: ChannelAdapter): void;
}

export interface AgentSessionOptions {
  /** Session store for persistence and crash-safe resume (REQ-040) */
  sessionStore?: import('@agentsy/session').SessionStore;
  /** Maximum concurrent sessions (default: 100) */
  maxConcurrentSessions?: number;
}

export interface AgentSession {
  sessionId: string;
  conversationId: string;
  channelId: string;
  /** Send a message to the originating channel */
  reply(text: string, metadata?: Record<string, unknown>): Promise<void>;
}

export interface AgentSessionManager {
  /** Get or create a session for a conversation */
  getOrCreateSession(message: InboundMessage): Promise<AgentSession>;
  /** Terminate and archive a session */
  terminateSession(conversationId: string): Promise<void>;
  /** List active session IDs */
  listActiveSessions(): string[];
}

export interface ConnectorGatewayOptions {
  agentSessionOptions?: AgentSessionOptions;
  /** Adapter registry for channel adapters (default: empty registry) */
  adapters?: ChannelAdapter[];
}

export interface ConnectorGateway {
  readonly router: MessageRouter;
  readonly sessionManager: AgentSessionManager;
  /** Register a channel adapter and wire it to the message router */
  addAdapter(adapter: ChannelAdapter): void;
  /** Start all registered adapters */
  start(): Promise<void>;
  /** Stop all registered adapters gracefully */
  stop(): Promise<void>;
}

export function createConnectorGateway(options?: ConnectorGatewayOptions): ConnectorGateway;

// ─── First-party channel adapters ────────────────────────────────────────────
// Note: platform SDKs are peerDependencies (CON-010)

export interface TelegramAdapterOptions {
  /** Telegram Bot API token (load from env: SEC-014) */
  token: string;
  webhookPath?: string;
  port?: number;
}

/** grammy@^1 peerDependency required */
export function createTelegramAdapter(options: TelegramAdapterOptions): ChannelAdapter;

export interface DiscordAdapterOptions {
  /** Discord bot token (load from env: SEC-014) */
  token: string;
  /** Discord application client ID */
  clientId: string;
  intents?: number[];
}

/** discord.js@^14 peerDependency required */
export function createDiscordAdapter(options: DiscordAdapterOptions): ChannelAdapter;

export interface SlackAdapterOptions {
  /** Slack bot token (load from env: SEC-014) */
  botToken: string;
  /** Slack signing secret */
  signingSecret: string;
  appToken?: string;
  port?: number;
}

/** @slack/bolt@^4 peerDependency required */
export function createSlackAdapter(options: SlackAdapterOptions): ChannelAdapter;
```

---

## 7. Risks & Assumptions

- **RISK-001**: Circular dependencies between packages could silently break Turbo builds. Use `madge --circular packages/*/src/index.ts` in CI to detect.
- **RISK-002**: tsup `external` arrays must stay in sync with `peerDependencies`. A missing entry causes bundling of `@agentsy/*` internals into consumer packages.
- **RISK-003**: libSQL vector extension API changes. Lock dependency version; track in `packages/retrieval/package.json`.
- **ASSUMPTION-001**: `@agentsy` npm org is secured before TASK-R0-001.
- **ASSUMPTION-002**: TypeScript project references are used for incremental builds (`composite: true` in each package `tsconfig.json`).

---

## 8. Related Specifications / Further Reading

- [agentsy-platform-v2.md](./agentsy-platform-v2.md) — implementation task plan with all phase/task details
- [agentsy-prd.md](./agentsy-prd.md) — product requirements (what and why)
- [agentsy-prd-notes.md](./agentsy-prd-notes.md) — research ADRs with primary source citations
- [vercel/ai tool-loop-agent.ts](https://github.com/vercel/ai/blob/main/packages/ai/src/agent/tool-loop-agent.ts) — prepareStep, mergeCallbacks, toolApproval, repairToolCall
- [TanStack AI processor.ts](https://github.com/TanStack/ai/blob/main/packages/typescript/ai/src/activities/chat/stream/processor.ts) — per-message state, lazy creation, ChunkStrategy, TOOL_CALL_END dual role
- [nanobot memory.md](https://github.com/HKUDS/nanobot/blob/main/docs/memory.md) — 2-stage memory, cursor-JSONL, Dream config
- [MCP 2025-06-18 spec](https://spec.modelcontextprotocol.io)
- [libSQL vector docs](https://turso.tech/libsql)
- [Turborepo tasks](https://turbo.build/repo/docs/crafting-your-repository/configuring-tasks)
