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
    "better-sqlite3": "^9.x"
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

- `post-session` — writes ledger entry
- `post-turn` — feeds retry/rewrite detectors
- `post-tool-call(write_file)` — triggers rewrite window
- `approval:denied` — tool rejection signal
- `model_switched` — mid-session model change signal

---

## 4. Implementation Phases

---

### Phase 1 — Ledger Foundation

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
| TASK-TKNM-001 | ledger/types                   | 1h       | 1     | —                    |
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
| TASK-TKNM-017 | analytics/\* (5 adapters)      | 4h       | 5     | TKNM-001             |
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
| **Total**     |                                | **~46h** |       |                      |

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
