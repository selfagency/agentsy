# Phase 2 — First Dogfoodable TUI Vertical Slice

**Effort:** ~11 hours  
**Milestone:** First interactive streaming TUI chat (single provider, no tools)  
**Packages:** `@agentsy/renderers`, `@agentsy/providers`, `@agentsy/core`, `@agentsy/runtime`, `@agentsy/cli`  
**Gate:** `pnpm check-types` + `pnpm test`; `chat-streaming.e2e.test.ts` passes  
**Next:** Phase 3

---

## Overview

Ship first interactive streaming TUI chat. Single provider, no tools yet. All infrastructure pre-validated in Phase 0-1.

**Key Principle:** Every component is wire-up + polish, not architectural change.

---

## Vertical Slice Sequence

```text
renderers (Ink TUI) → providers (wire path) → core (stream norm)
  → runtime (turn loop) → renderers (CLI bridge) → cli (E2E + readline)
```

---

## TASK-089: Acid ANSI BBS Visual System

**Owner:** Renderers team  
**Effort:** ~1.5 hours  
**Location:** `packages/renderers/src/ink/theme/`

### Deliverables

#### 1. Semantic ANSI Tokens (`palette.ts`)

```typescript
export const AcidPalette = {
  assistant: chalk.cyan, // Cyan for AI responses
  user: chalk.green, // Green for user input
  success: chalk.green, // Green for confirmations
  warning: chalk.yellow, // Yellow for cautions
  error: chalk.red, // Red for errors
  secondary: chalk.dim, // Dim for secondary info
  emphasis: chalk.bright, // Bright for emphasis
  pending: chalk.yellow // Yellow for pending states
} as const;
```

#### 2. Frame Primitives (`frames.ts`)

```typescript
export function box(content: string, opts: FrameOpts): string;
export function border(content: string, opts: BorderOpts): string;
export function separator(width: number, opts?: SeparatorOpts): string;
export function titleBar(title: string, width: number): string;
export function asciiBanner(title: string): string;
```

#### 3. ASCII Banner (`ascii.ts`)

```typescript
export function renderBanner(text: string, maxWidth: number): string;
// Produces:
// ╔════════════════════╗
// ║    @agentsy CLI    ║
// ╚════════════════════╝
```

#### 4. Motion + Accessibility (`motion.ts`)

```typescript
export const reduceMotion = process.env.REDUCE_MOTION === 'true';

export function animationDuration(): number {
  return reduceMotion ? 0 : 300; // ms
}

// All Ink components use this
```

**Quality gates:**

- ✅ All components tested in `__tests__/theme.test.ts`
- ✅ Colors tested for 4.5:1 contrast (REQ-025)
- ✅ Accessibility: motion reducer respected (REQ-018)

---

## TASK-072: Chat/Dialog Components

**Owner:** Renderers team  
**Effort:** ~2.5 hours  
**Location:** `packages/renderers/src/ink/components/chat/`

### Deliverables

#### 1. Transcript (`transcript.tsx`)

```typescript
export interface TranscriptProps {
  messages: Message[];
  scrollable?: boolean;
  maxHeight?: number;
}

export const Transcript: React.FC<TranscriptProps> = ({ messages, scrollable = true, maxHeight }) => {
  // Renders scrollable message history
  // User messages right-aligned (green)
  // Assistant messages left-aligned (cyan)
  // Proper line wrapping + timestamps
};
```

#### 2. Message Bubble (`message-bubble.tsx`)

```typescript
export interface MessageBubbleProps {
  content: string;
  role: 'user' | 'assistant';
  timestamp?: Date;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ content, role, timestamp }) => {
  // Role-based styling + ANSI accent
};
```

#### 3. Streaming Cursor (`streaming-cursor.tsx`)

```typescript
export const StreamingCursor: React.FC = () => {
  // Animated blinking cursor for active streaming
  // Respects REDUCE_MOTION
};
```

#### 4. Token Meter (`token-meter.tsx`)

```typescript
export interface TokenMeterProps {
  input: number;
  output: number;
  total: number;
  budget?: number;
}

export const TokenMeter: React.FC<TokenMeterProps> = ({ input, output, total, budget }) => {
  // Renders: input: 234 | output: 567 | total: 801 / 4000
  // Color-codes when approaching budget
};
```

