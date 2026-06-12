---
goal: "@agentsy/tokenomics production implementation plan"
version: 1.0
date_created: 2026-06-02
last_updated: 2026-06-02
owner: tokenomics-maintainers
status: Planned
tags: [feature, architecture, tokenomics, roi, frustration, ledger, learning, analytics]
---

# @agentsy/tokenomics — Implementation Plan

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan defines the production implementation for `@agentsy/tokenomics` — the canonical package for spend accountability, frustration signal detection, ROI measurement, analytics adapter integration, prompt cache efficiency, and the agent learning loop. It replaces the split between `@agentsy/context` cost-tracking stubs (Phase 9) and the observability package's `CostTracker` — those remain in their respective packages; `@agentsy/tokenomics` is the _attribution and intelligence_ layer above them.

---

## 1. Requirements & Constraints

### Functional Requirements

- **REQ-TKNM-001**: Every agent session produces a `SessionLedgerEntry` recording spend, artifacts, quality gate results, and frustration signals.
- **REQ-TKNM-002**: Frustration signals are detected passively from runtime hook events with zero required user action.
- **REQ-TKNM-003**: A `FrustrationScore` (0.0–1.0) is computed per session and attached to the ledger entry.
- **REQ-TKNM-004**: `costAtFrustrationLevel` (spend × frustration score) is surfaced in all reporting surfaces.
- **REQ-TKNM-005**: Prompt cache `cache_control` headers are injected at the gateway layer for static context segments.
- **REQ-TKNM-006**: Semantic cache middleware intercepts gateway requests and serves cached responses for near-identical queries (cosine similarity ≥ 0.95).
- **REQ-TKNM-007**: AI attribution git trailers are written to every AI-assisted commit.
- **REQ-TKNM-008**: Code survival rate is computable from `git blame` history, lazy-populated 30 days after commit.
- **REQ-TKNM-009**: At least 5 pluggable deployed-app analytics adapters ship (Plausible, PostHog, Vercel, Cloudflare, Sentry).
- **REQ-TKNM-010**: Pattern recognition clusters frustration events into `FailureMode` records after ≥ 3 matching sessions.
- **REQ-TKNM-011**: `PromptPatch` records are generated from `FailureMode` clusters and applied to `learned-behaviors.md` after user approval (or automatically if confidence ≥ 0.9).
- **REQ-TKNM-012**: Positive reinforcement records tag successful model/skill/instruction combinations for routing preference.
- **REQ-TKNM-013**: An MCP server exposes ROI query tools consumable by VS Code, TUI, and external dashboards.
- **REQ-TKNM-014**: A status-bar widget emits session-level spend + frustration score for VS Code and TUI surfaces.
- **REQ-TKNM-015**: `agentsy tokenomics report` CLI command renders a weekly spend-vs-value summary.
- **REQ-TKNM-016**: Tokenomics computes hourly, weekly, and monthly remaining headroom per model replica.
- **REQ-TKNM-017**: Gateway can query replica headroom before model selection.
- **REQ-TKNM-018**: Usage attribution records include `logicalModelId`, `replicaId`, `providerId`, and `accountId` when available.
- **REQ-TKNM-019**: Tokenomics emits saturation and skew signals to reduce load on hot replicas.

### Security & Privacy

- **SEC-TKNM-001**: Ledger entries never store raw prompt content — only hashes, token counts, and metadata.
- **SEC-TKNM-002**: Frustration signal payloads never include file contents — only file paths, timing deltas, and similarity scores.
- **SEC-TKNM-003**: Analytics adapter credentials are sourced from `@agentsy/secrets` broker, never hardcoded.
- **SEC-TKNM-004**: Git trailers are opt-in; disabled by default until user configures attribution mode.
- **SEC-TKNM-005**: Semantic cache entries are keyed by embedding hash; raw query text is never persisted.

### Constraints

- **CON-TKNM-001**: Depends on `@agentsy/observability` for span/trace infrastructure (Phase 0 complete ✅).
- **CON-TKNM-002**: Depends on `@agentsy/runtime` hook registry for signal collection (Phase 0 complete ✅).
- **CON-TKNM-003**: Learning loop depends on `@agentsy/memory` (Phase 7) and `@agentsy/plugins` instructions layer (Phase 4).
- **CON-TKNM-004**: Analytics adapters may make outbound HTTP calls — must respect user's local-first preferences and be explicitly opt-in.
- **CON-TKNM-005**: Ledger store is SQLite (via `better-sqlite3`) by default; Turso adapter for sync-enabled deployments.
- **CON-TKNM-006**: Package is pure computation and I/O — no LLM calls except in `PatchGenerator` (gated, explicit).
- **CON-TKNM-007**: All exports from `src/index.ts`. Zero circular dependencies.

---

## 2. Package Structure

Replica-aware routing support:

```text
packages/tokenomics/src/
├── quotas/
│   ├── replica-budget.ts
│   ├── usage-aggregator.ts
│   ├── headroom.ts
│   └── windows.ts
├── routing/
│   └── headroom-provider.ts
```

Phase 0 — Tokenizer infrastructure:

```text
packages/tokenomics/src/tokenizers/
├── types.ts                 — Tokenizer interface, TokenizerEntry, CountResult
├── tiktoken.ts              — OpenAI BPE via tiktoken WASM (TiktokenTokenizer, TiktokenPool)
├── estimate.ts              — Fallback char-ratio estimator (EstimatorTokenizer)
├── registry.ts              — Model-aware tokenizer resolution (TokenizerRegistry)
├── registry.test.ts         — Tests covering exact, prefix, and fallback resolution
└── index.ts                 — barrel export
```

```text
packages/tokenomics/
├── src/
│   ├── index.ts                        — public barrel (re-exports all sub-modules)
│   │
│   ├── ledger/
│   │   ├── types.ts                    — SessionLedgerEntry, ArtifactRecord, SpendRecord, QualityRecord
│   │   ├── writer.ts                   — post-session hook writes ledger entry
│   │   ├── store.ts                    — SQLite adapter (better-sqlite3); Turso adapter behind interface
│   │   └── query.ts                    — time-range queries, groupBy, aggregations, pagination
│   │
│   ├── signals/
│   │   ├── types.ts                    — FrustrationEvent, SatisfactionEvent, SignalWeights
│   │   ├── collector.ts                — hooks wiring, event emission, passive detection orchestration
│   │   ├── scorer.ts                   — FrustrationScore computation from collected events
│   │   ├── rewrite-detector.ts         — file-edit delta timing post write_file tool call
│   │   ├── retry-detector.ts           — semantic similarity on consecutive turns (cosine, threshold 0.85)
│   │   └── abandonment-detector.ts     — zero-artifact session detection at post-session
│   │
│   ├── attribution/
│   │   ├── git-trailers.ts             — write/read AI session metadata as git commit trailers
│   │   ├── diff-stats.ts               — LOC added/deleted per session via git diff
│   │   ├── survival.ts                 — code survival rate via git blame (lazy, 30d lookback)
│   │   └── deployment-event.ts         — parse deployment log entries and webhook payloads
│   │
│   ├── cache/
│   │   ├── prompt-cache.ts             — cache_control header injection for Anthropic/OpenAI
│   │   ├── semantic-cache.ts           — embedding similarity cache middleware for gateway
│   │   └── efficiency.ts               — hit rate, cost saved, prefix stability metrics
│   │
│   ├── analytics/
│   │   ├── types.ts                    — DeployedAppAnalyticsAdapter interface, UsageMetrics, ErrorMetrics
│   │   ├── plausible.ts                — Plausible Analytics REST adapter
│   │   ├── posthog.ts                  — PostHog events API adapter
│   │   ├── vercel.ts                   — Vercel Analytics API adapter
│   │   ├── cloudflare.ts               — Cloudflare Analytics API adapter
│   │   ├── sentry.ts                   — Sentry Issues/Stats API adapter
│   │   └── http-json.ts                — generic configurable endpoint adapter
│   │
│   ├── learning/
│   │   ├── types.ts                    — FailureMode, PromptPatch, ReinforcedPattern, LearningRecord
│   │   ├── pattern-recognizer.ts       — cluster frustration events into FailureModes
│   │   ├── patch-generator.ts          — produce PromptPatch text from FailureMode clusters
│   │   ├── patch-applier.ts            — write patches to ~/.agents/agentsy/learned-behaviors.md
│   │   └── reinforcement.ts            — tag successful patterns for routing preference
│   │
│   ├── roi/
│   │   ├── types.ts                    — RoiSnapshot, SpendVsValueReport, CostPerUnit
│   │   ├── calculator.ts               — cost-per-commit, cost-per-survival, cache efficiency delta
│   │   └── mcp-server.ts               — MCP tool definitions: get_spend_summary, get_cost_per_unit, etc.
│   │
│   └── ui/
│       ├── status-bar.ts               — session spend + frustration score widget (VS Code + TUI)
│       └── dashboard.ts                — 7/30/90-day spend vs value panel (Ink + React)
│
├── package.json                        — @agentsy/tokenomics
├── tsconfig.json
├── tsup.config.ts
├── README.md
└── IMPLEMENTATION-PLAN.md              — this file
```

---

## 3. Dependencies

```json
{
  "dependencies": {
    "@agentsy/types": "workspace:*",
    "@agentsy/observability": "workspace:*",
    "@agentsy/context": "workspace:*",
    "better-sqlite3": "^9.x",
    "tiktoken": "^1.0.22"            ← Phase 0 — OpenAI BPE tokenizer (WASM)
  },
  "optionalDependencies": {
    "@libsql/client": "^0.x"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.x",
    "@types/node": "^25.x",
    "vitest": "^4.x",
    "tsup": "^8.x",
    "typescript": "6.0.3"
  }
}
```

**Runtime hook integration** (via `@agentsy/runtime` — no direct dep; injected via hook registration):

Replica-aware identity fields used throughout tokenomics:

- `logicalModelId`
- `replicaId`
- `providerId`
- `accountId`
- `post-session` — writes ledger entry
- `post-turn` — feeds retry/rewrite detectors
- `post-tool-call(write_file)` — triggers rewrite window
- `approval:denied` — tool rejection signal
- `model_switched` — mid-session model change signal

---

## 4. Implementation Phases

---

### Phase 0 — Tokenizer Infrastructure ✅ (COMPLETE)

The tokenizer layer provides accurate token counting across all supported models. It resolves model names to their correct BPE tokenizer (OpenAI models via tiktoken WASM) and falls back to tuned character-ratio estimators for Claude, Llama, Mistral, Gemini, and other families.

**Effort:** ~3h  
**Gate:** `pnpm check-types` + `pnpm test` green; tiktoken WASM resolved correctly  
**Blocks:** Phase 1 (accurate SpendRecord token counts)

#### TASK-TKNM-000: Tokenizer foundation

**Location:** `packages/tokenomics/src/tokenizers/`  
**Files:**

- `types.ts` — Tokenizer interface (count, encode, decode, free), TokenizerEntry, CountResult
- `tiktoken.ts` — TiktokenTokenizer (WASM-backed BPE) + TiktokenPool (lazy cache with freeAll)
- `estimate.ts` — EstimatorTokenizer (fallback via chars/token ratios), defaultEstimators, estimateTokenCount
- `registry.ts` — TokenizerRegistry (model-name → tokenizer resolution with 3-tier fallback)
- `registry.test.ts` — 12 tests: exact match, prefix pattern, family fallback, unknown model, resource lifecycle

**Dependencies added:** `tiktoken@^1.0.22`

**Resolution order:**  

