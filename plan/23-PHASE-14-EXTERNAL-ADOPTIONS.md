# Phase 14 — External Pattern Adoptions (Revised)

**Authority:** `plan/17-GOVERNANCE-QUALITY-GATES.md`
**Last Updated:** 2026-06-12
**Status:** Revised after Phase 7 delivery

---

## Goal

Adopt proven patterns from 7 external repositories into existing @agentsy packages. All adoptions are **pattern-level** — no code copying, no license contamination.

Primary source: **cognee** (topoteretes/cognee, 17.6k stars) — 4-op memory API, two-tier session↔graph sync, rule-based query router, feedback-weighted graph, awaitable result handles.

---

## Current State Assessment (Post-Phase 7)

### What We Already Have

| Capability | Where | Gaps vs cognee |
|-----------|-------|---------------|
| Memory tiers (sensory/working/STM/LTM) | `cognitive/memory-engine.ts` | More granular than cognee's 2-tier, but no unified `remember()` surface |
| CortexKit session store + snapshot bridge | `session/src/cortexkit/` | Durable SQLite backing — stronger than cognee's JSON cache |
| Wiki (knowledge pages, vector search) | `wiki/wiki-manager.ts` | Similar to graph tier but no relationship/edge model |
| Dreamer consumer (epoch polling) | `memory/src/cortexkit/dreamer-consumer.ts` | Polling, not event-driven; no bidirectional sync |
| Memory tools (append, search) | `tools/src/tools/memory/` | `memory_append` resembles `remember()` but no typed entries |
| Fact extractor | `memory/src/extraction/` | LLM-based extraction, no discriminated union entries |
| Pre-turn / post-turn hooks | `runtime/src/hooks/` | Memory hooks exist but no background sync trigger |
| Scope manager | `memory/src/scope/` | Access control only — no search provenance scoping |

### What's Missing

| Pattern | cognee | Our Gap | Impact |
|---------|--------|---------|--------|
| **Discriminated Union Entries** | `QAEntry`, `TraceEntry`, `FeedbackEntry`, `SkillRunEntry` | `ingest()` takes `kind: string`, no typed payload contracts | Type safety + clear routing |
| **Two-Tier + Background Sync** | Session cache + graph, synced via `improve()` background task | Dreamer consumer is polling-based, not event-triggered | Latency: 30s poll vs async trigger |
| **Rule-Based Query Router** | `SearchType` enum, 16 patterns, zero-LLM cost | No query routing — all recall goes through tier hierarchy | LLM cost on every recall |
| **Awaitable Result Handle** | `RememberResult` is `__await__`, `__bool__`, `done()` | Tools return plain `ToolResult` | No background completion tracking |
| **Recall Scope / Provenance** | `scope="session|graph|trace|all"` with `_source` | Only `MemoryScope` for access control | No search provenance |
| **Feedback-Weighted Graph** | `feedback_score` → graph node/edge weights | No feedback capture at all | Can't learn from ratings |
| **Pipeline as Task Graph** | `add()` + `cognify()` compose from `Task` lists | Orchestrator has task-board — different abstraction level | Already partially covered |

---

## Revised Adoption Plan

### Adoption 1: cognee — Memory API Redesign (HIGH ROI)

#### TASK-EXT-001R: Discriminated Union Memory Entries

**Effort:** 3h
**Location:** `packages/memory/src/entries/`

Replace `ingest()`'s freeform `kind: string` with typed discriminated union entries:

```typescript
// Discriminated by `type` literal — single `remember()` dispatches to correct backend
export interface QATurnEntry {
  type: 'qa';
  question: string;
  answer: string;
  context?: string;
  feedbackScore?: number;
  usedGraphElementIds?: string[];
}

export interface TraceStepEntry {
  type: 'trace';
  toolName: string;
  status: 'success' | 'error';
  args: Record<string, unknown>;
  result: unknown;
  errorMessage?: string;
}

export interface FeedbackEntry {
  type: 'feedback';
  qaId: string;
  feedbackText: string;
  feedbackScore: number;
}

export interface SkillRunEntry {
  type: 'skill_run';
  skillId: string;
  task: string;
  resultSummary: string;
  successScore: number;
  latencyMs: number;
}

export type MemoryEntry = QATurnEntry | TraceStepEntry | FeedbackEntry | SkillRunEntry;
```

**Rationale:** Single `remember()` function dispatches typed payloads without type-checking branches. Enables provenance tracking (each entry type maps to a `_source` value). Both `memory_append` tool and `extract()` feed into the same entry model.

**Already in place:** `extraction/index.ts` has 5 `ExtractedFactKind` literals — rename to match entry types and add structured payload fields.

**Verification:** `pnpm test` passes; `pnpm check-types` clean.

---

#### TASK-EXT-002R: Unified remember() / recall() / forget() / improve() Surface