#### 5. Status Footer (`status-footer.tsx`)

```typescript
export interface StatusFooterProps {
  connection: 'connected' | 'connecting' | 'disconnected';
  model?: string;
  elapsed?: number;
}

export const StatusFooter: React.FC<StatusFooterProps> = ({ connection, model, elapsed }) => {
  // Bottom bar: connection status | model | elapsed time
};
```

**Quality gates:**

- ✅ All components tested in `__tests__/chat/`
- ✅ Snapshot tests for consistent output
- ✅ Prop types validated

---

## TASK-073: Stream-Event Components

**Owner:** Renderers team  
**Effort:** ~1.5 hours  
**Location:** `packages/renderers/src/ink/components/stream-events/`

### Deliverables

#### 1. Model Delta (`model-delta.tsx`)

```typescript
export interface ModelDeltaProps {
  delta: string;
  isThinking?: boolean;
}

export const ModelDelta: React.FC<ModelDeltaProps> = ({ delta, isThinking }) => {
  // Stream text content with optional thinking indicator
};
```

#### 2. Thinking Block (`thinking-block.tsx`)

```typescript
export interface ThinkingBlockProps {
  content: string;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ content, expanded = false, onToggle }) => {
  // Collapsible thinking block (dim gray by default)
  // Arrow indicator: ▼ / ▶
};
```

#### 3. Tool Lifecycle (`tool-lifecycle.tsx`)

```typescript
export type ToolState = 'calling' | 'executing' | 'done' | 'error';

export interface ToolLifecycleProps {
  name: string;
  state: ToolState;
  args?: Record<string, unknown>;
  result?: string;
  error?: string;
}

export const ToolLifecycle: React.FC<ToolLifecycleProps> = ({ name, state, args, result, error }) => {
  // Animated state transitions
  // Shows args/result inline or collapsed
};
```

#### 4. Approval State (`approval-state.tsx`)

```typescript
export interface ApprovalStateProps {
  pending: PendingApproval[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  countdownMs?: number;
}

export const ApprovalState: React.FC<ApprovalStateProps> = ({ pending, onApprove, onReject, countdownMs = 30000 }) => {
  // Countdown timer + [A]pprove / [R]eject keybinds
};
```

**Quality gates:**

- ✅ All components tested
- ✅ Stream animation smooth (no jank)
- ✅ Proper ANSI color usage

---

## TASK-085: Provider/Model Chooser

**Owner:** Renderers team  
**Effort:** ~1 hour  
**Location:** `packages/renderers/src/ink/components/model-picker/`

### Deliverables

#### 1. Search Input (`search-input.tsx`)

```typescript
export interface SearchInputProps {
  placeholder?: string;
  onSearch: (query: string) => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({ placeholder = 'Search providers/models...', onSearch }) => {
  // Type to filter; clear with Ctrl+C
};
```

#### 2. Provider List (`provider-list.tsx`)

```typescript
export interface ProviderListProps {
  providers: ProviderProfile[];
  selected?: string;
  onSelect: (providerId: string) => void;
}

export const ProviderList: React.FC<ProviderListProps> = ({ providers, selected, onSelect }) => {
  // Scrollable list with arrow navigation
  // Status indicator: ✓ connected | ✗ error | ⋯ checking
};
```

#### 3. Model Select (`model-select.tsx`)

```typescript
export interface ModelSelectProps {
  models: ModelProfile[];
  selected?: string;
  onSelect: (modelId: string) => void;
}

export const ModelSelect: React.FC<ModelSelectProps> = ({ models, selected, onSelect }) => {
  // Nested under selected provider
  // Shows capability badges: tool-use | vision | streaming
};
```

#### 4. Scope Toggle (`scope-toggle.tsx`)

```typescript
export interface ScopeToggleProps {
  scope: 'local' | 'cloud' | 'all';
  onScope: (scope: typeof scope) => void;
}

export const ScopeToggle: React.FC<ScopeToggleProps> = ({ scope, onScope }) => {
  // [L]ocal [C]loud [A]ll
};
```