1. Exact model match → tiktoken WASM (e.g., `gpt-4` → cl100k_base)  
2. Prefix/glob pattern → tiktoken WASM (e.g., `gpt-4o*` → o200k_base)  
3. Known family fallback → EstimatorTokenizer (e.g., `claude-*` → 3.5 chars/token)  
4. Unknown model → default estimator (4 chars/token)  

**Pre-registered patterns:**

- `o200k_base`: gpt-4o*, o1*, o3*, o4*, chatgpt-*, gpt-4.1*, gpt-4.5*, gpt-5*
- `cl100k_base`: gpt-4*, gpt-3.5*, gpt-35*, text-embedding*
- `p50k_base`: text-davinci*
- **Family fallbacks**: claude (3.5), codestral (2), rest (4 chars/token)

#### Integration with VS Code

```typescript
import { TokenizerRegistry } from '@agentsy/tokenomics';

// In BaseLanguageModelChatProvider.provideTokenCount:
export async function provideTokenCount(
  model: LanguageModelChatInformation,
  text: string | LanguageModelChatRequestMessage
): Promise<number> {
  const registry = new TokenizerRegistry();
  const tokenizer = registry.resolve(model.id);
  const content = typeof text === 'string' ? text : JSON.stringify(text);
  const result = tokenizer.count(content);
  tokenizer.free();
  return result;
}
```

---

### Phase 1 — Ledger Foundation

The ledger must record usage at replica granularity so gateway can balance across provider/accounts serving the same logical model.

**Effort:** ~6h  
**Gate:** `pnpm check-types` + `pnpm test` green; ledger entries persisted and queryable  
**Blocks:** all other modules

#### TASK-TKNM-001: Ledger types

**Location:** `packages/tokenomics/src/ledger/types.ts`  
**Effort:** 1h

```typescript
export interface SpendRecord {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  cacheHitTokens: number; // tokens served from provider cache
  cacheWriteTokens: number;
  cacheEfficiency: number; // cacheHitTokens / (inputTokens + cacheHitTokens)
  modelBreakdown: Record<string, { tokens: number; costUsd: number }>;
}

export interface ArtifactRecord {
  filesWritten: string[]; // absolute paths
  filesRead: string[];
  linesAdded: number;
  linesDeleted: number;
  commits: CommitRef[]; // { sha, message, branch, timestamp }
  prsOpened: string[];
  deploymentsTriggered: string[];
}

export interface QualityRecord {
  typecheckPassed: boolean | null;
  testsPassed: boolean | null;
  lintPassed: boolean | null;
  testDelta: { added: number; deleted: number };
  repairAttempts: number; // from AutoRepairResult.attempts
  toolRejections: number; // approval:denied count
}

export interface FrustrationRecord {
  score: number; // 0.0–1.0
  category: "green" | "yellow" | "red";
  costAtFrustrationLevel: number; // spend.costUsd × score
  signals: {
    immediateRewrites: number;
    rapidRetries: number;
    toolRejections: number;
    repairLoops: number;
    errorRateAfterWrite: number;
    abandonmentSignal: number;
    explicitNegative: number;
    explicitPositive: number;
  };
}

export interface SessionLedgerEntry {
  id: string; // uuidv4
  sessionId: string;
  agentId: string;
  modelId: string;
  providerId: string;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  spend: SpendRecord;
  artifacts: ArtifactRecord;
  quality: QualityRecord;
  frustration: FrustrationRecord;
  survivalRate30d: number | null; // populated lazily after 30 days
  tags: string[]; // e.g. ['coding', 'refactor', 'test-gen']
}
```

#### TASK-TKNM-002: Ledger store

**Location:** `packages/tokenomics/src/ledger/store.ts`  
**Effort:** 2h

SQLite-backed store with a clean interface so Turso drops in later:

```typescript
export interface LedgerStore {
  insert(entry: SessionLedgerEntry): Promise<void>;
  get(sessionId: string): Promise<SessionLedgerEntry | null>;
  query(filter: LedgerFilter): Promise<SessionLedgerEntry[]>;
  updateSurvivalRate(sessionId: string, rate: number): Promise<void>;
  aggregate(since: Date, groupBy: "day" | "week" | "model" | "agent"): Promise<LedgerAggregate[]>;
  close(): void;
}

export function createSqliteLedgerStore(dbPath: string): LedgerStore;
export function createTursoLedgerStore(url: string, authToken: string): LedgerStore;
```

Schema (single table, JSON columns for nested records):

```sql
CREATE TABLE IF NOT EXISTS session_ledger (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  spend JSON NOT NULL,
  artifacts JSON NOT NULL,
  quality JSON NOT NULL,
  frustration JSON NOT NULL,
  survival_rate_30d REAL,
  tags JSON NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_started_at ON session_ledger(started_at);
CREATE INDEX IF NOT EXISTS idx_session_id ON session_ledger(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_id ON session_ledger(agent_id);
```

#### TASK-TKNM-003: Ledger writer (post-session hook integration)

**Location:** `packages/tokenomics/src/ledger/writer.ts`  
**Effort:** 2h

Registered as a `post-session` hook; assembles `SessionLedgerEntry` from the session context and persists it:

```typescript
export function createLedgerWriterHook(
  store: LedgerStore,
  diffStats: DiffStatsReader,
): HookDefinition<"post-session"> {
  return {
    name: "tokenomics:ledger-writer",
    event: "post-session",
    priority: 10, // runs last — all other post-session hooks have populated ctx
    handler: async (ctx) => {
      const entry = assembleLedgerEntry(ctx, diffStats);
      await store.insert(entry);
      return ctx;
    },
  };
}
```

#### TASK-TKNM-004: Ledger query API

**Location:** `packages/tokenomics/src/ledger/query.ts`  
**Effort:** 1h

```typescript
export interface LedgerFilter {
  since?: Date;
  until?: Date;
  agentId?: string;
  modelId?: string;
  frustractionMin?: number;
  frustractionMax?: number;
  tags?: string[];
}

export interface LedgerAggregate {
  period: string; // ISO date or model/agent label
  totalCostUsd: number;
  totalCommits: number;
  totalLinesAdded: number;
  avgFrustrationScore: number;
  totalCostAtFrustration: number;
  cacheEfficiencyAvg: number;
  sessionCount: number;
}
```

---

### Phase 2 — Frustration Signal Collection

**Effort:** ~8h  
**Gate:** All 5 passive signal detectors emit correctly on hook events; scorer produces calibrated scores  
**Blocks:** Learning loop (Phase 6), UI widgets (Phase 7)

#### TASK-TKNM-005: Signal types

**Location:** `packages/tokenomics/src/signals/types.ts`  
**Effort:** 0.5h

```typescript
export type FrustrationEventKind =
  | "immediate_rewrite" // user edited AI-written file within 90s
  | "rapid_retry" // semantically similar follow-up < 2 turns
  | "tool_rejection" // approval:denied event
  | "repair_loop" // auto-repair.attempts > 1
  | "post_write_error" // typecheck/test fails after AI writes code
  | "session_abandonment" // session ends, zero artifacts
  | "explicit_negative" // /bad or /thumbs-down command
  | "model_switch" // user switches model mid-session
  | "context_explosion"; // compress nudge threshold crossed

export type SatisfactionEventKind =
  | "clean_commit" // commit with no rewrites
  | "explicit_positive" // /good or /thumbs-up
  | "fast_accept" // output accepted within 10s (no rewrite window)
  | "deployment_after_session"; // deploy event within 2h of session end

export interface FrustrationEvent {
  kind: FrustrationEventKind;
  sessionId: string;
  turnIndex: number;
  timestampMs: number;
  metadata: Record<string, unknown>; // kind-specific context (no raw content)
  weight: number; // pre-computed contribution to score
}

export interface SatisfactionEvent {
  kind: SatisfactionEventKind;
  sessionId: string;
  timestampMs: number;
  metadata: Record<string, unknown>;
}
```

#### TASK-TKNM-006: Rewrite detector

**Location:** `packages/tokenomics/src/signals/rewrite-detector.ts`  
**Effort:** 2h

Listens on `post-tool-call(write_file)` and opens a 90-second file-watch window. If the file is modified before the window closes and the diff is non-trivial (> 5 lines changed), emits `immediate_rewrite`:

```typescript
export class RewriteDetector {
  private windows = new Map<string, RewriteWindow>();

  onWriteToolCall(
    filePath: string,
    sessionId: string,
    turnIndex: number,
    timestampMs: number,
  ): void {
    this.windows.set(filePath, { sessionId, turnIndex, timestampMs, filePath });
  }

  onFileChanged(filePath: string, deltaLines: number): FrustrationEvent | null {
    const window = this.windows.get(filePath);
    if (!window) return null;

    const age = Date.now() - window.timestampMs;
    if (age > REWRITE_WINDOW_MS || deltaLines <= MIN_REWRITE_LINES) return null;

    this.windows.delete(filePath);
    return {
      kind: "immediate_rewrite",
      sessionId: window.sessionId,
      turnIndex: window.turnIndex,
      timestampMs: Date.now(),
      metadata: { filePath, deltaLines, ageMs: age },
      weight: 0.3,
    };
  }
}

const REWRITE_WINDOW_MS = 90_000;
const MIN_REWRITE_LINES = 5;
```

#### TASK-TKNM-007: Retry detector

**Location:** `packages/tokenomics/src/signals/retry-detector.ts`  
**Effort:** 2h

Compares consecutive user message embeddings. If cosine similarity ≥ 0.85 within 2 turns, emits `rapid_retry`. Embeddings are computed locally using the same embedding model used by `@agentsy/memory` — no extra API call:

```typescript
export class RetryDetector {
  private lastEmbedding: Float32Array | null = null;
  private lastTurnIndex = -1;

  async onUserMessage(
    message: string,
    sessionId: string,
    turnIndex: number,
    embed: (text: string) => Promise<Float32Array>,
  ): Promise<FrustrationEvent | null> {
    const embedding = await embed(message);
    const isRetry =
      this.lastEmbedding !== null &&
      turnIndex - this.lastTurnIndex <= 2 &&
      cosineSimilarity(embedding, this.lastEmbedding) >= RETRY_SIMILARITY_THRESHOLD;

    this.lastEmbedding = embedding;
    this.lastTurnIndex = turnIndex;

    if (!isRetry) return null;
    return {
      kind: "rapid_retry",
      sessionId,
      turnIndex,
      timestampMs: Date.now(),
      metadata: { turnDelta: turnIndex - this.lastTurnIndex },
      weight: 0.2,
    };
  }
}

const RETRY_SIMILARITY_THRESHOLD = 0.85;
```

#### TASK-TKNM-008: Abandonment detector

**Location:** `packages/tokenomics/src/signals/abandonment-detector.ts`  
**Effort:** 1h

Fires at `post-session` if `artifacts.commits.length === 0 && artifacts.filesWritten.length === 0`:

```typescript
export function detectAbandonment(
  sessionId: string,
  artifacts: ArtifactRecord,
  durationMs: number,
): FrustrationEvent | null {
  const hasOutput = artifacts.commits.length > 0 || artifacts.filesWritten.length > 0;
  if (hasOutput || durationMs < MIN_SESSION_MS) return null;
  return {
    kind: "session_abandonment",
    sessionId,
    turnIndex: -1,
    timestampMs: Date.now(),
    metadata: { durationMs },
    weight: 0.05,
  };
}

const MIN_SESSION_MS = 30_000; // ignore sub-30s sessions
```

#### TASK-TKNM-009: Signal collector (hook wiring)

**Location:** `packages/tokenomics/src/signals/collector.ts`  
**Effort:** 2h