**Effort:** 4h
**Location:** `packages/memory/src/unified-api.ts`

Wrap existing cognitive engine + wiki + extraction behind cognee's 4-op surface:

```typescript
export class UnifiedMemory {
  constructor(
    private engine: MemoryEngine,
    private wiki: WikiManager,
    private dreamer: DreamerConsumer,
    private extractor: FactExtractor,
    private registry: ToolRegistry
  ) {}

  async remember(entry: MemoryEntry, sessionId?: string): Promise<RememberResult> {
    // 1. Store to fast session cache (CortexKit session_meta)
    // 2. If no sessionId, also cognify into wiki/graph
    // 3. If sessionId + selfImprovement, spawn background improve()
    // 4. Return immediately with RememberResult handle
  }

  async recall(query: string, options?: {
    sessionId?: string;
    scope?: 'session' | 'graph' | 'trace' | 'all';
    limit?: number;
  }): Promise<Array<{ entry: MemoryEntry; source: string; score: number }>> {
    // Route through RecallRouter, merge results with provenance
  }

  async forget(dataset?: string): Promise<void> {
    // Clear session cache and/or wiki pages
  }

  async improve(options?: {
    sessionIds?: string[];
    runInBackground?: boolean;
  }): Promise<ImproveResult> {
    // Bridge session → wiki/graph (like cognee improve())
    // Bridge graph summaries ← back to session cache (bidirectional)
  }
}
```

**Already in place:** `MemoryEngine` has `ingest()`, `recall()`. Dreamer consumer has `checkAndSync()`. Wiki has `upsertPage()`. CortexKit session store provides durable cache.

**Key delivery:** `remember()` with background `improve()` — currently the dreamer consumer polls epoch, should also fire on-demand via `improve()`.

**Rationale:** Single entry point for all memory operations. The `remember()` dispatch + `improve()` bridge are the highest-ROI pattern from cognee.

**Verification:** All existing `ingest`/`recall` callers migrated to `remember`/`recall`. Old surface deprecated but not removed.

---

#### TASK-EXT-003R: Rule-Based Query Router (No LLM Cost)

**Effort:** 2h
**Location:** `packages/memory/src/recall-router.ts`

```typescript
export type SearchStrategy =
  | 'chunks'          // Full-text search on wiki pages
  | 'vector'          // Vector similarity on embeddings
  | 'session'         // CortexKit session cache
  | 'temporal'        // Time-bounded recall (when/before/after queries)
  | 'graph_summary'   // Wiki page summaries (tl;dr queries)
  | 'code_rules'      // Code-specific search (coding_ rules, refactoring)
  | 'hybrid';         // Combined vector + full-text + rerank

export class RecallRouter {
  route(query: string): { strategy: SearchStrategy; overrides: string[] } {
    // Cognee-inspired weighted pattern matching:
    //   "why"/"explain" → graph_summary    (weight 4)
    //   "when"/"before" → temporal          (weight 3-6)
    //   "how is X related" → vector         (weight 5)
    //   def/async/import → code_rules       (weight 3)
    //   quoted "exact phrase" → chunks      (weight 8)
    //   default → hybrid                    (weight 2)
    //
    // Override tracking: records (routed, overridden) pairs
    // Negation window: skip relationship search when "not" within 20 chars
  }
}
```

**Rationale:** Current recall traverses tiers by recency/importance — no semantic routing. cognee's rule-based router costs zero LLM calls and covers 16 query types. Implementing a subset (6 strategies) covers 90% of real queries.

**Already in place:** `unified-query.ts` has `HybridQuery` — can extend to accept `SearchStrategy` from the router.

**Verification:** `recallRouter.route('why is this happening')` returns `graph_summary`. `recallRouter.route('def fibonacci')` returns `code_rules`.

---

#### TASK-EXT-0017R: Recall Scope with Provenance

**Effort:** 2h
**Location:** `packages/memory/src/recall.ts`

Extend `recall()` to accept `scope` parameter and annotate results with `_source`:

```typescript
interface RecallOptions {
  scope?: 'auto' | 'session' | 'graph' | 'trace' | 'all';
  // auto: session_id alone → [session, graph]; session_id + dataset → both; no session → graph
  // session: CortexKit session cache only
  // graph: wiki/RAG/tiers only
  // trace: agent trace steps only (future)
  // all: union of [graph, session, trace]
}

interface RecallResult {
  entry: MemoryEntry;
  _source: 'session' | 'graph' | 'trace';  // Provenance discriminator
  score: number;
}
```

**Rationale:** Without scope, every recall searches all tiers + wiki. Scope lets callers target the right backend, and `_source` lets them distinguish where results came from (analogous to how recall scope works in the session continuity plan).

**Already in place:** `unified-query.ts` has `HybridQuery` that searches wiki + RAG. Session search exists in `session-store.ts` but isn't integrated into recall.