**Quality gates:**

- ✅ Keyboard navigation (arrows, Enter, Escape)
- ✅ Search responsive (<100ms filter)
- ✅ Tested with mock providers

---

## TASK-008: Provider Request Path

**Owner:** Providers team  
**Effort:** ~1 hour  
**Location:** `packages/providers/src/request-path.ts`

### Deliverables

```typescript
export interface RequestHandler {
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  stream(req: CompletionRequest): ReadableStream<NormalizedChunk>;
}

export function createRequestHandler(providers: ProviderRegistry, model?: string): RequestHandler {
  return {
    async complete(req) {
      const provider = providers.select(model || req.model);
      const normalized = provider.normalizeRequest(req);
      const raw = await provider.complete(normalized);
      return provider.normalizeResponse(raw);
    },

    stream(req) {
      const provider = providers.select(model || req.model);
      const normalized = provider.normalizeRequest(req);
      return provider.stream(normalized);
    }
  };
}
```

**Quality gates:**

- ✅ Minimal: OpenAI-compatible adapter + mock provider
- ✅ Type-safe request/response mapping
- ✅ Tested with MSW mock server (Phase 1)

---

## TASK-009: Stream Normalization

**Owner:** Core team  
**Effort:** ~1 hour (mostly already done, verify exports)  
**Location:** `packages/core/src/stream-to-events.ts`

### Deliverables

```typescript
export type StreamEvent =
  | { type: 'text-delta'; content: string; chunkIndex: number }
  | { type: 'thinking-delta'; content: string; chunkIndex: number }
  | { type: 'tool-call-start'; id: string; name: string; chunkIndex: number }
  | { type: 'tool-call-end'; id: string; result: unknown; chunkIndex: number }
  | { type: 'error'; error: Error; chunkIndex: number }
  | { type: 'done'; finishReason: string; chunkIndex: number };

export function createStreamEventAdapter(stream: ReadableStream<NormalizedChunk>): ReadableStream<StreamEvent> {
  // Converts raw normalized chunks to typed events
  // Validates state machine (tool-call-start → tool-call-end, etc)
}
```

**Quality gates:**

- ✅ State machine validation
- ✅ Proper error propagation
- ✅ All event types tested

---

## TASK-010: Text-Only Turn Loop

**Owner:** Runtime team  
**Effort:** ~0.5 hours (scaffold + wire existing)  
**Location:** `packages/runtime/src/loop/simple-turn.ts`

### Deliverables

```typescript
export interface SimpleTurnLoopOptions {
  requestHandler: RequestHandler;
  streamAdapter: StreamEventAdapter;
  onText?: (content: string) => void;
  onThinking?: (content: string) => void;
  onToolCall?: (call: ToolCall) => void;
  onDone?: (finishReason: string) => void;
}

export async function createSimpleTurnLoop(options: SimpleTurnLoopOptions): Promise<AgentLoopHandle> {
  return {
    async step(userMessage: string) {
      const request = { messages: [{ role: 'user', content: userMessage }] };
      const stream = options.requestHandler.stream(request);
      const events = options.streamAdapter(stream);

      for await (const event of events) {
        if (event.type === 'text-delta') options.onText?.(event.content);
        if (event.type === 'thinking-delta') options.onThinking?.(event.content);
        if (event.type === 'tool-call-start') options.onToolCall?.(event);
        if (event.type === 'done') options.onDone?.(event.finishReason);
      }
    }
  };
}
```

**No tool execution in Phase 2** — callbacks are stubs.

**Quality gates:**

- ✅ Streaming validated (callbacks fire in order)
- ✅ Error handling (no unhandled rejections)

---

## TASK-011: CLI Bridge

**Owner:** CLI team  
**Effort:** ~1.5 hours  
**Location:** `packages/renderers/src/adapters/cli-bridge.ts` + `packages/cli/src/tui/session-renderer.tsx`

### Deliverables

#### 1. Stream Bridge (`cli-bridge.ts`)

```typescript
export function createCliStreamBridge(stream: ReadableStream<StreamEvent>): ReadableStream<RenderedFrame> {
  // Converts stream events to Ink render frames
  // Handles buffering, debouncing for smooth display
}
```