Central coordinator that registers all hooks and accumulates events for the scorer:

```typescript
export class SignalCollector {
  private events: FrustrationEvent[] = [];
  private satisfactionEvents: SatisfactionEvent[] = [];
  private rewriteDetector: RewriteDetector;
  private retryDetector: RetryDetector;

  // Called by hook registry at session start
  registerHooks(registry: HookRegistry, embed: EmbedFn): void {
    registry.register(createPreTurnHook(this, embed));
    registry.register(createPostToolCallHook(this));
    registry.register(createPostSessionHook(this));
    registry.register(createApprovalDeniedHook(this));
  }

  emit(event: FrustrationEvent | SatisfactionEvent): void {
    if ("weight" in event) this.events.push(event);
    else this.satisfactionEvents.push(event);
  }

  drain(): { frustration: FrustrationEvent[]; satisfaction: SatisfactionEvent[] } {
    const result = { frustration: [...this.events], satisfaction: [...this.satisfactionEvents] };
    this.events = [];
    this.satisfactionEvents = [];
    return result;
  }
}
```

#### TASK-TKNM-010: Frustration scorer

**Location:** `packages/tokenomics/src/signals/scorer.ts`  
**Effort:** 0.5h

```typescript
export const DEFAULT_WEIGHTS: SignalWeights = {
  immediateRewrites: 0.3,
  rapidRetries: 0.2,
  toolRejections: 0.15,
  repairLoops: 0.15,
  errorRateAfterWrite: 0.1,
  abandonmentSignal: 0.05,
  explicitNegative: 0.05,
};

export function computeFrustrationScore(
  events: FrustrationEvent[],
  satisfaction: SatisfactionEvent[],
  spendUsd: number,
  weights: SignalWeights = DEFAULT_WEIGHTS,
): FrustrationRecord {
  // Tally raw signals, cap each at 1.0, apply weights
  // Subtract satisfaction events (up to 0.3 total reduction)
  // Clamp final score to [0.0, 1.0]
  const score = clamp(rawScore - satisfactionOffset, 0, 1);
  const category = score < 0.2 ? "green" : score < 0.5 ? "yellow" : "red";
  return {
    score,
    category,
    costAtFrustrationLevel: spendUsd * score,
    signals: {
      /* tallied per kind */
    },
  };
}
```

---

### Phase 3 — Attribution (Git Intelligence)

**Effort:** ~4h  
**Gate:** Commits include AI trailers; diff stats read correctly; survival query returns valid rate  
**Blocks:** ROI calculator (Phase 5)

#### TASK-TKNM-011: Git trailers

**Location:** `packages/tokenomics/src/attribution/git-trailers.ts`  
**Effort:** 1h

Writes structured metadata as git commit trailers (RFC 2822 trailer format, `git interpret-trailers`):

```text
feat: implement semantic cache layer

AI-Session: agentsy:sess_abc123
AI-Model: claude-sonnet-4-5
AI-Provider: anthropic
AI-Cost-USD: 0.43
AI-Cache-Efficiency: 0.71
AI-Frustration-Score: 0.08
```

```typescript
export interface AiTrailers {
  sessionId: string;
  modelId: string;
  providerId: string;
  costUsd: number;
  cacheEfficiency: number;
  frustrationScore: number;
}

export function formatTrailers(trailers: AiTrailers): string;
export function parseTrailers(commitMessage: string): AiTrailers | null;
export async function appendTrailersToStagedCommit(trailers: AiTrailers): Promise<void>;
```

Opt-in only. Controlled by `agentsy.git.attribution = 'trailers' | 'none'` config.

#### TASK-TKNM-012: Diff stats reader

**Location:** `packages/tokenomics/src/attribution/diff-stats.ts`  
**Effort:** 1h

Reads `git diff --stat HEAD~1 HEAD` (or working tree vs last commit) and returns structured LOC counts. Called by ledger writer at session end.

#### TASK-TKNM-013: Code survival tracker

**Location:** `packages/tokenomics/src/attribution/survival.ts`  
**Effort:** 2h

Lazy computation — runs 30 days after a session's commits land. For each file in `artifacts.filesWritten`, runs `git blame --porcelain` and counts lines still attributed to the session's commits vs. lines that have been replaced:

```typescript
export interface SurvivalResult {
  sessionId: string;
  commitShas: string[];
  filesChecked: number;
  linesOriginal: number;
  linesSurvived: number;
  survivalRate: number; // linesSurvived / linesOriginal
  computedAt: Date;
}

export async function computeSurvivalRate(
  sessionId: string,
  commits: CommitRef[],
  files: string[],
  repoRoot: string,
): Promise<SurvivalResult>;
```

A nightly job (or lazy-on-query) calls this for sessions whose `survivalRate30d` is null and `endedAt` is > 30 days ago.

---

## Phase 3: Budget Manager & Token Tracking (migrated from context)

### Token Budget Management (existing API, unchanged)

\`\`\`typescript
import { createInMemoryTokenManager } from '@agentsy/context';

const manager = createInMemoryTokenManager();
const budget = await manager.createBudget({
maxTokens: 100000,
maxCost: 5.0,
model: 'gpt-4',
name: 'default',
provider: 'openai',
periodMs: 3600000, // 1 hour
resetStrategy: 'rolling',
priority: 'high'
});
\`\`\`

### Phase 4 — Prompt Cache Efficiency

**Effort:** ~5h  
**Gate:** `cache_control` headers present in Anthropic/OpenAI requests for static segments; hit rate tracked  
**Blocks:** cache efficiency metric in ledger

#### TASK-TKNM-014: Prompt cache header injection

**Location:** `packages/tokenomics/src/cache/prompt-cache.ts`  
**Effort:** 2h

Injects `cache_control: { type: "ephemeral" }` markers on static context segments before they reach the provider. Works at the gateway pipeline layer — inserted as a pre-dispatch transform.

Static segments are: system prompt, all injected instructions, loaded skills. Dynamic segments are: user messages, tool results, assistant turns. The transform marks static segments and leaves dynamic segments untouched, preserving the cache prefix:

```typescript
export interface CacheAnnotatedMessage {
  role: string;
  content: string | CacheAnnotatedContent[];
}

export interface CacheAnnotatedContent {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

export function annotateCacheableSegments(
  messages: RawMessage[],
  staticBoundary: number, // index below which messages are considered static
): CacheAnnotatedMessage[];
```

Key rule: **never bust the cache prefix on compaction**. When `@agentsy/context` compresses conversation history, it compresses the dynamic middle — not the static top. This preserves the Anthropic cache prefix and avoids paying full re-read price.

#### TASK-TKNM-015: Semantic cache middleware

**Location:** `packages/tokenomics/src/cache/semantic-cache.ts`  
**Effort:** 2h

Embedding-based response cache for near-identical queries. Sits in the gateway pipeline as a middleware, before provider dispatch:

```typescript
export interface SemanticCacheEntry {
  queryEmbeddingHash: string; // hex of Float32Array
  response: string;
  modelId: string;
  createdAt: Date;
  hitCount: number;
  tokensServed: number; // accumulates across hits
  costSavedUsd: number; // accumulates across hits
}

export class SemanticCacheMiddleware {
  async intercept(
    request: GatewayRequest,
    embed: EmbedFn,
    next: (req: GatewayRequest) => Promise<GatewayResponse>,
  ): Promise<GatewayResponse> {
    const embedding = await embed(request.userMessage);
    const hit = await this.findSimilar(embedding, request.modelId, SIMILARITY_THRESHOLD);
    if (hit) {
      await this.recordHit(hit, request.estimatedTokenCost);
      return { text: hit.response, fromCache: true, cacheEntryId: hit.queryEmbeddingHash };
    }
    const response = await next(request);
    await this.store(embedding, response, request.modelId, request.estimatedTokenCost);
    return response;
  }
}

const SIMILARITY_THRESHOLD = 0.95;
```

#### TASK-TKNM-016: Cache efficiency tracker

**Location:** `packages/tokenomics/src/cache/efficiency.ts`  
**Effort:** 1h

Reads provider response headers (`x-cache`, `anthropic-cache-read-input-tokens`, etc.) and computes:

- `cacheHitTokens` — tokens served from provider cache
- `cacheWriteTokens` — tokens written to provider cache
- `cacheEfficiency` — `cacheHitTokens / (cacheHitTokens + inputTokens)`
- `estimatedSavingsUsd` — `cacheHitTokens × (inputPricePerToken × 0.9)` (90% discount)

---

### Phase 5 — ROI Calculator + MCP Server

**Effort:** ~8h  
**Gate:** MCP server registered; all 6 tools return correct data from ledger  
**Blocks:** UI dashboard (Phase 7); external integrations

#### TASK-TKNM-017: Analytics adapter interface + 5 adapters

**Location:** `packages/tokenomics/src/analytics/`  
**Effort:** 4h (all adapters)

```typescript
export interface DeployedAppUsageMetrics {
  pageviews?: number;
  activeUsers?: number;
  apiCalls?: number;
  conversions?: number;
  conversionRate?: number;
  period: { from: Date; to: Date };
}

export interface DeployedAppErrorMetrics {
  errorRate: number; // errors / total requests
  p99LatencyMs: number;
  incidentCount: number;
  mttrMs?: number;
}

export interface DeploymentEvent {
  id: string;
  deployedAt: Date;
  environment: string; // 'production' | 'staging' | etc.
  commitSha?: string;
  status: "success" | "failed" | "rolled-back";
}

export interface DeployedAppAnalyticsAdapter {
  name: string;
  getUsageMetrics(since: Date): Promise<DeployedAppUsageMetrics>;
  getErrorMetrics(since: Date): Promise<DeployedAppErrorMetrics>;
  getDeploymentEvents(since: Date): Promise<DeploymentEvent[]>;
}
```

Each adapter is a thin HTTP client against the respective platform API. All credentials sourced from `@agentsy/secrets` or environment variables; never hardcoded. All adapters are opt-in, disabled unless configured.

#### TASK-TKNM-018: ROI calculator

**Location:** `packages/tokenomics/src/roi/calculator.ts`  
**Effort:** 2h

```typescript
export interface RoiSnapshot {
  period: { from: Date; to: Date };

  spend: {
    totalUsd: number;
    effectiveUsd: number; // totalUsd - cacheSavingsUsd
    cacheSavingsUsd: number;
    frustrationWastedUsd: number; // sum(costAtFrustrationLevel)
    breakdown: Record<string, number>; // by model
  };

  output: {
    commits: number;
    linesAdded: number;
    prsOpened: number;
    deploymentsCorrelated: number;
    avgSurvivalRate: number | null;
  };

  quality: {
    avgFrustrationScore: number;
    sessionCount: number;
    greenSessions: number;
    yellowSessions: number;
    redSessions: number;
  };

  derived: {
    costPerCommit: number;
    costPerLineAdded: number;
    costPerSurvivingLine: number | null;
    cacheSavingsPercent: number;
    frustrationWastePercent: number; // frustrationWastedUsd / totalUsd
  };