**Verification:** `recall('dark mode', { scope: 'session' })` returns only session-cached entries with `_source: 'session'`.

---

#### TASK-EXT-0018R: Awaitable Result Handle

**Effort:** 2h
**Location:** `packages/memory/src/result-handle.ts`

```typescript
export class RememberResult {
  readonly status: 'session_stored' | 'completed' | 'errored';
  readonly entryId?: string;
  readonly entryType?: MemoryEntry['type'];
  readonly sessionId?: string;
  private _task?: Promise<void>;
  private _error?: Error;

  /** Returns true if background sync completed. */
  get done(): boolean { /* check _task status */ }

  /** Await to block on background improve(). */
  then<T>(onfulfilled: (v: this) => T): Promise<T> { /* proxy _task */ }
}
```

**Rationale:** cognee's `RememberResult` is printable, awaitable, truthy. Background errors write to the handle instead of raising. Our current `capture()` returns `void` — callers can't track async completion.

**Already in place:** `memory_append` tool returns `{ id, stored }`. Extend to return a handle that tracks background sync.

**Verification:** `await remember(...)` blocks until session store + optional improve() complete. `result.done` returns boolean without awaiting.

---

### Adoption 2–7: Agentica, Eko, Deer-Flow, Agno, Octotools, Context-Mode

#### Status: DEFERRED (Scope Reduction)

| Task | Pattern | Reason for Deferral |
|------|---------|--------------------|
| EXT-004: Selector Agent | LLM-based tool filtering | No immediate need — current tool set is small |
| EXT-005: Validation Feedback | AI arg correction | Guardrails already handle schema validation |
| EXT-006: Pause/Resume/Interrupt | Workflow controls | Session pause/resume already done (Phase 6) |
| EXT-007: Dependency-aware parallel | Orchestration | Task-board in orchestrator covers this |
| EXT-008: Progressive skill loading | Skill relevance filtering | Plugin system not yet integrated with runtime |
| EXT-009: Isolated sub-agent context | Sandboxed agents | Phase 4 agents are single-context |
| EXT-010: IM channel integration | Telegram/Slack | Connectors exist as stubs only |
| EXT-011: Context summarization | Long task offloading | Future Phase (post Phase 8) |
| EXT-012: Human approval | Admin-block tools | Guardrails approval hooks cover this |
| EXT-013: Context providers | Live data fetch | MCP bridge tool covers this |
| EXT-014: AG-UI + A2A exposure | Protocol interfaces | AG-UI exists; A2A is future |
| EXT-015: Tool card standardization | Octotools pattern | ToolDefinition already has annotations |
| EXT-016: SQLite session event log | Event persistence | CortexKit session_meta covers this |
| EXT-017: FTS5 search across sessions | Full-text search | Deferred — requires event log first |
| EXT-018: PreCompact hook | Resume snapshot | Session recovery handles this |

---

## Timeline

| Task | Effort | Dependencies | Value |
|------|--------|-------------|-------|
| EXT-001R: Discriminated Union Entries | 3h | None | High |
| EXT-002R: Unified remember()/recall() | 4h | EXT-001R | Critical |
| EXT-003R: Rule-Based Query Router | 2h | None | High |
| EXT-0017R: Recall Scope + Provenance | 2h | EXT-002R | Medium |
| EXT-0018R: Awaitable Result Handle | 2h | EXT-002R | Medium |
| **Total (Phase 14 Revised)** | **~13h** | | |

### Execution Order

```text
Batch 1 (parallel):
  EXT-001R — Discriminated Union Entries (3h)
  EXT-003R — Rule-Based Query Router (2h)

Batch 2 (depends on Batch 1):
  EXT-002R — Unified remember()/recall()/forget()/improve() (4h)

Batch 3 (depends on Batch 2):
  EXT-0017R — Recall Scope + Provenance (2h)
  EXT-0018R — Awaitable Result Handle (2h)
```

---

## Success Criteria

- [ ] `MemoryEntry` discriminated union replaces freeform `kind: string`
- [ ] `remember(entry)` routes typed payloads to correct backend (session cache / wiki / both)
- [ ] `remember()` with `sessionId` returns immediately; background `improve()` bridges to graph
- [ ] `recall(query, { scope })` returns results with `_source` provenance
- [ ] `RecallRouter` routes queries without any LLM calls
- [ ] `RememberResult` is awaitable, truthy-checkable, tracks background completion
- [ ] `forget(dataset)` clears session cache and/or wiki pages
- [ ] `improve()` bridges session → wiki/graph and graph summaries ← back to session
- [ ] All existing `ingest`/`recall` callers work via deprecated forwarding
- [ ] `pnpm check-types` clean
- [ ] `pnpm lint` clean
- [ ] All tests pass

---

**Next:** Begin TASK-EXT-001R (Discriminated Union Entries) — foundational for all subsequent tasks.