#### 2. Session Renderer (`session-renderer.tsx`)

```typescript
export const InkSessionRenderer: React.FC<InkSessionRendererProps> = ({
  model,
  connection,
  onSubmit,
}) => {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [streaming, setStreaming] = React.useState(false);
  const [tokens, setTokens] = React.useState({ input: 0, output: 0, total: 0 });

  return (
    <Box flexDirection=\"column\">
      <Transcript messages={messages} />
      <StatusFooter connection={connection} model={model} />
      <TokenMeter {...tokens} />
      <Input onSubmit={onSubmit} disabled={streaming} />
    </Box>
  );
};
```

**Quality gates:**

- ✅ Smooth streaming (no frame drops)
- ✅ Proper cleanup (abort controller on unmount)
- ✅ Responsive to input events

---

## TASK-012: E2E Chat Streaming Test

**Owner:** CLI team  
**Effort:** ~1.5 hours  
**Location:** `packages/cli/src/e2e/chat-streaming.e2e.test.ts`

### Test Coverage

```typescript
describe('Chat Streaming E2E', () => {
  // 1. Mock provider → request path → events → bridge → output
  test('streaming renders text deltas', async () => {
    // Verify token meter updates
    // Verify thinking block rendered
    // Verify final count correct
  });

  test('thinking blocks toggle', async () => {
    // Verify collapsed by default
    // Verify expand on arrow key
  });

  test('error recovery', async () => {
    // Provider 500 → error displayed
    // Can retry with same input
  });

  test('model selection persists', async () => {
    // Select gpt-4o
    // Verify used in next request
    // Verify persisted to session
  });

  test('early exit (Ctrl+C)', async () => {
    // Streaming in progress
    // Press Ctrl+C
    // Verify stream aborted gracefully
  });
});
```

**Quality gates:**

- ✅ All tests pass with MSW mock server
- ✅ No flaky timing issues
- ✅ Deterministic fixtures

---

## Integration Checklist

### Week 1: Renderers

- [ ] TASK-089: Acid palette + frames complete
- [ ] TASK-072: Chat components complete
- [ ] TASK-073: Stream-event components complete
- [ ] TASK-085: Model picker complete
- [ ] All components tested + documented

### Week 2: Core Flow

- [ ] TASK-008: Request path wired
- [ ] TASK-009: Stream-to-events verified
- [ ] TASK-010: Turn loop scaffolded
- [ ] TASK-011: CLI bridge wired
- [ ] MSW bootstrap from Phase 1 integrated

### Week 3: E2E + Polish

- [ ] TASK-012: E2E tests pass
- [ ] `pnpm check-types` monorepo green
- [ ] `pnpm test` monorepo green
- [ ] CLI can chat interactively with streaming
- [ ] Documentation complete

---

## Quality Gates (All Required Before Merging)

- ✅ `pnpm build` green
- ✅ `pnpm check-types` green
- ✅ `pnpm test` green (including `chat-streaming.e2e.test.ts`)
- ✅ No linting violations
- ✅ No circular dependencies introduced
- ✅ Accessibility: 4.5:1 contrast, motion reducer respected
- ✅ Performance: first token <500ms, streaming >60fps

---

## Success Criteria

✅ Interactive streaming chat works end-to-end  
✅ Single provider, no tools yet  
✅ All components tested in isolation + E2E  
✅ Production-quality rendering (no jank)  
✅ Ready to add model selection in Phase 3

---

## Effort Breakdown

| Task                     | Hours         |
| ------------------------ | ------------- |
| TASK-089 (Palette)       | 1.5           |
| TASK-072 (Chat)          | 2.5           |
| TASK-073 (Stream events) | 1.5           |
| TASK-085 (Model picker)  | 1             |
| TASK-008 (Request path)  | 1             |
| TASK-009 (Stream norm)   | 1             |
| TASK-010 (Turn loop)     | 0.5           |
| TASK-011 (Bridge)        | 1.5           |
| TASK-012 (E2E)           | 1.5           |
| **Total**                | **~12 hours** |

---

**Next phase:** `05-PHASE-3-MODEL-SELECTION.md`