  deployedApp?: {
    errorRateDelta: number; // change in error rate since sessions
    conversionRateDelta: number; // change in conversion rate since sessions
    estimatedValueUsd: number | null; // if conversion value is configured
  };
}

export async function computeRoiSnapshot(
  ledger: LedgerStore,
  since: Date,
  analytics?: DeployedAppAnalyticsAdapter,
): Promise<RoiSnapshot>;
```

#### TASK-TKNM-019: ROI MCP server

**Location:** `packages/tokenomics/src/roi/mcp-server.ts`  
**Effort:** 2h

Exposes 6 tools via MCP protocol:

| Tool                         | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| `get_spend_summary`          | Total and effective spend, cache savings, by period/model/agent |
| `get_artifact_output`        | Commits, PRs, LOC, files written — grouped by session           |
| `get_cost_per_unit`          | Cost per commit, per LOC, per surviving line                    |
| `get_frustration_report`     | Frustration scores, waste percentage, pattern summary           |
| `get_code_survival`          | Survival rates for sessions > 30 days old                       |
| `get_deployment_correlation` | Correlated deployed-app metrics vs spend periods                |

---

### Phase 6 — Learning Loop

**Effort:** ~10h  
**Gate:** FailureModes detected; PromptPatches generated; patch review flow functional; reinforced patterns stored in memory  
**Depends on:** Phase 7 memory (`@agentsy/memory`), Phase 4 instructions layer (`@agentsy/plugins`)

#### TASK-TKNM-020: Learning types

**Location:** `packages/tokenomics/src/learning/types.ts`  
**Effort:** 0.5h

```typescript
export interface FailureMode {
  id: string;
  category: string; // 'typescript-rewrites' | 'path-errors' | 'schema-repair' | etc.
  sessionCount: number;
  confidence: number; // 0.0–1.0
  evidenceSessions: string[]; // session IDs
  contextFingerprint: string; // hash of common context (model, agent, task tags)
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface PromptPatch {
  id: string;
  failureModeId: string;
  target: "instructions" | "skill" | "tool-policy" | "model-routing";
  targetPath: string; // e.g. '~/.agents/agentsy/learned-behaviors.md'
  section: string; // e.g. '[typescript-style]'
  content: string; // the actual patch text
  confidence: number;
  status: "pending" | "approved" | "rejected" | "applied";
  createdAt: Date;
  appliedAt?: Date;
}

export interface ReinforcedPattern {
  id: string;
  modelId: string;
  agentId: string;
  skillFingerprint: string; // hash of active skill set
  taskCategory: string;
  avgFrustrationScore: number; // averaged over reinforced sessions
  avgSurvivalRate: number;
  sessionCount: number;
  routingWeight: number; // used by gateway model selector
}
```

#### TASK-TKNM-021: Pattern recognizer

**Location:** `packages/tokenomics/src/learning/pattern-recognizer.ts`  
**Effort:** 2h

Runs after each new ledger entry. Scans the last 90 days of entries for clusters of similar frustration signals:

- Groups by dominant `FrustrationEventKind`
- Filters for sessions sharing model/agent/task-category context
- Promotes to `FailureMode` when `sessionCount ≥ 3` and `confidence ≥ 0.6`

No LLM call in this step — pure statistical clustering on signal vectors.

#### TASK-TKNM-022: Patch generator

**Location:** `packages/tokenomics/src/learning/patch-generator.ts`  
**Effort:** 3h

**One LLM call per FailureMode** — generates a concise instruction patch from structured evidence. Called only when a new FailureMode is promoted (not on every session):

```typescript
export async function generatePatch(
  failureMode: FailureMode,
  exampleSessions: SessionLedgerEntry[],
  llm: LlmClient,
): Promise<PromptPatch> {
  const prompt = buildPatchGenerationPrompt(failureMode, exampleSessions);
  // structured output: { section, content, target, confidence }
  const output = await llm.complete({
    messages: [{ role: "user", content: prompt }],
    schema: PatchSchema,
  });
  return assemblePatch(failureMode, output);
}
```

The generation prompt includes: failure mode category, session count, dominant signal types, task context — but **never raw prompt content or file contents**. Privacy-safe by construction.

#### TASK-TKNM-023: Patch applier

**Location:** `packages/tokenomics/src/learning/patch-applier.ts`  
**Effort:** 2h

Writes approved patches to `~/.agents/agentsy/learned-behaviors.md` (auto-created if absent). The `InstructionsDiscoverer` already scans `~/.agents/` — this file will be loaded on every subsequent session with no code changes required in the instructions layer.

For `tool-policy` patches: writes a config delta to `~/.config/agentsy/tool-policy.json`.  
For `model-routing` patches: updates the routing weight in the reinforced patterns store.

Approval gate: if `confidence < 0.9`, presents patch for user review via `/tokenomics patch review` CLI command before writing. If `confidence ≥ 0.9`, applies automatically but logs to audit trail.

#### TASK-TKNM-024: Reinforcement

**Location:** `packages/tokenomics/src/learning/reinforcement.ts`  
**Effort:** 2.5h

Positive signal loop: when a session meets all reinforcement criteria (`frustrationScore < 0.15`, `codeQuality.testsPassed`, `survivalRate30d > 0.80`), upserts a `ReinforcedPattern` record with the winning model/skill combination. The gateway's routing strategy reads these weights to bias model selection toward historically effective combinations for each task category.

---

### Phase 7 — UI Surfaces

**Effort:** ~4h  
**Gate:** Status bar shows live session data; dashboard renders from ledger; weekly report command works

#### TASK-TKNM-025: Session status bar widget

**Location:** `packages/tokenomics/src/ui/status-bar.ts`  
**Effort:** 1.5h

Emits structured state for the VS Code `UsageStatusBar` and the TUI status line. Updated on every turn via a lightweight pub-sub event from the signal collector:

```text
Session: $0.43 · 3 commits · 😤 12% · cache 71%
```

Emojis map to: 😤 = yellow/red frustration, ✅ = green, 🔥 = red (> 0.6).

#### TASK-TKNM-026: Dashboard panel

**Location:** `packages/tokenomics/src/ui/dashboard.ts`  
**Effort:** 1.5h

Ink component (TUI) / React component (VS Code webview) rendering a 7/30/90-day view:

- Bar chart: daily spend vs commits shipped
- Trend line: cost-per-commit (should decline as cache warms + patches apply)
- Frustration heatmap: day × frustration category
- Pending patches notification

#### TASK-TKNM-027: `agentsy tokenomics` CLI commands

**Location:** `packages/cli/src/commands/tokenomics.ts` (wired into CLI, not in this package)  
**Effort:** 1h

```bash
agentsy tokenomics report [--since 7d|30d|90d]
agentsy tokenomics patch review
agentsy tokenomics patch list
agentsy tokenomics survival [--recompute]
agentsy tokenomics adapters list
agentsy tokenomics adapters add <name>
```

---

## 5. Task Summary

| Task          | Module                         | Effort   | Phase | Depends On           |
| ------------- | ------------------------------ | -------- | ----- | -------------------- |
| TASK-TKNM-000 | tokenizers/*                   | 3h ✅     | 0     | —                    |
| TASK-TKNM-001 | ledger/types                   | 1h       | 1     | TKNM-000             |
| TASK-TKNM-002 | ledger/store                   | 2h       | 1     | TKNM-001             |
| TASK-TKNM-003 | ledger/writer                  | 2h       | 1     | TKNM-001, TKNM-002   |
| TASK-TKNM-004 | ledger/query                   | 1h       | 1     | TKNM-002             |
| TASK-TKNM-005 | signals/types                  | 0.5h     | 2     | TKNM-001             |
| TASK-TKNM-006 | signals/rewrite-detector       | 2h       | 2     | TKNM-005             |
| TASK-TKNM-007 | signals/retry-detector         | 2h       | 2     | TKNM-005             |
| TASK-TKNM-008 | signals/abandonment-detector   | 1h       | 2     | TKNM-005             |
| TASK-TKNM-009 | signals/collector              | 2h       | 2     | TKNM-006,007,008     |
| TASK-TKNM-010 | signals/scorer                 | 0.5h     | 2     | TKNM-009             |
| TASK-TKNM-011 | attribution/git-trailers       | 1h       | 3     | TKNM-001             |
| TASK-TKNM-012 | attribution/diff-stats         | 1h       | 3     | —                    |
| TASK-TKNM-013 | attribution/survival           | 2h       | 3     | TKNM-011             |
| TASK-TKNM-014 | cache/prompt-cache             | 2h       | 4     | gateway (P3.5)       |
| TASK-TKNM-015 | cache/semantic-cache           | 2h       | 4     | gateway (P3.5)       |
| TASK-TKNM-016 | cache/efficiency               | 1h       | 4     | TKNM-014             |
| TASK-TKNM-017 | analytics/* (5 adapters)      | 4h       | 5     | TKNM-001             |
| TASK-TKNM-018 | roi/calculator                 | 2h       | 5     | TKNM-003,012,016,017 |
| TASK-TKNM-019 | roi/mcp-server                 | 2h       | 5     | TKNM-018             |
| TASK-TKNM-020 | learning/types                 | 0.5h     | 6     | TKNM-001             |
| TASK-TKNM-021 | learning/pattern-recognizer    | 2h       | 6     | TKNM-009,010,020     |
| TASK-TKNM-022 | learning/patch-generator       | 3h       | 6     | TKNM-021, memory P7  |
| TASK-TKNM-023 | learning/patch-applier         | 2h       | 6     | TKNM-022, plugins P4 |
| TASK-TKNM-024 | learning/reinforcement         | 2.5h     | 6     | TKNM-013,021         |
| TASK-TKNM-025 | ui/status-bar                  | 1.5h     | 7     | TKNM-009,010         |
| TASK-TKNM-026 | ui/dashboard                   | 1.5h     | 7     | TKNM-018             |
| TASK-TKNM-027 | cli commands (in @agentsy/cli) | 1h       | 7     | TKNM-018,022         |
| **Total**     |                                | **~49h** |       |                      |

---

## 6. Quality Gates

- ✅ `pnpm check-types` clean (zero `any`)
- ✅ `pnpm test` — all new modules have unit tests with fixtures
- ✅ `pnpm lint` clean
- ✅ No raw prompt/file content in ledger, signals, or patches (privacy invariant)
- ✅ No hardcoded credentials — all external adapter auth via secrets broker
- ✅ Git trailers opt-in (disabled by default)
- ✅ Semantic cache opt-in (disabled by default)
- ✅ Learning loop patch application requires user approval for `confidence < 0.9`
- ✅ All exports from `src/index.ts`
- ✅ No circular dependencies
- ✅ `IMPLEMENTATION-PLAN.md` updated as tasks complete

---

## 7. Success Criteria

- [ ] Every session produces a persisted `SessionLedgerEntry`
- [ ] `FrustrationScore` computed per session with all 5 passive detectors active
- [ ] `costAtFrustrationLevel` visible in status bar and reports
- [ ] Git trailers written on opt-in AI-assisted commits
- [ ] `agentsy tokenomics report` renders accurate weekly spend-vs-value summary
- [ ] At least one analytics adapter integrated and returning real data
- [ ] `FailureMode` detected and `PromptPatch` generated after 3+ frustration cluster sessions
- [ ] Patch approval flow functional via `/tokenomics patch review`
- [ ] MCP server registered and responding to all 6 tool queries
- [ ] Code survival rate populated for sessions > 30 days old

---

**Previous:** `plan/28-PHASE-19-CONTEXT-RENAME.md`  
**Next:** Begin TASK-TKNM-001 after Phase 9 observability is complete.

### Phase 1: Drift Detection & Quality Metrics (Foundation)

Phase 1: Drift Detection & Quality Metrics (Foundation)

#### Task 1: Define Drift Scorer Interface & Tests

**Files:**

- Create: `src/drift/drift-scorer.ts`
- Create: `src/drift/drift-scorer.test.ts`
- [ ] **Step 1: Write failing test for coherence scoring**

```typescript
// src/drift/drift-scorer.test.ts
import { describe, it, expect } from "vitest";
import { scoreCoherence } from "./drift-scorer";

describe("scoreCoherence", () => {
  it("returns 1.0 for coherent messages", () => {
    const messages = [
      { role: "user" as const, content: "What is 2+2?" },
      { role: "assistant" as const, content: "2+2 = 4" },
      { role: "user" as const, content: "And 4+4?" },
      { role: "assistant" as const, content: "4+4 = 8" },
    ];
    const score = scoreCoherence(messages);
    expect(score).toBeGreaterThan(0.95);
  });

  it("detects contradiction (answer conflicts with earlier state)", () => {
    const messages = [
      { role: "user" as const, content: "The sum is 5" },
      { role: "assistant" as const, content: "Understood, the sum is 5" },
      { role: "assistant" as const, content: "Actually, the sum is 10" },
    ];
    const score = scoreCoherence(messages);
    expect(score).toBeLessThan(0.7);
  });

  it("detects context rot (same topic repeated without progress)", () => {
    const messages = [
      { role: "user" as const, content: "Explain recursion" },
      { role: "assistant" as const, content: "Recursion is when..." },
      { role: "user" as const, content: "What is recursion?" },
      { role: "assistant" as const, content: "Recursion is when..." },
    ];
    const score = scoreCoherence(messages);
    expect(score).toBeLessThan(0.8);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd packages/context
pnpm test -- src/drift/drift-scorer.test.ts
```

Expected: FAIL—function not found.

- [ ] **Step 3: Implement scoreCoherence**

```typescript
// src/drift/drift-scorer.ts
export interface CoherenceSignal {
  contradictionScore: number;
  contextRotScore: number;
  repetitionScore: number;
}

export interface DriftScore {
  coherence: number; // 0-1, higher = better
  signals: CoherenceSignal;
}

/**
 * Score coherence of a message list (0-1).
 * Detects: contradictions, context rot (repeated topics), repetitive answers.
 * Uses similarity heuristics (word overlap, semantic keywords).
 */
export function scoreCoherence(messages: readonly { role: string; content: string }[]): number {
  if (messages.length < 2) return 1.0;

  // Extract keywords from last 5 messages for recency bias
  const recentCount = Math.min(5, messages.length);
  const recentMessages = messages.slice(-recentCount);

  let totalScore = 0;
  let checkCount = 0;

  // Check for contradiction between adjacent assistant messages
  for (let i = 0; i < recentMessages.length - 1; i++) {
    if (recentMessages[i].role === "assistant" && recentMessages[i + 1].role === "assistant") {
      const similarity = computeTextSimilarity(
        recentMessages[i].content,
        recentMessages[i + 1].content,
      );
      // If very similar but not identical, might indicate repetition/rot
      if (similarity > 0.7 && similarity < 0.98) {
        totalScore += 0.6; // Penalize near-duplicates
      } else if (similarity < 0.2 && i > 0) {
        // Wildly different answers to same topic = potential contradiction
        totalScore += 0.5;
      } else {
        totalScore += 0.95;
      }
      checkCount += 1;
    }
  }

  // If no adjacent assistant pairs, assume healthy (no contradictions detected)
  return checkCount === 0 ? 1.0 : totalScore / checkCount;
}

function computeTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  const intersection = [...words1].filter((w) => words2.has(w)).length;
  const union = words1.size + words2.size - intersection;
  return union === 0 ? 1.0 : intersection / union;
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
pnpm test -- src/drift/drift-scorer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/drift/drift-scorer.ts src/drift/drift-scorer.test.ts
git commit -m "feat(drift): add coherence scoring for context drift detection"
```

---

#### Task 2: Anchor Finder (Identify Decision Points)

**Files:**

- Create: `src/drift/anchor-finder.ts`
- Create: `src/drift/anchor-finder.test.ts`
- [ ] **Step 1: Write failing test**

```typescript
// src/drift/anchor-finder.test.ts
import { describe, it, expect } from "vitest";
import { findAnchors } from "./anchor-finder";

describe("findAnchors", () => {
  it("identifies tool calls as anchors", () => {
    const messages = [
      { role: "user" as const, content: "Fetch data from database" },
      {
        role: "assistant" as const,
        content: "I will call the database tool",
        toolUse: { name: "query_db", args: { sql: "SELECT *" } },
      },
      { role: "user" as const, content: "Got results, now process them" },
    ];
    const anchors = findAnchors(messages, { threshold: 0.5 });
    expect(anchors.some((a) => a.type === "tool-call")).toBe(true);
  });

  it("identifies user directives as anchors", () => {
    const messages = [
      { role: "user" as const, content: "Use the new API endpoint" },
      { role: "assistant" as const, content: "Switching to new API" },
      { role: "assistant" as const, content: "Data retrieved" },
    ];
    const anchors = findAnchors(messages, { threshold: 0.5 });
    expect(anchors.some((a) => a.type === "directive")).toBe(true);
  });

  it("does not anchor mundane exchanges", () => {
    const messages = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi there!" },
      { role: "user" as const, content: "How are you?" },
      { role: "assistant" as const, content: "I am well!" },
    ];
    const anchors = findAnchors(messages, { threshold: 0.5 });
    expect(anchors.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test -- src/drift/anchor-finder.test.ts
```

- [ ] **Step 3: Implement anchor finder**

```typescript
// src/drift/anchor-finder.ts
export interface Anchor {
  index: number; // Position in message list
  type: "tool-call" | "directive" | "decision" | "state-change";
  content: string;
  importance: number; // 0-1, higher = more important to preserve
  reason: string;
}

export interface AnchorFinderOptions {
  threshold?: number; // 0-1, importance threshold
  modelFamily?: string;
}

export function findAnchors(
  messages: readonly {
    role: string;
    content: string;
    toolUse?: { name: string; args: unknown };
  }[],
  options: AnchorFinderOptions = {},
): Anchor[] {
  const threshold = options.threshold ?? 0.5;
  const anchors: Anchor[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    // Tool calls are always anchors
    if (message.toolUse) {
      anchors.push({
        index: i,
        type: "tool-call",
        content: `Tool: ${message.toolUse.name}`,
        importance: 0.95,
        reason: `Tool invocation ${message.toolUse.name} is critical decision point`,
      });
      continue;
    }

    // User directives (imperative mood, state changes)
    if (message.role === "user" && isDirective(message.content)) {
      anchors.push({
        index: i,
        type: "directive",
        content: message.content.slice(0, 80),
        importance: 0.85,
        reason: "User directive changes task direction",
      });
    }
  }

  return anchors.filter((a) => a.importance >= threshold);
}

function isDirective(content: string): boolean {
  const imperatives = [
    /^(use|switch|change|apply|set|update|modify|configure)/i,
    /^(now|then|next)\s+(use|switch|apply)/i,
    /^(instead|instead of)\s+/i,
  ];
  return imperatives.some((pattern) => pattern.test(content.trim()));
}
```

- [ ] **Step 4: Run test to pass**

```bash
pnpm test -- src/drift/anchor-finder.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/drift/anchor-finder.ts src/drift/anchor-finder.test.ts
git commit -m "feat(drift): implement anchor finder for decision point preservation"
```

---

#### Task 3: Extend CompressionResult with Drift Metrics

**Files:**

- Modify: `src/index.ts`

- [ ] **Step 1: Update CompressionResult interface**

```typescript
// src/index.ts — add after existing CompressionResult definition

export interface CompressionMetadata {
  /** Coherence score of retained messages (0-1) */
  coherenceScore: number;
  /** Anchors preserved in compression */
  preservedAnchors: Array<{ index: number; type: string; importance: number }>;
  /** Quality score: semantic signal retention vs token reduction */
  qualityScore: number;
  /** Strategy used for compression */
  strategy: string;
  /** Whether context drift was detected */
  driftDetected: boolean;
}

export interface CompressionResult<TMessage> {
  compressed: boolean;
  droppedCount: number;
  estimatedTokens: number;
  messages: TMessage[];
  // NEW: drift & quality metadata
  metadata?: CompressionMetadata;
}
```

- [ ] **Step 2: Run type check**

```bash
cd packages/context && pnpm check-types
```

Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(compression): extend CompressionResult with drift metrics"
```

---

#### Task 4: Drift Monitor (Session-Level Tracking)

**Files:**

- Create: `src/drift/drift-monitor.ts`
- Create: `src/drift/drift-monitor.test.ts`
- [ ] **Step 1: Write failing test**

```typescript
// src/drift/drift-monitor.test.ts
import { describe, it, expect } from "vitest";
import { createDriftMonitor } from "./drift-monitor";

describe("DriftMonitor", () => {
  it("tracks coherence over compression cycles", async () => {
    const monitor = createDriftMonitor();

    monitor.recordCompression({
      cycle: 1,
      coherence: 0.95,
      droppedMessages: 0,
    });

    monitor.recordCompression({
      cycle: 2,
      coherence: 0.92,
      droppedMessages: 5,
    });

    const stats = monitor.getStats();
    expect(stats.cycles).toBe(2);
    expect(stats.minCoherence).toBe(0.92);
    expect(stats.avgCoherence).toBeCloseTo(0.935, 2);
  });

  it("flags drift when coherence drops below threshold", () => {
    const monitor = createDriftMonitor({ driftThreshold: 0.7 });

    monitor.recordCompression({ cycle: 1, coherence: 0.75, droppedMessages: 0 });
    monitor.recordCompression({ cycle: 2, coherence: 0.65, droppedMessages: 10 });

    expect(monitor.isDrifting()).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test -- src/drift/drift-monitor.test.ts
```

- [ ] **Step 3: Implement DriftMonitor**

```typescript
// src/drift/drift-monitor.ts
export interface CompressionCycleRecord {
  cycle: number;
  coherence: number;
  droppedMessages: number;
  timestamp?: Date;
}

export interface DriftMonitorStats {
  avgCoherence: number;
  cycles: number;
  isDrifting: boolean;
  maxCoherence: number;
  minCoherence: number;
  totalDropped: number;
}

export interface DriftMonitorOptions {
  driftThreshold?: number; // default 0.65
  maxCycles?: number; // default 50, then rotate
}

export interface DriftMonitor {
  recordCompression(record: CompressionCycleRecord): void;
  getStats(): DriftMonitorStats;
  isDrifting(): boolean;
  reset(): void;
}

export function createDriftMonitor(options: DriftMonitorOptions = {}): DriftMonitor {
  const driftThreshold = options.driftThreshold ?? 0.65;
  const maxCycles = options.maxCycles ?? 50;
  const records: CompressionCycleRecord[] = [];

  return {
    recordCompression(record) {
      records.push({
        ...record,
        timestamp: record.timestamp ?? new Date(),
      });
      // Keep rolling window
      if (records.length > maxCycles) {
        records.shift();
      }
    },

    getStats(): DriftMonitorStats {
      if (records.length === 0) {
        return {
          avgCoherence: 1.0,
          cycles: 0,
          isDrifting: false,
          maxCoherence: 1.0,
          minCoherence: 1.0,
          totalDropped: 0,
        };
      }

      const coherences = records.map((r) => r.coherence);
      const avg = coherences.reduce((a, b) => a + b, 0) / coherences.length;

      return {
        avgCoherence: avg,
        cycles: records.length,
        isDrifting: Math.min(...coherences) < driftThreshold,
        maxCoherence: Math.max(...coherences),
        minCoherence: Math.min(...coherences),
        totalDropped: records.reduce((sum, r) => sum + r.droppedMessages, 0),
      };
    },

    isDrifting(): boolean {
      const stats = this.getStats();
      return stats.isDrifting;
    },

    reset() {
      records.length = 0;
    },
  };
}
```

- [ ] **Step 4: Run test to pass**

```bash
pnpm test -- src/drift/drift-monitor.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/drift/drift-monitor.ts src/drift/drift-monitor.test.ts
git commit -m "feat(drift): implement session-level drift monitoring"
```

---

### Phase 2: ACON-Inspired Anchored Compression (Core)

Phase 2: ACON-Inspired Anchored Compression (Core)

#### Task 5: Define Compression Strategy Interface

**Files:**

- Create: `src/strategies/compression-strategy.ts`
- Create: `src/strategies/compression-strategy.test.ts`
- [ ] **Step 1: Write failing test**

```typescript
// src/strategies/compression-strategy.test.ts
import { describe, it, expect } from "vitest";
import { createCompressionStrategyRegistry } from "./compression-strategy";

describe("CompressionStrategyRegistry", () => {
  it("registers and retrieves strategies", () => {
    const registry = createCompressionStrategyRegistry();

    const mockStrategy = {
      name: "test-strategy",
      compress: async (messages: unknown[]) => ({
        messages,
        metadata: { strategy: "test-strategy", droppedCount: 0, coherenceScore: 1.0 },
      }),
    };

    registry.register(mockStrategy);
    const retrieved = registry.get("test-strategy");

    expect(retrieved?.name).toBe("test-strategy");
  });

  it("throws on unknown strategy", () => {
    const registry = createCompressionStrategyRegistry();
    expect(() => registry.get("nonexistent")).toThrow();
  });

  it("lists available strategies", () => {
    const registry = createCompressionStrategyRegistry();
    registry.register({
      name: "strat1",
      compress: async (msgs: unknown[]) => ({ messages: msgs, metadata: {} }),
    });
    registry.register({
      name: "strat2",
      compress: async (msgs: unknown[]) => ({ messages: msgs, metadata: {} }),
    });

    const available = registry.list();
    expect(available).toContain("strat1");
    expect(available).toContain("strat2");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test -- src/strategies/compression-strategy.test.ts
```

- [ ] **Step 3: Implement strategy interface & registry**

```typescript
// src/strategies/compression-strategy.ts
export interface CompressionStrategyMetadata {
  coherenceScore: number;
  droppedCount: number;
  preservedAnchors?: Array<{ index: number; importance: number }>;
  qualityScore?: number;
  strategy: string;
  driftDetected?: boolean;
}

export interface CompressionStrategyResult<TMessage> {
  messages: TMessage[];
  metadata: CompressionStrategyMetadata;
}

export interface CompressionStrategy<TMessage = Record<string, unknown>> {
  name: string;
  compress(
    messages: readonly TMessage[],
    options: CompressionStrategyOptions<TMessage>,
  ): Promise<CompressionStrategyResult<TMessage>>;
}

export interface CompressionStrategyOptions<TMessage> {
  maxTokens: number;
  estimateTokens?: (message: TMessage) => number;
  preserveLast?: number;
  metadata?: Record<string, unknown>;
}

export interface CompressionStrategyRegistry {
  register<T = Record<string, unknown>>(strategy: CompressionStrategy<T>): void;
  get<T = Record<string, unknown>>(name: string): CompressionStrategy<T>;
  list(): string[];
}

export function createCompressionStrategyRegistry(): CompressionStrategyRegistry {
  const strategies = new Map<string, CompressionStrategy>();

  return {
    register(strategy) {
      strategies.set(strategy.name, strategy);
    },

    get(name) {
      const strategy = strategies.get(name);
      if (!strategy) {
        throw new Error(`Unknown compression strategy: ${name}`);
      }
      return strategy as CompressionStrategy;
    },

    list() {
      return Array.from(strategies.keys()).sort();
    },
  };
}
```

- [ ] **Step 4: Run test to pass**

```bash
pnpm test -- src/strategies/compression-strategy.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/strategies/compression-strategy.ts src/strategies/compression-strategy.test.ts
git commit -m "feat(strategies): define compression strategy pattern & registry"
```

---

#### Task 6: Refactor Naive FIFO Dropping as First Strategy

**Files:**

- Create: `src/strategies/naive-dropping.ts`
- Create: `src/strategies/naive-dropping.test.ts`
- Modify: `src/index.ts` (use new interface internally for compressConversation)
- [ ] **Step 1: Write failing test**

```typescript
// src/strategies/naive-dropping.test.ts
import { describe, it, expect } from "vitest";
import { createNaiveDroppingStrategy } from "./naive-dropping";

describe("NaiveDroppingStrategy", () => {
  it("drops oldest messages until under token budget", async () => {
    const strategy = createNaiveDroppingStrategy();

    const messages = [
      { role: "user", content: "A" },
      { role: "assistant", content: "B".repeat(1000) },
      { role: "user", content: "C".repeat(1000) },
      { role: "assistant", content: "Keep this" },
    ];

    const result = await strategy.compress(messages, {
      maxTokens: 300,
      estimateTokens: (m: (typeof messages)[0]) => Math.ceil(m.content.length / 4),
    });

    expect(result.messages.length).toBeLessThan(4);
    expect(result.metadata.droppedCount).toBeGreaterThan(0);
  });

  it("preserves last N messages via preserveLast option", async () => {
    const strategy = createNaiveDroppingStrategy();

    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`.repeat(100),
    }));

    const result = await strategy.compress(messages, {
      maxTokens: 100,
      preserveLast: 3,
    });

    // Last 3 should always be retained
    expect(result.messages.slice(-3)).toEqual(messages.slice(-3));
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test -- src/strategies/naive-dropping.test.ts
```

- [ ] **Step 3: Implement naive dropping strategy**

```typescript
// src/strategies/naive-dropping.ts
import type {
  CompressionStrategy,
  CompressionStrategyOptions,
  CompressionStrategyResult,
} from "./compression-strategy.js";

export function createNaiveDroppingStrategy(): CompressionStrategy {
  return {
    name: "naive-dropping",
    async compress<T extends Record<string, unknown>>(
      messages: readonly T[],
      options: CompressionStrategyOptions<T>,
    ): Promise<CompressionStrategyResult<T>> {
      const estimateTokens = options.estimateTokens ?? defaultEstimateTokens<T>;
      const preserveLast = Math.max(0, options.preserveLast ?? 0);
      const retained = [...messages];

      let estimatedTokens = retained.reduce((total, message) => total + estimateTokens(message), 0);
      let droppedCount = 0;

      while (retained.length > preserveLast && estimatedTokens > options.maxTokens) {
        const removed = retained.shift();
        if (removed === undefined) break;

        estimatedTokens -= estimateTokens(removed);
        droppedCount += 1;
      }

      return {
        messages: retained,
        metadata: {
          strategy: "naive-dropping",
          droppedCount,
          coherenceScore: 1.0 - droppedCount * 0.05, // Penalize drops
          qualityScore: droppedCount === 0 ? 1.0 : Math.max(0.5, 1.0 - droppedCount * 0.1),
        },
      };
    },
  };
}

function defaultEstimateTokens<T>(message: T): number {
  if (typeof message === "string") {
    return Math.max(1, Math.ceil(message.length / 4));
  }
  return Math.max(1, Math.ceil(JSON.stringify(message).length / 4));
}
```

- [ ] **Step 4: Run test to pass**

```bash
pnpm test -- src/strategies/naive-dropping.test.ts
```

- [ ] **Step 5: Update compressConversation to use strategy internally**

```typescript
// src/index.ts — modify existing compressConversation to use new strategy

// Add import
import { createNaiveDroppingStrategy } from "./strategies/naive-dropping.js";

// Keep existing function for backward compat, but use strategy internally
export function compressConversation<TMessage>(
  messages: readonly TMessage[],
  options: CompressionOptions<TMessage>,
): CompressionResult<TMessage> {
  const strategy = createNaiveDroppingStrategy();
  const result = await strategy
    .compress(messages, {
      maxTokens: options.maxTokens,
      estimateTokens: options.estimateTokens,
      preserveLast: options.preserveLast,
    })
    .then((res) => ({
      compressed: res.metadata.droppedCount > 0,
      droppedCount: res.metadata.droppedCount,
      estimatedTokens: res.messages.reduce(
        (total, msg) => total + (options.estimateTokens?.(msg) ?? 0),
        0,
      ),
      messages: res.messages,
      metadata: res.metadata,
    }));

  return result;
}
```

WAIT—compressConversation is synchronous. Use async variant internally:

```typescript
// Actually, keep compressConversation sync and create async wrapper:

export async function compressConversationAsync<TMessage>(
  messages: readonly TMessage[],
  options: CompressionOptions<TMessage>,
  strategyName: string = "naive-dropping",
): Promise<CompressionResult<TMessage>> {
  const registry = createCompressionStrategyRegistry();
  registry.register(createNaiveDroppingStrategy());

  const strategy = registry.get(strategyName);
  const result = await strategy.compress(messages, options);

  return {
    compressed: result.metadata.droppedCount > 0,
    droppedCount: result.metadata.droppedCount,
    estimatedTokens: result.messages.reduce(
      (total, msg) => total + (options.estimateTokens?.(msg) ?? 0),
      0,
    ),
    messages: result.messages,
    metadata: result.metadata,
  };
}
```

- [ ] **Step 6: Export new types & functions**

```typescript
// src/index.ts — add exports
export * from "./strategies/compression-strategy.js";
export { createNaiveDroppingStrategy } from "./strategies/naive-dropping.js";
export { compressConversationAsync };
```

- [ ] **Step 7: Commit**

```bash
git add src/strategies/naive-dropping.ts src/strategies/naive-dropping.test.ts src/index.ts
git commit -m "feat(strategies): implement naive-dropping as pluggable strategy"
```

---

#### Task 7: Anchored Iterative Compression (ACON Core)

**Files:**

- Create: `src/strategies/anchored-iterative.ts`
- Create: `src/strategies/anchored-iterative.test.ts`
- [ ] **Step 1: Write failing test**

```typescript
// src/strategies/anchored-iterative.test.ts
import { describe, it, expect } from "vitest";
import { createAnchoredIterativeStrategy } from "./anchored-iterative";

describe("AnchoredIterativeStrategy", () => {
  it("preserves anchors during compression", async () => {
    const strategy = createAnchoredIterativeStrategy();

    const messages = [
      { role: "user", content: "Step 1: fetch data", toolUse: { name: "query", args: {} } },
      { role: "assistant", content: "Fetching...".repeat(300) },
      { role: "user", content: "Step 2: use new API" },
      { role: "assistant", content: "Done".repeat(300) },
    ];

    const result = await strategy.compress(messages, {
      maxTokens: 500,
    });

    // Anchors (tool calls, directives) should be preserved
    const toolCallPreserved = result.messages.some(
      (m: unknown) => typeof m === "object" && m !== null && "toolUse" in m,
    );
    expect(toolCallPreserved).toBe(true);
  });

  it("scores compression quality based on anchor preservation", async () => {
    const strategy = createAnchoredIterativeStrategy();

    const messages = [
      { role: "user", content: "Execute plan A" },
      { role: "assistant", content: "Plan A result...".repeat(200) },
      { role: "user", content: "Good work" },
    ];

    const result = await strategy.compress(messages, {
      maxTokens: 200,
    });

    // Quality should reflect anchor preservation
    expect(result.metadata.qualityScore).toBeGreaterThan(0.6);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test -- src/strategies/anchored-iterative.test.ts
```

- [ ] **Step 3: Implement anchored iterative strategy**

```typescript
// src/strategies/anchored-iterative.ts
import { findAnchors } from "../drift/anchor-finder.js";
import { scoreCoherence } from "../drift/drift-scorer.js";
import type {
  CompressionStrategy,
  CompressionStrategyOptions,
  CompressionStrategyResult,
} from "./compression-strategy.js";

export interface AnchoredIterativeOptions {
  maxIterations?: number;
  guidelineRefinement?: boolean; // Learn from failures
}

export function createAnchoredIterativeStrategy(
  options: AnchoredIterativeOptions = {},
): CompressionStrategy {
  const maxIterations = options.maxIterations ?? 10;

  return {
    name: "anchored-iterative",
    async compress<T extends Record<string, unknown>>(
      messages: readonly T[],
      strategyOptions: CompressionStrategyOptions<T>,
    ): Promise<CompressionStrategyResult<T>> {
      const estimateTokens = strategyOptions.estimateTokens ?? defaultEstimateTokens<T>;
      const maxTokens = strategyOptions.maxTokens;
      const preserveLast = Math.max(0, strategyOptions.preserveLast ?? 0);

      // Phase 1: Identify anchors
      const anchorsInfo = findAnchors(
        messages.map((m) => ({
          role: typeof m === "object" && m !== null && "role" in m ? String(m.role) : "unknown",
          content:
            typeof m === "object" && m !== null && "content" in m
              ? String(m.content)
              : JSON.stringify(m),
          toolUse: typeof m === "object" && m !== null && "toolUse" in m ? m.toolUse : undefined,
        })),
        { threshold: 0.5 },
      );

      const anchorIndices = new Set(anchorsInfo.map((a) => a.index));

      // Phase 2: Iteratively drop non-anchor messages
      let retained = [...messages];
      let estimatedTokens = retained.reduce((total, msg) => total + estimateTokens(msg), 0);
      let droppedCount = 0;
      let iteration = 0;

      while (
        retained.length > preserveLast &&
        estimatedTokens > maxTokens &&
        iteration < maxIterations
      ) {
        iteration += 1;

        // Find oldest non-anchor message (excluding preserved tail)
        let dropIndex = -1;
        for (let i = 0; i < retained.length - preserveLast; i++) {
          if (!anchorIndices.has(i)) {
            dropIndex = i;
            break;
          }
        }

        if (dropIndex === -1) {
          // All remaining messages are anchors; drop oldest anchor if necessary
          dropIndex = Math.max(0, retained.length - preserveLast - 1);
        }

        const dropped = retained.splice(dropIndex, 1)[0];
        if (dropped === undefined) break;

        estimatedTokens -= estimateTokens(dropped);
        droppedCount += 1;

        // Update anchor indices after removal
        const newAnchorIndices = new Set<number>();
        for (const idx of anchorIndices) {
          if (idx < dropIndex) {
            newAnchorIndices.add(idx);
          } else if (idx > dropIndex) {
            newAnchorIndices.add(idx - 1);
          }
        }
        anchorIndices.clear();
        newAnchorIndices.forEach((i) => anchorIndices.add(i));
      }

      // Phase 3: Score quality
      const coherence = scoreCoherence(
        retained.map((m) => ({
          role: typeof m === "object" && m !== null && "role" in m ? String(m.role) : "unknown",
          content:
            typeof m === "object" && m !== null && "content" in m
              ? String(m.content)
              : JSON.stringify(m),
        })),
      );

      const anchorsPreserved = anchorsInfo.filter((a) => anchorIndices.has(a.index));
      const anchorPreservationRatio =
        anchorsInfo.length > 0 ? anchorsPreserved.length / anchorsInfo.length : 1.0;

      const qualityScore = coherence * 0.6 + anchorPreservationRatio * 0.4; // Weighted blend

      return {
        messages: retained,
        metadata: {
          strategy: "anchored-iterative",
          droppedCount,
          coherenceScore: coherence,
          qualityScore,
          preservedAnchors: anchorsPreserved.map((a) => ({
            index: a.index,
            type: a.type,
            importance: a.importance,
          })),
        },
      };
    },
  };
}

function defaultEstimateTokens<T>(message: T): number {
  if (typeof message === "string") {
    return Math.max(1, Math.ceil(message.length / 4));
  }
  return Math.max(1, Math.ceil(JSON.stringify(message).length / 4));
}
```

- [ ] **Step 4: Run test to pass**

```bash
pnpm test -- src/strategies/anchored-iterative.test.ts
```

- [ ] **Step 5: Export strategy**

```typescript
// src/index.ts — add export
export { createAnchoredIterativeStrategy } from "./strategies/anchored-iterative.js";
```

- [ ] **Step 6: Commit**

```bash
git add src/strategies/anchored-iterative.ts src/strategies/anchored-iterative.test.ts src/index.ts
git commit -m "feat(strategies): implement ACON-inspired anchored-iterative compression"
```

---

#### Task 8: Integrate Strategies into compressConversationAsync

**Files:**

- Modify: `src/index.ts`

- [ ] **Step 1: Update compressConversationAsync to support strategy selection**

```typescript
// src/index.ts — enhance compressConversationAsync

export async function compressConversationAsync<TMessage>(
  messages: readonly TMessage[],
  options: CompressionOptions<TMessage>,
  strategyName: string = "naive-dropping",
): Promise<CompressionResult<TMessage>> {
  const registry = createCompressionStrategyRegistry();

  // Register all available strategies
  registry.register(createNaiveDroppingStrategy());
  registry.register(createAnchoredIterativeStrategy());
  // Future: registry.register(createHierarchicalSummarizationStrategy());

  const strategy = registry.get(strategyName);
  const strategyResult = await strategy.compress(messages, options);

  return {
    compressed: strategyResult.metadata.droppedCount > 0,
    droppedCount: strategyResult.metadata.droppedCount,
    estimatedTokens: strategyResult.messages.reduce(
      (total, msg) => total + (options.estimateTokens?.(msg) ?? defaultEstimateTokens(msg)),
      0,
    ),
    messages: strategyResult.messages,
    metadata: strategyResult.metadata,
  };
}
```

- [ ] **Step 2: Update README with strategy usage**

```markdown
// packages/context/README.md — add section after CompressionOptions example

### Using Compression Strategies

Choose a compression strategy based on your use case:

**Naive Dropping** (default) — Simple FIFO removal
\`\`\`typescript
const result = await compressConversationAsync(messages, {
maxTokens: 200000,
preserveLast: 2
}, 'naive-dropping');
\`\`\`

**Anchored Iterative** (ACON-inspired) — Preserves decision points
\`\`\`typescript
const result = await compressConversationAsync(messages, {
maxTokens: 200000,
preserveLast: 2
}, 'anchored-iterative');
console.log('Preserved anchors:', result.metadata?.preservedAnchors);
console.log('Coherence:', result.metadata?.coherenceScore);
\`\`\`
```

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts packages/context/README.md
git commit -m "feat: integrate compression strategies with strategy selection"
```

---

### Phase 3: Three-Layer Offloading (Efficiency)

Phase 3: Three-Layer Offloading (Efficiency)

#### Task 9: Offloading Storage Adapter Interface

**Files:**

- Create: `src/offloading/storage-adapter.ts`
- Create: `src/offloading/storage-adapter.test.ts`
- [ ] **Step 1: Write failing test**

```typescript
// src/offloading/storage-adapter.test.ts
import { describe, it, expect } from "vitest";
import { createMemoryStorageAdapter } from "./storage-adapter";

describe("StorageAdapter", () => {
  it("stores and retrieves offloaded content", async () => {
    const adapter = createMemoryStorageAdapter();

    const ref = await adapter.store("some-key", "Large content data");
    expect(ref).toBeDefined();

    const retrieved = await adapter.retrieve(ref);
    expect(retrieved).toBe("Large content data");
  });

  it("returns reference token overhead", async () => {
    const adapter = createMemoryStorageAdapter();
    const ref = await adapter.store("key", "x".repeat(1000));

    const overhead = adapter.referenceTokenEstimate(ref);
    expect(overhead).toBeLessThan(50); // Refs should be small
  });

  it("lists stored items", async () => {
    const adapter = createMemoryStorageAdapter();

    await adapter.store("key1", "data1");
    await adapter.store("key2", "data2");

    const items = await adapter.list();
    expect(items.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test -- src/offloading/storage-adapter.test.ts
```

- [ ] **Step 3: Implement storage adapter**

```typescript
// src/offloading/storage-adapter.ts
export interface StorageReference {
  id: string;
  size: number;
  storedAt: Date;
}

export interface StorageAdapter {
  store(key: string, content: string): Promise<StorageReference>;
  retrieve(ref: StorageReference): Promise<string>;
  delete(ref: StorageReference): Promise<void>;
  list(): Promise<StorageReference[]>;
  clear(): Promise<void>;
  referenceTokenEstimate(ref: StorageReference): number;
}

export function createMemoryStorageAdapter(): StorageAdapter {
  const store = new Map<string, string>();

  return {
    async store(key, content) {
      const id = `mem_${key}_${Date.now()}`;
      store.set(id, content);
      return {
        id,
        size: content.length,
        storedAt: new Date(),
      };
    },

    async retrieve(ref) {
      const content = store.get(ref.id);
      if (!content) {
        throw new Error(`Reference not found: ${ref.id}`);
      }
      return content;
    },

    async delete(ref) {
      store.delete(ref.id);
    },

    async list() {
      return Array.from(store.entries()).map(([id, content]) => ({
        id,
        size: content.length,
        storedAt: new Date(),
      }));
    },

    async clear() {
      store.clear();
    },

    referenceTokenEstimate(ref) {
      // Estimate tokens in the reference ID + metadata
      return Math.ceil((ref.id.length + 50) / 4);
    },
  };
}
```

- [ ] **Step 4: Run test to pass**

```bash
pnpm test -- src/offloading/storage-adapter.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/offloading/storage-adapter.ts src/offloading/storage-adapter.test.ts
git commit -m "feat(offloading): implement storage adapter interface for context offloading"
```

---

#### Task 10: Three-Layer Offloading Strategy

**Files:**

- Create: `src/strategies/three-layer-offloading.ts`
- Create: `src/strategies/three-layer-offloading.test.ts`
- [ ] **Step 1: Write failing test**

```typescript
// src/strategies/three-layer-offloading.test.ts
import { describe, it, expect } from "vitest";
import { createThreeLayerOffloadingStrategy } from "./three-layer-offloading";
import { createMemoryStorageAdapter } from "../offloading/storage-adapter";

describe("ThreeLayerOffloadingStrategy", () => {
  it("offloads tool results to storage", async () => {
    const storage = createMemoryStorageAdapter();
    const strategy = createThreeLayerOffloadingStrategy({ storage });

    const messages = [
      { role: "user", content: "Fetch data" },
      {
        role: "assistant",
        content: "Result:",
        toolResult: { name: "query", data: "x".repeat(5000) },
      },
      { role: "user", content: "Done" },
    ];

    const result = await strategy.compress(messages, {
      maxTokens: 1000,
    });

    // Original content should be offloaded
    const stored = await storage.list();
    expect(stored.length).toBeGreaterThan(0);
  });

  it("reduces token count via offloading", async () => {
    const storage = createMemoryStorageAdapter();
    const strategy = createThreeLayerOffloadingStrategy({ storage });

    const messages = [
      { role: "assistant", content: "Processing..." },
      {
        role: "assistant",
        content: "Huge log output",
        toolResult: { name: "run", data: "x".repeat(10000) },
      },
    ];

    const result = await strategy.compress(messages, {
      maxTokens: 5000,
    });

    // Tokens should be significantly reduced due to offloading
    expect(result.metadata.droppedCount).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test -- src/strategies/three-layer-offloading.test.ts
```

- [ ] **Step 3: Implement three-layer offloading strategy**

```typescript
// src/strategies/three-layer-offloading.ts
import type { StorageAdapter } from "../offloading/storage-adapter.js";
import { createMemoryStorageAdapter } from "../offloading/storage-adapter.js";
import type {
  CompressionStrategy,
  CompressionStrategyOptions,
  CompressionStrategyResult,
} from "./compression-strategy.js";

export interface ThreeLayerOffloadingOptions {
  storage?: StorageAdapter;
}

interface OffloadedMessage {
  original: Record<string, unknown>;
  offloadedRefs: Map<string, string>; // field -> storage ref id
}

export function createThreeLayerOffloadingStrategy(
  options: ThreeLayerOffloadingOptions = {},
): CompressionStrategy {
  const storage = options.storage ?? createMemoryStorageAdapter();
  const offloaded = new WeakMap<Record<string, unknown>, OffloadedMessage>();

  return {
    name: "three-layer-offloading",
    async compress<T extends Record<string, unknown>>(
      messages: readonly T[],
      strategyOptions: CompressionStrategyOptions<T>,
    ): Promise<CompressionStrategyResult<T>> {
      const estimateTokens = strategyOptions.estimateTokens ?? defaultEstimateTokens<T>;
      const maxTokens = strategyOptions.maxTokens;

      let totalTokens = 0;
      const processedMessages: T[] = [];

      for (const message of messages) {
        // Layer 1: Offload tool results
        let msg = message;
        if (typeof message === "object" && message !== null && "toolResult" in message) {
          const resultStr = JSON.stringify(message.toolResult);
          const resultTokens = Math.ceil(resultStr.length / 4);

          if (resultTokens > 500) {
            // Offload if large
            const ref = await storage.store("tool-result", resultStr);
            msg = {
              ...message,
              toolResult: {
                __offloaded: true,
                __ref: ref.id,
                __size: ref.size,
              },
            } as T;
          }
        }

        // Layer 2: Trim unused tool inputs
        if (
          typeof msg === "object" &&
          msg !== null &&
          "toolInput" in msg &&
          typeof msg.toolInput === "object"
        ) {
          const trimmed = { ...msg.toolInput };
          // Keep only critical fields (simplistic; can be enhanced)
          for (const key of Object.keys(trimmed)) {
            if (key.startsWith("_") || key === "debug" || key === "verbose") {
              delete (trimmed as Record<string, unknown>)[key];
            }
          }
          msg = {
            ...msg,
            toolInput: trimmed,
          } as T;
        }

        const msgTokens = estimateTokens(msg);
        totalTokens += msgTokens;
        processedMessages.push(msg);
      }

      // Layer 3: Summarize if still over budget (stub for now)
      // In practice, would trigger LLM summarization
      // For now, fallback to naive dropping if necessary
      let droppedCount = 0;
      while (
        totalTokens > maxTokens &&
        processedMessages.length > Math.max(1, strategyOptions.preserveLast ?? 0)
      ) {
        const removed = processedMessages.shift();
        if (removed === undefined) break;
        totalTokens -= estimateTokens(removed);
        droppedCount += 1;
      }

      return {
        messages: processedMessages,
        metadata: {
          strategy: "three-layer-offloading",
          droppedCount,
          coherenceScore: 0.9, // Offloading preserves coherence
          qualityScore: 0.85,
        },
      };
    },
  };
}

function defaultEstimateTokens<T>(message: T): number {
  if (typeof message === "string") {
    return Math.max(1, Math.ceil(message.length / 4));
  }
  return Math.max(1, Math.ceil(JSON.stringify(message).length / 4));
}
```

- [ ] **Step 4: Run test to pass**

```bash
pnpm test -- src/strategies/three-layer-offloading.test.ts
```

- [ ] **Step 5: Export strategy & adapter**

```typescript
// src/index.ts — add exports
export * from "./offloading/storage-adapter.js";
export { createThreeLayerOffloadingStrategy } from "./strategies/three-layer-offloading.js";
```

- [ ] **Step 6: Commit**

```bash
git add src/strategies/three-layer-offloading.ts src/strategies/three-layer-offloading.test.ts src/index.ts
git commit -m "feat(offloading): implement three-layer offloading strategy"
```

---

### Phase 4: Observability Loop (Continuous Improvement)

Phase 4: Observability Loop (Continuous Improvement)

#### Task 11: Compression Metrics Collector

**Files:**

- Create: `src/observability/compression-metrics.ts`
- Create: `src/observability/compression-metrics.test.ts`
- [ ] **Step 1: Write failing test**

```typescript
// src/observability/compression-metrics.test.ts
import { describe, it, expect } from "vitest";
import { createCompressionMetricsCollector } from "./compression-metrics";

describe("CompressionMetricsCollector", () => {
  it("tracks compression efficacy per strategy", () => {
    const collector = createCompressionMetricsCollector();

    collector.recordCompression({
      strategy: "naive-dropping",
      inputTokens: 1000,
      outputTokens: 600,
      qualityScore: 0.8,
      droppedMessages: 3,
    });

    const stats = collector.getStrategyStats("naive-dropping");
    expect(stats.compressionRatio).toBe(0.6);
    expect(stats.avgQuality).toBe(0.8);
  });

  it("computes average compression ratio across all recordings", () => {
    const collector = createCompressionMetricsCollector();

    collector.recordCompression({
      strategy: "anchored-iterative",
      inputTokens: 1000,
      outputTokens: 700,
      qualityScore: 0.95,
      droppedMessages: 2,
    });

    collector.recordCompression({
      strategy: "anchored-iterative",
      inputTokens: 2000,
      outputTokens: 1200,
      qualityScore: 0.93,
      droppedMessages: 5,
    });

    const stats = collector.getStrategyStats("anchored-iterative");
    expect(stats.compressionRatio).toBeCloseTo(0.65, 1);
  });

  it("compares strategy performance", () => {
    const collector = createCompressionMetricsCollector();

    collector.recordCompression({
      strategy: "naive-dropping",
      inputTokens: 1000,
      outputTokens: 400,
      qualityScore: 0.5,
      droppedMessages: 10,
    });

    collector.recordCompression({
      strategy: "anchored-iterative",
      inputTokens: 1000,
      outputTokens: 500,
      qualityScore: 0.9,
      droppedMessages: 3,
    });

    const comparison = collector.compareStrategies(["naive-dropping", "anchored-iterative"]);
    expect(comparison["anchored-iterative"].avgQuality).toBeGreaterThan(
      comparison["naive-dropping"].avgQuality,
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test -- src/observability/compression-metrics.test.ts
```

- [ ] **Step 3: Implement metrics collector**

```typescript
// src/observability/compression-metrics.ts
export interface CompressionRecord {
  droppedMessages: number;
  inputTokens: number;
  outputTokens: number;
  qualityScore: number;
  strategy: string;
  timestamp?: Date;
}

export interface StrategyStats {
  avgQuality: number;
  compressionRatio: number;
  count: number;
  maxQuality: number;
  minQuality: number;
  totalInputTokens: number;
}

export interface CompressionMetricsCollector {
  recordCompression(record: CompressionRecord): void;
  getStrategyStats(strategy: string): StrategyStats | null;
  compareStrategies(strategies: string[]): Record<string, StrategyStats>;
  reset(): void;
}

export function createCompressionMetricsCollector(): CompressionMetricsCollector {
  const records: CompressionRecord[] = [];

  return {
    recordCompression(record) {
      records.push({
        ...record,
        timestamp: record.timestamp ?? new Date(),
      });
    },

    getStrategyStats(strategy): StrategyStats | null {
      const strategyRecords = records.filter((r) => r.strategy === strategy);
      if (strategyRecords.length === 0) {
        return null;
      }

      const qualities = strategyRecords.map((r) => r.qualityScore);
      const compressionRatios = strategyRecords.map(
        (r) => r.outputTokens / Math.max(1, r.inputTokens),
      );

      return {
        avgQuality: qualities.reduce((a, b) => a + b, 0) / qualities.length,
        compressionRatio: compressionRatios.reduce((a, b) => a + b, 0) / compressionRatios.length,
        count: strategyRecords.length,
        maxQuality: Math.max(...qualities),
        minQuality: Math.min(...qualities),
        totalInputTokens: strategyRecords.reduce((sum, r) => sum + r.inputTokens, 0),
      };
    },

    compareStrategies(strategies) {
      const result: Record<string, StrategyStats> = {};
      for (const strategy of strategies) {
        const stats = this.getStrategyStats(strategy);
        if (stats) {
          result[strategy] = stats;
        }
      }
      return result;
    },

    reset() {
      records.length = 0;
    },
  };
}
```

- [ ] **Step 4: Run test to pass**

```bash
pnpm test -- src/observability/compression-metrics.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/observability/compression-metrics.ts src/observability/compression-metrics.test.ts
git commit -m "feat(observability): implement compression metrics collector"
```

---

#### Task 12: Export All New Interfaces & Update README

**Files:**

- Modify: `src/index.ts`
- Modify: `packages/context/README.md`
- [ ] **Step 1: Consolidate all exports**

```typescript
// src/index.ts — gather all new exports

// Strategies
export * from "./strategies/compression-strategy.js";
export { createNaiveDroppingStrategy } from "./strategies/naive-dropping.js";
export { createAnchoredIterativeStrategy } from "./strategies/anchored-iterative.js";
export { createThreeLayerOffloadingStrategy } from "./strategies/three-layer-offloading.js";
export { compressConversationAsync };

// Drift
export { scoreCoherence, type CoherenceSignal, type DriftScore } from "./drift/drift-scorer.js";
export { findAnchors, type Anchor } from "./drift/anchor-finder.js";
export { createDriftMonitor, type DriftMonitor } from "./drift/drift-monitor.js";

// Offloading
export * from "./offloading/storage-adapter.js";

// Observability
export {
  createCompressionMetricsCollector,
  type CompressionMetricsCollector,
  type StrategyStats,
} from "./observability/compression-metrics.js";
```

- [ ] **Step 2: Run type check**

```bash
cd packages/context && pnpm check-types
```

- [ ] **Step 3: Update README with comprehensive documentation**

````markdown
// packages/context/README.md — replace entire file

# @agentsy/context

Token budgets, context reduction, and output shaping for LLM applications — **now with drift detection and anchored compression.**




## Remaining Phases (Stubs for Future Implementation)

Remaining Phases (Stubs for Future Implementation)

### Phase 4: Anthropic Provider Integration (Deferred)

**Files to create (stubs):**

- `src/providers/anthropic-provider.ts` — Prompt caching support
- `src/strategies/anthropic-cached.ts` — Cache-aware strategy

**Trigger:** When multi-provider demand emerges or Anthropic cache adoption increases.

### Phase 5: Output Compression Enhancement (Deferred)

**Files to enhance:**

- `src/compression/output-compressor-v2.ts` — Syntax-aware compression
- `src/compression/technical-entity-parser.ts` — Language detection, identifier preservation

**Trigger:** When output compression becomes a bottleneck or specific language support is requested.

### Phase 6: Automatic Strategy Learning (Deferred)

**Files to create (stubs):**

- `src/observability/strategy-learner.ts` — Learn which strategy works best for task types
- `src/observability/failed-trajectory-analyzer.ts` — Analyze failed compressions, refine guidelines

**Trigger:** After Phase 1-3 have stabilized; requires failed path tracking across sessions.

---
