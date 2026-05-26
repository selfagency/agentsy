<<<<<<< Updated upstream

# @agentsy/memory — Implementation Plan v2

> Supersedes `UPDATED-IMPLEMENTATION-PLAN.md`. Accounts for the ~5,500 lines of implementation code that now exist and focuses only on remaining gaps.

---

## Current Implementation Inventory

| Module                   | Lines      | Key Exports                                                                                                                                                                                                        | Status                          |
| ------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `types.ts`               | 50         | `ContextFingerprint`, `MemoryReuseHint`                                                                                                                                                                            | Done                            |
| `reuse.ts`               | 49         | `rankReusableMemoryBlocks`, `ReusableMemoryBlock`                                                                                                                                                                  | Done                            |
| `coordination/`          | 335        | `AtomicWorkflowCoordinator`, `Scheduler`, `TaskQueue`, `PubSubManager`, `HonkerLoader`                                                                                                                             | Done                            |
| `content-addressing/`    | 163        | `blake3` fingerprint, `DedupStore`, `migrate`, `verify`                                                                                                                                                            | Done                            |
| `filesystem/agentfs/`    | 427        | `AgentFsManager`, `KVStore`, `Snapshots`, `AuditTrail`                                                                                                                                                             | Done                            |
| `observability/`         | 116        | `MemoryMetrics`, `redactSecretLikeValues`                                                                                                                                                                          | Done                            |
| `retrieval/injection.ts` | 132        | `injectMemoryContext`, `formatMemoryContextXml`                                                                                                                                                                    | Done                            |
| `retrieval/retriever.ts` | 175        | `MemoryRetriever`, top-K search                                                                                                                                                                                    | Done                            |
| `retrieval/rag/`         | 723        | `HybridRetriever`, `QueryPlanner`, `RAGBootstrapper`, `KnowledgeBaseManager`, `IndexManager`, `DocumentIngestor`, `ReindexScheduler`, `ContextPacker`, `Reranker`, `Sanitizer`, `ServerClient`, `SourceConnectors` | Done                            |
| `scope/`                 | 91         | `ScopeManager`, `MemoryScope` (5 levels)                                                                                                                                                                           | Done                            |
| `sync/`                  | ~1200      | `TursoClient`, `TursoManager`, `MemoryStateAdapter`, `ConflictResolution`, `BackupManager`, `SyncScheduler`, `Security`, `Integrity`, `Metrics`                                                                    | Done                            |
| `tools/`                 | 275        | `capture`, `search`, `list`, `stats`, `lint`                                                                                                                                                                       | Done                            |
| `wiki/`                  | 778        | `WikiManager`, `EntityExtractor`, `ContentProcessor`, `NavigationSystem`, `VersionTracker`, `LocalEmbeddingEngine`                                                                                                 | Done                            |
| **Total**                | **~5,491** |                                                                                                                                                                                                                    | **All phase-1/2 modules exist** |

---

## Gap Analysis — What's Missing

The five gaps mapped against the architecture document:

| #   | Gap                                                                                                                                                                     | Architecture Reference                      | Existing Code Overlap                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **Cognitive tier lifecycle engine** — no `MemoryTier` base, no `SensoryBuffer`/`SensoryRegister`/`WorkingMemory`/`ShortTermMemory`/`LongTermMemory` classes, no bridges | Architecture §1–5                           | `MemoryScope` (5 levels in scope-manager) is the tier enum but has no lifecycle; `reuse.ts` has hot/warm/cold classification but no promotion |
| G2  | **Processing pipeline** — no Compressor, Synthesizer, or Summarizer classes connecting tiers                                                                            | Architecture §6 (Bridges & Processing)      | `ContentProcessor` (wiki) and `EntityExtractor` (wiki) can be reused as components but not wired as tier-bridges                              |
| G3  | **Confidence scoring & decay** — no per-memory importance score, no time-decay, no auto-promotion/demotion                                                              | Strategy Synthesis §4 (agentmemory pattern) | `rankReusableMemoryBlocks` sorts by reuse class but doesn't track decay                                                                       |
| G4  | **Token budget enforcement** — no per-tier quota tracking, no budget negotiation with honker                                                                            | Architecture §7 (Token Budgets)             | `injectMemoryContext` formats XML but doesn't enforce budget caps; `ContextPacker` packs evidence but doesn't track tier quotas               |
| G5  | **Top-level engine & MCP surface** — no `MemoryEngine` orchestrator, no `awaken()`, no MCP server                                                                       | Architecture §8 (Integration)               | `HonkerLoader` loads coordination extensions but nothing wires the tiers together                                                             |

---

## Implementation Phases

### Phase 1: Cognitive Tier Engine (G1)

**Goal**: Implement the 5-tier lifecycle as composable, testable modules.

#### 1.1 Core types and tier interface

**File**: `src/cognitive/tier-types.ts`

```typescript
export type TierLevel = 1 | 2 | 3 | 4 | 5;
export type TierName =
  | 'sensory_buffer'
  | 'sensory_register'
  | 'working_memory'
  | 'short_term_memory'
  | 'long_term_memory';
export type WriteHeap = 'event' | 'query' | 'doc' | 'ref';
export type MemoryKind = 'semantic' | 'episodic' | 'procedural' | 'sensory';
export type ReuseClass = 'hot' | 'warm' | 'cold';

export interface TierConfig {
  level: TierLevel;
  name: TierName;
  maxTokens: number;
  maxItems: number;
  ttlMs: number; // time-to-live in ms (Infinity for LTM)
  consolidationThreshold: number; // 0-1, triggers promotion
  compressionTarget: number; // target reduction percentage
}

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  content: string;
  tokenCount: number;
  importance: number; // 0-1 confidence score
  writeHeap: WriteHeap;
  reuseClass: ReuseClass;
  createdAt: number; // performance.now()
  lastAccessedAt: number;
  accessCount: number;
  fingerprint: string; // blake3 from content-addressing
  metadata: Record<string, unknown>;
}

export interface TierReadResult<T = MemoryItem> {
  items: T[];
  tierName: TierName;
  tokenCount: number;
  overflowed: boolean;
}
```

**Acceptance**: Types compile without errors, exported from `src/cognitive/index.ts`.

#### 1.2 MemoryTier base class

**File**: `src/cognitive/memory-tier.ts`

```typescript
export interface MemoryTierLike {
  readonly name: TierName;
  readonly level: TierLevel;
  readonly config: TierConfig;
  write(item: MemoryItem): MemoryItem | null; // null if rejected
  read(query: TierReadQuery): TierReadResult;
  capacity(): { usedTokens: number; maxTokens: number; usedItems: number; maxItems: number };
  evict(count: number): MemoryItem[]; // FIFO eviction
  promote(count: number, to: MemoryTierLike): number; // returns items promoted
  demote(count: number, from: MemoryTierLike): number;
  clear(): void;
  items(): readonly MemoryItem[];
}
```

- In-memory `Map<string, MemoryItem>` store (pluggable later)
- Eviction: FIFO by default, respects importance threshold
- Promotion: sorts by `importance * recencyWeight(accessCount, age)` and moves top-N
- Demotion: moves bottom-N items to lower tier

**Acceptance**: Unit tests for write/read/evict/promote/demote on a generic `MemoryTier`.

#### 1.3 Five concrete tier implementations

**Files**: `src/cognitive/sensory-buffer.ts`, `sensory-register.ts`, `working-memory.ts`, `short-term-memory.ts`, `long-term-memory.ts`

Each extends `MemoryTier` with tier-specific defaults:

| Tier            | maxTokens | maxItems | ttlMs     | consolidationThreshold |
| --------------- | --------- | -------- | --------- | ---------------------- |
| SensoryBuffer   | 200       | 50       | 5_000     | 0.6                    |
| SensoryRegister | 400       | 4        | 2_000     | 0.5                    |
| WorkingMemory   | 1_000     | 7        | 30_000    | 0.4                    |
| ShortTermMemory | 2_000     | 12       | 3_600_000 | 0.3                    |
| LongTermMemory  | ∞         | ∞        | ∞         | 0.0                    |

**Acceptance**: Each tier instantiates with correct defaults; overflow behavior tested; TTL expiration tested (fast-clock pattern with injectable `now()`).

#### 1.4 Tier bridges

**File**: `src/cognitive/tier-bridge.ts`

```typescript
export interface TierBridge {
  from: TierName;
  to: TierName;
  transfer(items: MemoryItem[], reason: 'consolidation' | 'eviction' | 'manual'): number;
  canTransfer(): boolean;
}
```

Four bridges: 1→2, 2→3, 3→4, 4→5. Each bridge:

- Applies a **transform** (compress/synthesize/summarize — initially identity, Phase 2 adds transforms)
- Updates `lastAccessedAt` and `accessCount`
- Returns count of items actually transferred

**Acceptance**: Bridge integration test — insert 10 items into SensoryBuffer, trigger promotion, verify items appear in SensoryRegister.

#### 1.5 Tier-aware test infrastructure

- `src/cognitive/testing.ts` — `createTierTestClock()` returning injectable `now()` for deterministic TTL tests
- `src/cognitive/test-utils.ts` — `createTestMemoryItem()` factory with sensible defaults

**Acceptance**: Tests use injectable clock; no `setTimeout`/`Date.now()` in tier logic.

---

### Phase 2: Processing Pipeline (G2)

**Goal**: Wire Compressor, Synthesizer, and Summarizer into the tier bridges.

#### 2.1 Compressor (raw → working chunks)

**File**: `src/cognitive/compressor.ts`

Reuses `ContentProcessor` from wiki for chunking logic. Responsibilities:

- Split raw events into chunks (respecting `maxTokens` per chunk)
- Assign initial importance score based on: recency, content-type weight, source heuristics
- Compute blake3 fingerprint via existing `content-addressing/fingerprint.ts`

```typescript
export interface Compressor {
  compress(items: MemoryItem[], budget: number): CompressResult;
}

export interface CompressResult {
  chunks: MemoryItem[];
  discarded: MemoryItem[];
  tokenReduction: number; // percentage
}
```

**Acceptance**: Compressor reduces 500-token input to ≤200 tokens; discarded items tracked; fingerprint computed.

#### 2.2 Synthesizer (working → short-term)

**File**: `src/cognitive/synthesizer.ts`

Reuses `EntityExtractor` from wiki for relationship extraction. Responsibilities:

- Merge related chunks using semantic similarity (delegating to `LocalEmbeddingEngine`)
- Produce synthesized memory with higher importance score
- Preserve source references in `metadata.sourceIds`

```typescript
export interface Synthesizer {
  synthesize(items: MemoryItem[], budget: number): SynthesizeResult;
}

export interface SynthesizeResult {
  synthesized: MemoryItem[];
  sources: string[]; // source item IDs merged
  discarded: MemoryItem[];
  tokenReduction: number;
}
```

**Acceptance**: 5 related working-memory items synthesize into 1-2 short-term items with `metadata.sourceIds` referencing originals.

#### 2.3 Summarizer (short-term → long-term)

**File**: `src/cognitive/summarizer.ts`

Responsibilities:

- Apply LLM-based or rule-based summarization (defaults to rule-based, LLM pluggable)
- Generate `MetaAction` entries (patterns observed across memories)
- Write to appropriate write-heaps (event/query/doc/ref)

```typescript
export interface Summarizer {
  summarize(items: MemoryItem[], budget: number): SummarizeResult;
}

export interface SummarizeResult {
  longTermItems: MemoryItem[];
  metaActions: MetaAction[];
  discarded: MemoryItem[];
  tokenReduction: number;
}

export interface MetaAction {
  id: string;
  pattern: string;
  frequency: number;
  lastObserved: number;
  sourceIds: string[];
}
```

**Acceptance**: 10 short-term items summarize to 2-3 long-term items; at least one `MetaAction` extracted if pattern present.

#### 2.4 Wire bridges to pipeline

Update `TierBridge.transfer()` to use:

- Bridge 1→2: identity transform (passthrough)
- Bridge 2→3: `Compressor.compress()`
- Bridge 3→4: `Synthesizer.synthesize()`
- Bridge 4→5: `Summarizer.summarize()`

**Acceptance**: Full-pipeline integration test — insert event → SensoryBuffer → flows through all tiers → produces long-term item.

---

### Phase 3: Confidence Scoring & Decay (G3)

**Goal**: Add per-memory importance tracking with time-based decay and auto-promotion/demotion.

#### 3.1 Importance scoring

**File**: `src/cognitive/importance.ts`

```typescript
export function computeImportance(item: MemoryItem, factors: ImportanceFactors): number;

export interface ImportanceFactors {
  recencyWeight: number; // default: 0.3
  frequencyWeight: number; // default: 0.2
  sourceReliability: number; // 0-1, heuristic per source
  contentTypeWeight: number; // actions=0.8, observations=0.5, etc.
  relationalBoost: number; // boost for items referenced by other items
}
```

Applies weighted sum, clamped to [0, 1].

#### 3.2 Time-decay engine

**File**: `src/cognitive/decay.ts`

```typescript
export function applyDecay(items: MemoryItem[], now: number, config: DecayConfig): DecayedItem[];

export interface DecayConfig {
  sensoryBufferHalfLife: number; // ms, default: 2_500
  sensoryRegisterHalfLife: number; // ms, default: 1_000
  workingMemoryHalfLife: number; // ms, default: 15_000
  shortTermHalfLife: number; // ms, default: 1_800_000 (30 min)
  longTermHalfLife: number; // ms, default: Infinity (no decay)
  minimumImportance: number; // delete below this, default: 0.05
}

export interface DecayedItem {
  item: MemoryItem;
  newImportance: number;
  tier: TierName;
  action: 'keep' | 'promote' | 'demote' | 'discard';
}
```

Uses exponential decay: `importance * Math.pow(0.5, age / halfLife)`

**Acceptance**: Items older than halfLife have halved importance; items below `minimumImportance` get action `'discard'`.

#### 3.3 Auto-promotion/demotion scheduler

**File**: `src/cognitive/tier-scheduler.ts`

Integrates with existing `createInMemoryScheduler()` from coordination:

- Runs decay pass every N seconds (configurable, default 30s)
- Triggers bridge promotion for items exceeding `consolidationThreshold`
- Triggers bridge demotion for items falling below minimum importance
- Emits events via existing `PubSubManager`

**Acceptance**: Scheduler runs decay pass, promotes a high-importance item from working → short-term, and demotes a low-importance item back to sensory register.

---

### Phase 4: MemoryEngine Orchestrator & Token Budget (G4, G5)

**Goal**: Top-level `MemoryEngine` that wires everything together, enforces budgets, provides `awaken()`, and exposes the MCP surface.

#### 4.1 TokenBudget tracker

**File**: `src/cognitive/token-budget.ts`

```typescript
export interface TokenBudget {
  readonly config: BudgetConfig;
  available(name: TierName): number;
  allocated(name: TierName): number;
  allocate(name: TierName, tokens: number): boolean; // false if over budget
  release(name: TierName, tokens: number): void;
  reclaim(name: TierName): number; // reclaim up to reclamationThreshold, return bytes freed
}

export interface BudgetConfig {
  tierQuotas: Record<TierName, number>;
  reclamationThresholds: Record<TierName, number>;
  outputReductionTarget: number; // 0.75
  memoryReductionTarget: number; // 0.46
}
```

Reuses `ScopeManager` for RBAC validation of budget changes.

**Acceptance**: Budget enforcement prevents over-allocation; `reclaim()` returns freed tokens.

#### 4.2 awaken()

**File**: `src/cognitive/awaken.ts`

```typescript
export async function awaken(engine: MemoryEngine, context: AwakenContext): Promise<AwakenResult>;

export interface AwakenContext {
  now: number;
  idleTimeMs: number;
  pendingEvents: MemoryItem[];
}

export interface AwakenResult {
  consolidated: number; // items consolidated
  decayed: number; // items decay-processed
  promoted: number; // items promoted
  demoted: number; // items demoted
  discarded: number; // items discarded
  budgetReclaimed: number; // tokens reclaimed
  durationMs: number;
}
```

Logic:

1. Process `idleTimeMs` — run decay for items that aged during idle
2. Run scheduled consolidations (bridge promotions for items above threshold)
3. Ingest any `pendingEvents` into SensoryBuffer
4. Reclaim budget from low-importance items
5. Return summary

**Acceptance**: `awaken()` with `idleTimeMs=60_000` triggers decay and promotion; returns counts matching expected behavior.

#### 4.3 MemoryEngine orchestrator

**File**: `src/cognitive/memory-engine.ts`

```typescript
export interface MemoryEngine {
  readonly tiers: Record<TierName, MemoryTierLike>;
  readonly bridges: TierBridge[];
  readonly budget: TokenBudget;
  readonly scheduler: TierScheduler;

  ingest(event: MemoryItem): IngestResult;
  recall(query: RecalQuery): RecallResult;
  awaken(context: AwakenContext): Promise<AwakenResult>;
  snapshot(): EngineSnapshot;
  reset(): void;
}

export interface IngestResult {
  tier: TierName;
  itemId: string;
  promoted: boolean;
  targetTier?: TierName;
}

export interface RecallQuery {
  query: string;
  scope?: MemoryScope;
  maxTokens?: number;
  minImportance?: number;
  tiers?: TierName[];
}

export interface RecallResult {
  items: MemoryItem[];
  totalTokens: number;
  budgetRemaining: number;
  fromTiers: TierName[];
}

export interface EngineSnapshot {
  tiers: Record<TierName, { itemCount: number; tokenCount: number }>;
  budget: Record<TierName, { allocated: number; max: number }>;
  timestamp: number;
}
```

`recall()` delegates to existing `MemoryRetriever` for semantic search, but also falls back to tier-scoped enumeration when no embedding engine is available.

**Acceptance**: Integration test — `ingest()` → item flows through tiers via `awaken()` → `recall()` returns relevant items within budget.

---

### Phase 5: Persona Memory & Knowledge Graph (Extension)

**Goal**: Per-user persona layers and auto-built knowledge graphs, inspired by memUBot and agentmemory.

#### 5.1 Persona memory

**File**: `src/cognitive/persona/persona-store.ts`

```typescript
export interface PersonaStore {
  get(userId: string): PersonaMemory;
  update(userId: string, patch: PersonaPatch): PersonaMemory;
  listAttributes(userId: string): PersonaAttribute[];
}

export interface PersonaMemory {
  userId: string;
  attributes: PersonaAttribute[];
  preferences: Record<string, unknown>;
  communicationStyle: CommunicationProfile;
  updatedAt: number;
}
```

Backed by existing `KVStore` from `filesystem/agentfs`.

#### 5.2 Knowledge graph auto-building

**File**: `src/cognitive/knowledge/graph-builder.ts`

Uses existing `EntityExtractor` + `EntityRelationship` types to build an adjacency-list graph:

- On each `ingest()`, extract entities and relations
- Merge into graph (dedup by `fingerprint`)
- Expose `queryGraph(entity)` for RAG context enrichment

```typescript
export interface KnowledgeGraph {
  addNode(node: GraphNode): void;
  addEdge(edge: GraphEdge): void;
  query(entity: string, depth?: number): Subgraph;
  merge(other: KnowledgeGraph): number; // returns merged count
}

export interface GraphNode {
  id: string;
  kind: EntityKind;
  label: string;
  importance: number;
  firstSeen: number;
  lastSeen: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
}
```

**Acceptance**: Ingesting "Alice met Bob at Conference X" produces nodes for Alice, Bob, Conference X with a `met_at` edge.

---

### Phase 6: MCP Server Surface (Integration)

**Goal**: Expose `MemoryEngine` as Model Context Protocol tools so any MCP client can use it.

#### 6.1 MCP tool definitions

**File**: `src/mcp/tools.ts` (new directory)

Tools to expose:

- `memory_ingest` — ingest an event
- `memory_recall` — recall memories matching a query
- `memory_awaken` — trigger consolidation/decay
- `memory_stats` — get tier utilization and budget info
- `memory_lint` — check memory health (already exists as tool)

Uses existing `tools/memory-*.ts` implementations internally.

#### 6.2 MCP server

**File**: `src/mcp/server.ts` (new)

Stdio-based MCP server using the `@modelcontextprotocol/sdk` package (already a dependency or add it).

**Acceptance**: MCP client can call `memory_ingest` → `memory_awaken` → `memory_recall` and get context-enriched results.

---

## File Structure Summary

```text
src/
├── cognitive/                    # NEW — Phase 1-4
│   ├── tier-types.ts             # TierLevel, TierName, TierConfig, MemoryItem, etc.
│   ├── memory-tier.ts            # MemoryTierLike interface + base implementation
│   ├── sensory-buffer.ts         # Tier 1
│   ├── sensory-register.ts       # Tier 2
│   ├── working-memory.ts         # Tier 3
│   ├── short-term-memory.ts      # Tier 4
│   ├── long-term-memory.ts       # Tier 5
│   ├── tier-bridge.ts            # Bridge interface + 4 implementations
│   ├── compressor.ts             # Phase 2: SensoryCompressor
│   ├── synthesizer.ts            # Phase 2: WorkingMemorySynthesizer
│   ├── summarizer.ts             # Phase 2: ShortTermSummarizer
│   ├── importance.ts             # Phase 3: importance scoring
│   ├── decay.ts                  # Phase 3: time-decay engine
│   ├── tier-scheduler.ts         # Phase 3: auto-promotion/demotion
│   ├── token-budget.ts           # Phase 4: budget enforcement
│   ├── awaken.ts                 # Phase 4: sleep-mode recovery
│   ├── memory-engine.ts          # Phase 4: top-level orchestrator
│   ├── persona/                  # Phase 5
│   │   └── persona-store.ts
│   ├── knowledge/                # Phase 5
│   │   └── graph-builder.ts
│   ├── testing.ts                # Test clock + factory helpers
│   └── index.ts                  # Barrel export
├── mcp/                          # NEW — Phase 6
│   ├── tools.ts
│   └── server.ts
├── (existing modules unchanged)
```

---

## Dependency Map

```text
cognitive/tier-types  ←── cognitive/memory-tier ←── cognitive/sensory-buffer, sensory-register, working-memory, short-term-memory, long-term-memory
cognitive/tier-bridge ←── cognitive/memory-tier
cognitive/compressor  ←── wiki/content-processor, content-addressing/fingerprint
cognitive/synthesizer ←── wiki/entity-extractor, wiki/local-embedding-engine, cognitive/tier-types
cognitive/summarizer  ←── cognitive/tier-types
cognitive/importance   ←── cognitive/tier-types
cognitive/decay        ←── cognitive/importance, cognitive/tier-types, cognitive/tier-scheduler
cognitive/tier-scheduler ←── coordination/scheduler, coordination/pub-sub-manager, cognitive/decay, cognitive/tier-bridge
cognitive/token-budget ←── cognitive/tier-types, scope/scope-manager
cognitive/awaken       ←── cognitive/memory-engine, cognitive/decay, cognitive/tier-scheduler, cognitive/token-budget
cognitive/memory-engine ←── all cognitive modules, retrieval/retriever, retrieval/injection
mcp/*                  ←── cognitive/memory-engine, tools/*
```

---

## Testing Standards

All new cognitive modules follow existing conventions:

- Vitest with `vi.fn()` spies
- Colocated `*.test.ts` files
- Deterministic time via injectable `now()` (no `Date.now()` or `setTimeout`)
- Chunk-by-chunk testing for streaming/processing paths
- Adversarial inputs (empty, malformed, oversized)
- Safety rails (token limits, depth limits)

Test target: ≥80% coverage per module, 100% coverage of promotion/demotion budget enforcement paths.

---

## Success Metrics

| Metric                 | Target                 | Measurement                                  |
| ---------------------- | ---------------------- | -------------------------------------------- |
| Output token reduction | 75%                    | `recall()` returns ≤25% of raw memory tokens |
| Memory token reduction | 46%                    | Tier storage uses ≤54% of raw input tokens   |
| Consolidation latency  | <200ms                 | `awaken()` time for 100 items                |
| Promotions per awaken  | ≥1 for saturated tiers | Items above threshold get promoted           |
| Budget enforcement     | 100%                   | No tier exceeds its quota                    |
| Test coverage          | ≥80%                   | `vitest --coverage`                          |

---

## Risks & Mitigations

| Risk                         | Mitigation                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Embedding engine unavailable | Synthesizer falls back to `EntityExtractor` keyword matching; `LocalEmbeddingEngine` already exists in wiki |
| LTM unbounded growth         | `importance` threshold + `accessCount` heuristics archive cold items; TTL-based cleanup in `awaken()`       |
| Bridge transforms too lossy  | Each bridge starts with identity transform; compress/synthesize/summarize are additive (Phase 2)            |
| Tier promotion thrashing     | Hysteresis: must exceed `consolidationThreshold` to promote; must drop below `minimumImportance` to demote  |
| Budget starvation            | `reclaim()` automatically frees tokens from lowest-importance items when a tier hits quota                  |

---

## Phase 7: Standalone Distribution (Skill, Hooks, Installer, Daemon)

The memory package must work independently — installed, configured, and running without the monorepo or the CLI package. This phase adds four deliverables that make `@agentsy/memory` a self-contained product.

### 7.1 Agent Skill — `memory` SKILL.md

**File**: `packages/memory/skill/SKILL.md`

A portable skill file that teaches any MCP-compatible agent how to use the memory system. Follows the skill frontmatter format already used in this repo (see `.agents/skills/`).

```yaml
---
name: memory
description: >
  Persistent cognitive memory for AI agents. Ingest events, recall context,
  manage tier lifecycle (awaken/sleep), enforce token budgets, and query
  knowledge graphs. Use when the agent needs to remember across sessions,
  reduce context window waste, or maintain per-user persona profiles.
---
```

The skill document covers:

1. **Quick start** — `npx @agentsy/memory init` + first ingest/recall
2. **Tier model** — 5-tier cognitive architecture at a glance
3. **Tool reference** — `memory_ingest`, `memory_recall`, `memory_awaken`, `memory_stats`, `memory_lint`, `memory_search`, `memory_list`, `memory_capture`
4. **Token budget strategy** — how to negotiate memory quota with the host agent
5. **Session lifecycle** — `awaken()` on boot, decay during idle, flush on shutdown
6. **Persona/memory scopes** — per-user isolation, shared project memory
7. **Error handling** — what happens when tiers overflow or budget exhausts
8. **CLI commands** — `memory-sync-dev`, `content-address-stats`, `daemon`

The skill is installed by the `init` script (7.4) into the agent's skill directory (e.g. `~/.agents/skills/` or project `.agents/skills/`).

### 7.2 Agent Hooks — Lifecycle Integration Scripts

**Directory**: `packages/memory/src/hooks/`

Four lifecycle hooks that integrate with agent runtimes:

#### 7.2.1 `hooks/on-session-start.ts`

```typescript
export interface OnSessionStartInput {
  engine: MemoryEngine;
  userId?: string;
  projectId?: string;
  pendingEvents?: MemoryItem[];
}

export interface OnSessionStartOutput {
  warmMemories: MemoryItem[]; // pre-loaded context for agent prompt
  tierCapacity: Record<TierName, { used: number; max: number }>;
  budgetAvailable: number;
}

export async function onSessionStart(input: OnSessionStartInput): Promise<OnSessionStartOutput>;
```

- Calls `awaken()` to process idle-time decay
- Loads hot memories for immediate injection
- Returns capacity/budget summary for the agent to plan context allocation

#### 7.2.2 `hooks/on-session-end.ts`

```typescript
export interface OnSessionEndInput {
  engine: MemoryEngine;
  sessionEvents: MemoryItem[];
  persist?: boolean; // default true
}

export interface OnSessionEndOutput {
  consolidated: number;
  persisted: number;
  durationMs: number;
}

export async function onSessionEnd(input: OnSessionEndInput): Promise<OnSessionEndOutput>;
```

- Ingests remainder of session events
- Runs final consolidation pass
- Returns summary for agent logging

#### 7.2.3 `hooks/on-tool-call.ts`

```typescript
export interface OnToolCallInput {
  engine: MemoryEngine;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: string;
  importance?: number; // default: 0.5
}

export async function onToolCall(input: OnToolCallInput): Promise<void>;
```

- Automatically captures tool call results as sensory events
- Assigns importance based on tool type heuristics (write tools → higher, read tools → lower)

#### 7.2.4 `hooks/on-response.ts`

```typescript
export interface OnResponseInput {
  engine: MemoryEngine;
  responseContent: string;
  responseTokens: number;
  modelFamily: string;
}

export async function onResponse(input: OnResponseInput): Promise<void>;
```

- Captures agent responses as episodic memories
- Tracks token usage against budget
- Flags high-importance responses for promotion

All hooks are exported from the package and usable programmatically. They are also referenced by the skill and wired by the init script into agent hook configurations.

### 7.3 MCP Server & Daemon

**Directory**: `packages/memory/src/mcp/`

#### 7.3.1 MCP tool definitions

**File**: `src/mcp/tools.ts`

Wraps existing `tools/memory-*.ts` implementations as MCP tool handlers:

| MCP Tool Name    | Maps To                   | Description                         |
| ---------------- | ------------------------- | ----------------------------------- |
| `memory_ingest`  | `tools/memory-capture.ts` | Ingest an event into sensory buffer |
| `memory_recall`  | `tools/memory-search.ts`  | Recall memories matching a query    |
| `memory_awaken`  | `cognitive/awaken.ts`     | Trigger consolidation/decay cycle   |
| `memory_stats`   | `tools/memory-stats.ts`   | Get tier utilization and budget     |
| `memory_lint`    | `tools/memory-lint.ts`    | Check memory health                 |
| `memory_list`    | `tools/memory-list.ts`    | List memories in a tier             |
| `memory_search`  | `tools/memory-search.ts`  | Semantic search across tiers        |
| `memory_capture` | `tools/memory-capture.ts` | Capture raw content                 |

Each tool follows the MCP protocol: accepts `CallToolRequest`, returns `CallToolResult` with structured content.

#### 7.3.2 MCP server process

**File**: `src/mcp/server.ts`

Stdio-based MCP server using `@modelcontextprotocol/sdk`:

```typescript
export interface MemoryMCPServerOptions {
  transport: 'stdio' | 'http';
  port?: number; // for HTTP mode
  dbPath?: string; // SQLite path, default: .agentsy/memory.db
  syncUrl?: string; // Turso sync URL, optional
  syncAuthToken?: string; // Turso auth token, optional
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export async function createMemoryMCPServer(options: MemoryMCPServerOptions): Promise<MCPServer>;
export async function startMemoryMCPServer(options: MemoryMCPServerOptions): Promise<void>;
```

Key design decisions:

- **Stdio mode** (default): runs as a child process of the agent, communicates via MCP protocol over stdin/stdout
- **HTTP mode**: runs as a standalone daemon, communicates via SSE or StreamableHTTP transport
- **Database**: defaults to local SQLite (via `sync/turso-manager.ts`), optionally syncs to Turso cloud
- **Configuration**: via environment variables (`AGENTSY_MEMORY_*`) or constructor options
- **Graceful shutdown**: SIGTERM handler flushes pending events and closes database connections

The server is **independent of `@agentsy/cli`** — it imports only from `@agentsy/memory` (workspace dependency) and `@modelcontextprotocol/sdk` (external dependency).

#### 7.3.3 Daemon process

**File**: `src/mcp/daemon.ts`

Wraps the MCP server with process management:

```typescript
export interface DaemonConfig {
  pidFile?: string; // default: .agentsy/memory-daemon.pid
  logFile?: string; // default: .agentsy/memory-daemon.log
  restart?: boolean; // auto-restart on crash, default: true
  restartDelay?: number; // ms, default: 1000
  maxRestarts?: number; // default: 5 within restartWindow
  restartWindow?: number; // ms, default: 60000
}

export async function startDaemon(options: MemoryMCPServerOptions & DaemonConfig): Promise<void>;
export async function stopDaemon(pidFile?: string): Promise<void>;
export async function isDaemonRunning(pidFile?: string): Promise<boolean>;
export async function getDaemonStatus(pidFile?: string): Promise<DaemonStatus | null>;
```

- PID file tracks the daemon process
- Log file captures stdout/stderr
- Auto-restart with exponential backoff
- Health check endpoint (HTTP mode): `GET /health` returns `DaemonStatus`

#### 7.3.4 Integration with CLI package

The `@agentsy/cli` package gains a thin wrapper command:

```typescript
// packages/cli/src/commands/memory-daemon.ts
export async function runMemoryDaemonCommand(rest: readonly string[], io: CliIO): Promise<number>;
```

- `agentsy memory daemon start` — starts the daemon via `@agentsy/memory`'s `startDaemon()`
- `agentsy memory daemon stop` — stops the daemon
- `agentsy memory daemon status` — checks daemon status
- `agentsy memory daemon restart` — restart

This is a **thin wrapper** — all logic lives in `@agentsy/memory`. The CLI package only provides the argument parsing and process spawning. This keeps memory fully standalone.

### 7.4 Install & Init Script

**File**: `packages/memory/src/init.ts` (exports) + `packages/memory/scripts/init.ts` (CLI entrypoint)

```typescript
export interface InitOptions {
  projectRoot?: string; // default: process.cwd()
  skillDir?: string; // default: <projectRoot>/.agents/skills/
  hooksDir?: string; // default: <projectRoot>/.agents/hooks/
  dbDir?: string; // default: <projectRoot>/.agentsy/
  mcpConfig?: string; // default: <projectRoot>/.opencode/mcp.json or <home>/.config/opencode/mcp.json
  transport?: 'stdio' | 'http';
  port?: number; // HTTP mode only, default: 4231
  syncUrl?: string; // Turso sync URL
  syncAuthToken?: string; // Turso auth token
  skipSkill?: boolean;
  skipHooks?: boolean;
  skipDb?: boolean;
  skipMcp?: boolean;
  force?: boolean; // overwrite existing files
}

export interface InitResult {
  skillPath: string;
  hooksPaths: string[];
  dbPath: string;
  mcpConfigPath: string;
  mcpEntry: Record<string, unknown>; // the MCP server config that was added
  warnings: string[];
}
```

The init script does five things, each skippable:

1. **Install skill** — copies `packages/memory/skill/SKILL.md` to `<skillDir>/memory/SKILL.md`
2. **Install hooks** — writes hook configuration files to `<hooksDir>/memory/`:
   - `on-session-start.json` — describes when/how to call `onSessionStart`
   - `on-session-end.json` — describes when/how to call `onSessionEnd`
   - `on-tool-call.json` — describes when/how to call `onToolCall`
   - `on-response.json` — describes when/how to call `onResponse`
3. **Initialize database** — creates SQLite database at `<dbDir>/memory.db` using `createTursoManager({ path: dbPath })`; runs schema migrations if needed
4. **Register MCP server** — adds the memory MCP server entry to the agent's config:
   - For OpenCode: `.opencode/mcp.json`
   - For Claude Code: `.claude/mcp.json`
   - For Cursor: `.cursor/mcp.json`
   - Generic: writes a standalone `mcp.json` that any MCP client can consume

   The MCP config entry:

   ```json
   {
     "mcpServers": {
       "agentsy-memory": {
         "command": "npx",
         "args": ["-y", "@agentsy/memory", "mcp"],
         "env": {
           "AGENTSY_MEMORY_DB": "<dbDir>/memory.db",
           "AGENTSY_MEMORY_TRANSPORT": "stdio"
         }
       }
     }
   }
   ```

5. **Print summary** — shows what was created, where, and how to verify

#### CLI entrypoint

**File**: `packages/memory/scripts/init.ts`

```bash
npx @agentsy/memory init [--skip-skill] [--skip-hooks] [--skip-db] [--skip-mcp] [--force] [--transport stdio|http] [--port 4231] [--sync-url URL] [--sync-auth-token TOKEN]
```

Also registers as a bin in `package.json`:

```json
{
  "bin": {
    "agentsy-memory": "./dist/scripts/init.js",
    "agentsy-memory-mcp": "./dist/scripts/mcp-server.js"
  }
}
```

So users can run:

- `agentsy-memory init` — run init
- `agentsy-memory-mcp` — start the MCP server directly (stdio mode)

#### 7.4.1 Configuration file

**File**: `packages/memory/src/config.ts`

Loads configuration from (in priority order):

1. Constructor options (programmatic)
2. Environment variables (`AGENTSY_MEMORY_*`)
3. `.agentsy/memory.env` (project-level)
4. `~/.agentsy/memory.env` (user-level)
5. Built-in defaults

```typescript
export interface MemoryConfig {
  db: { path: string; syncUrl?: string; syncAuthToken?: string; syncIntervalMs?: number };
  tiers: Record<TierName, TierConfig>;
  budget: BudgetConfig;
  decay: DecayConfig;
  mcp: { transport: 'stdio' | 'http'; port?: number };
  hooks: { onSessionStart: boolean; onSessionEnd: boolean; onToolCall: boolean; onResponse: boolean };
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadConfig(overrides?: Partial<MemoryConfig>): MemoryConfig;
```

---

### Phase 6: Learning Loop — Reflection, Dialectic & Solidification (New)

**Goal**: Implement the observation → reflection → consolidation cycle that transforms raw experience into durable knowledge, drawing from Honcho's dialectic pipeline, Hermes's reflection/doubling, and Evolver's GEP signal extraction.

This phase closes the loop: memories enter via sensory tiers (Phase 1), get bridged and compressed (Phase 2), receive importance scores (Phase 3), budget enforcement (Phase 4), and persona/graph enrichment (Phase 5). Phase 6 adds the **self-improving feedback mechanism** — the engine that learns from its own memories to refine importance heuristics, resolve contradictions, and solidify high-confidence knowledge.

#### 6.1 Observation extraction (inspired by Honcho `Deriver` + Evolver signal extraction)

**File**: `src/cognitive/learning/observation-extractor.ts`

Honcho's deriver extracts explicit observations from conversation turns. Evolver's signal extraction identifies multiple signal types (factual, emotional, procedural, corrective) from raw events. We unify these into a single `ObservationExtractor` that pulls structured observations from `MemoryItem` content.

```typescript
export type ObservationKind = 'factual' | 'emotional' | 'procedural' | 'corrective' | 'relational';

export interface Observation {
  id: string;
  kind: ObservationKind;
  content: string;
  sourceMemoryId: string;
  confidence: number; // 0-1, initial extraction confidence
  contradictsWith: string[]; // IDs of observations this contradicts
  supportsIds: string[]; // IDs of observations this reinforces
  extractedAt: number;
}

export interface ObservationExtractor {
  extract(memoryItem: MemoryItem): Promise<Observation[]>;
  extractBatch(items: MemoryItem[]): Promise<Observation[]>;
}
```

**Strategy composition** (from Evolver's multi-strategy extraction):

- `FactualExtractor` — extracts declarative facts ("X is Y", "user prefers Z")
- `ProceduralExtractor` — extracts step sequences ("to do X, first Y then Z")
- `CorrectiveExtractor` — extracts corrections ("previously thought X, actually Y") — feeds contradiction detection
- `EmotionalExtractor` — extracts preferences and affect ("user dislikes W", "user was frustrated with V")

Each strategy is a pure function `(content: string) => RawObservation[]`. The `ObservationExtractor` orchestrates them and deduplicates using content-addressing fingerprints.

**Acceptance**: Unit test — feed a `MemoryItem` with mixed content, verify multiple observations of different kinds are extracted with correct `kind` labeling.

#### 6.2 Dialectic resolution (inspired by Honcho `Dialectic` + `Representation` model)

**File**: `src/cognitive/learning/dialectic-resolver.ts`

Honcho's dialectic resolves contradictions between observations using four representation views (explicit, deductive, inductive, contradiction). We implement this as a `DialecticResolver` that detects contradictions among observations and produces resolved `Resolution` objects.

```typescript
export type RepresentationView = 'explicit' | 'deductive' | 'inductive' | 'contradiction';

export interface Representation {
  id: string;
  observationIds: string[];
  view: RepresentationView;
  summary: string;
  confidence: number;
}

export interface Resolution {
  id: string;
  contradictionIds: string[]; // observations in conflict
  representations: Representation[];
  resolvedSummary: string;
  resolutionConfidence: number; // how confident the resolution is
  method: 'deductive' | 'inductive' | 'temporal' | 'source_priority';
  timestamp: number;
}

export interface DialecticResolver {
  detectContradictions(observations: Observation[]): Promise<Observation[][]>;
  resolve(contradictions: Observation[][], priorityRules?: ResolutionPriority): Promise<Resolution[]>;
}

export interface ResolutionPriority {
  sourceWeights: Record<WriteHeap, number>; // e.g., { event: 0.8, doc: 0.6, query: 0.4, ref: 0.3 }
  recencyBias: number; // 0-1, how much to prefer newer observations
  confidenceThreshold: number; // minimum confidence to attempt resolution
}
```

Resolution methods:

1. **Deductive** — if one observation logically entails another, keep the entailed one
2. **Inductive** — if multiple observations point to a pattern, synthesize the general rule
3. **Temporal** — newer observations override older ones (weighted by `recencyBias`)
4. **Source priority** — observations from higher-priority heaps (`event` > `doc` > `query` > `ref`) win ties

**Acceptance**: Test — create two observations that contradict ("user likes dark mode" vs "user prefers light mode") with different timestamps; verify resolution picks the newer one when `recencyBias > 0.5` and the higher-source-weight one otherwise.

#### 6.3 Multi-specialist consolidation (inspired by Honcho `Dreamer` + Evolver `reflection`)

**File**: `src/cognitive/learning/consolidation-specialist.ts`

Honcho's dreamer uses multiple specialist agents (deduction, induction, surprisal) to consolidate memories. Evolver's reflection phase scores and selects genes. We implement a `ConsolidationSpecialist` that applies independent strategies to produce consolidated knowledge, then merges their outputs.

```typescript
export type SpecialistRole = 'deduction' | 'induction' | 'surprisal' | 'temporal';

export interface ConsolidationResult {
  id: string;
  role: SpecialistRole;
  inputObservationIds: string[];
  output: string; // consolidated summary
  confidence: number;
  noveltyScore: number; // how surprising is this consolidation (0-1)
  tokenCost: number; // approximate token cost of producing this
}

export interface ConsolidationSpecialist {
  consolidate(role: SpecialistRole, observations: Observation[]): Promise<ConsolidationResult>;
  merge(results: ConsolidationResult[]): Promise<MergedConsolidation>;
}

export interface MergedConsolidation {
  id: string;
  specialistResults: ConsolidationResult[];
  mergedSummary: string;
  finalConfidence: number;
  sourceObservationIds: string[];
}
```

Specialist strategies:

- **Deduction specialist** — identifies logical implications across observations; produces rules that must hold
- **Induction specialist** — identifies patterns across observations; produces probabilistic rules
- **Surprisal specialist** — identifies observations that contradicted expectations; produces "lesson learned" entries with high importance
- **Temporal specialist** — identifies how preferences or knowledge evolve over time; produces timeline entries

The `merge()` step:

1. Deduplicate overlapping summaries
2. Weight by `confidence × (1 - redundancy_score)`
3. If specialists agree, boost `finalConfidence`; if they disagree, lower it
4. Cap total `tokenCost` within budget constraints

**Note**: In the initial implementation, these specialists use deterministic heuristics (pattern matching, frequency counting, temporal ordering), not LLM calls. The architecture supports plugging in LLM-based specialists later via a `SpecialistProvider` interface.

```typescript
export interface SpecialistProvider {
  readonly role: SpecialistRole;
  consolidate(input: string, observations: Observation[]): Promise<string>;
}
```

Default providers are heuristic; LLM providers can be registered by the consumer.

**Acceptance**: Test — feed 10 observations about a user's theme preference over time; verify the temporal specialist identifies the trend, the induciton specialist identifies the pattern, and merge produces a single consolidated insight with `finalConfidence > 0.7`.

#### 6.4 Solidification & knowledge update (inspired by Evolver validation + gene scoring)

**File**: `src/cognitive/learning/solidifier.ts`

Evolver's solidification step validates and promotes genes from candidate to active state. Our solidifier validates consolidation results and promotes high-confidence knowledge to the Long-Term Memory tier and/or the knowledge graph.

```typescript
export interface SolidificationCandidate {
  consolidation: MergedConsolidation;
  currentImportance: number;
  accessCount: number;
  ageMs: number;
  existingInLTM: boolean;
}

export interface SolidificationResult {
  id: string;
  candidateId: string;
  action: 'promote' | 'demote' | 'merge' | 'archive';
  targetTier: TierName;
  confidence: number;
  reason: string;
}

export interface Solidifier {
  evaluate(candidate: SolidificationCandidate): Promise<SolidificationResult>;
  apply(result: SolidificationResult): Promise<void>;
  evaluateBatch(candidates: SolidificationCandidate[]): Promise<SolidificationResult[]>;
}
```

Solidification rules (configurable):

- `promote` when `consolidation.finalConfidence >= promotionThreshold` and `!existingInLTM`
- `merge` when `existingInLTM` and the new consolidation is compatible with existing LTM entry (semantic similarity > mergeThreshold)
- `demote` when `consolidation.finalConfidence < demotionThreshold` and `ageMs > minAgeForDemotion`
- `archive` when `accessCount < archiveAccessThreshold` and `ageMs > maxAgeBeforeArchive`

Each solidification result is recorded in the audit trail (reusing existing `AuditTrail` from `filesystem/agentfs/`).

**Acceptance**: Test — create a consolidation result with high confidence; verify solidifier returns `promote` action targeting `long_term_memory`; apply it and verify the memory item appears in LTM with updated importance.

#### 6.5 Canary degradation detection (inspired by Evolver canary system)

**File**: `src/cognitive/learning/canary-detector.ts`

Evolver's canary system detects when consolidated knowledge begins to degrade (no longer relevant, contradicted by new data). We implement this as a `CanaryDetector` that monitors consolidated memories for staleness and contradiction.

```typescript
export interface CanaryCheck {
  memoryId: string;
  lastAccessedAge: number; // time since last access in ms
  recentContradictionCount: number;
  importanceDecay: number; // how much importance has dropped since last check
  accessFrequencyTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface CanaryResult {
  memoryId: string;
  status: 'healthy' | 'stale' | 'degraded' | 'contradicted';
  action: 'keep' | 'refresh' | 'demote' | 'archive' | 'flag_for_review';
  reason: string;
  nextCheckMs: number; // when to check again
}

export interface CanaryDetector {
  check(memory: MemoryItem, recentObservations: Observation[]): Promise<CanaryResult>;
  checkBatch(memories: MemoryItem[], recentObservations: Observation[]): Promise<CanaryResult[]>;
}
```

Status determination:

- `healthy`: recently accessed, no contradictions, stable or increasing frequency
- `stale`: not accessed in > staleThreshold (configurable, default: 7 days), no contradictions
- `degraded`: importance has dropped below degradation threshold, frequency is decreasing
- `contradicted`: recent observations directly contradict this memory (detected by dialectic resolver)

Action mapping:

- `healthy` → `keep`
- `stale` → `refresh` (re-validate via consolidation specialist)
- `degraded` → `demote` (move to lower tier)
- `contradicted` → `flag_for_review` (feed into dialectic resolver)

**Acceptance**: Test — create a memory item with high importance that hasn't been accessed in 30 days; verify canary returns `stale` status with `refresh` action.

#### 6.6 Learning loop orchestrator

**File**: `src/cognitive/learning/loop-orchestrator.ts`

The orchestrator ties together the full learning cycle: observation → dialectic → consolidation → solidification → canary monitoring.

```typescript
export interface LearningLoopConfig {
  observation: {
    extractors: ObservationKind[]; // which kinds to run
    batchSize: number; // observations per cycle, default: 50
  };
  dialectic: {
    priorityRules: ResolutionPriority;
  };
  consolidation: {
    specialists: SpecialistRole[];
    maxTokenBudgetPerCycle: number; // default: 2000
  };
  solidification: {
    promotionThreshold: number; // default: 0.75
    demotionThreshold: number; // default: 0.3
    mergeSimilarityThreshold: number; // default: 0.85
    archiveAccessThreshold: number; // default: 2
    maxAgeBeforeArchive: number; // ms, default: 30 days
  };
  canary: {
    staleThreshold: number; // ms, default: 7 days
    degradationThreshold: number; // default: 0.4
    checkInterval: number; // ms, default: 1 hour
  };
}

export interface LearningCycleResult {
  observationsExtracted: number;
  contradictionsFound: number;
  resolutionsProduced: number;
  consolidationsProduced: number;
  solidificationActions: SolidificationResult[];
  canaryActions: CanaryResult[];
  durationMs: number;
}

export interface LearningLoopOrchestrator {
  runCycle(engine: MemoryEngine, config?: Partial<LearningLoopConfig>): Promise<LearningCycleResult>;
}
```

The `runCycle` method executes:

1. **Observe** — extract observations from new memories since last cycle
2. **Dialectic** — detect and resolve contradictions among observations
3. **Consolidate** — run specialists on resolved observations, merge results
4. **Solidify** — evaluate consolidation results, promote/demote/merge/archive
5. **Canary** — check existing LTM memories for degradation

Each step emits events via the existing `PubSubManager` for observability.

**Acceptance**: Integration test — feed 100 memory items into a fresh `MemoryEngine`, run a full learning cycle, verify that observations are extracted, contradictions resolved, consolidations produced, and at least one item is promoted to LTM.

#### 6.7 Integration with `MemoryEngine.awaken()`

**File**: `src/cognitive/awaken.ts` (extends existing)

The `awaken()` method (from Phase 4) is extended to optionally trigger a learning cycle:

```typescript
export interface AwakenOptions {
  // ... existing options ...
  runLearningCycle?: boolean; // default: false in Phase 4, true in Phase 6
  learningConfig?: Partial<LearningLoopConfig>;
}
```

When `runLearningCycle` is true, `awaken()` calls `LearningLoopOrchestrator.runCycle()` after the existing consolidation and decay passes. This keeps learning opt-in during Phase 4 (not all memory engines need it) and on-by-default in Phase 6+.

**Acceptance**: Existing awaken tests pass with `runLearningCycle: false` (no behavior change). New test with `runLearningCycle: true` produces a `LearningCycleResult`.

---

## Learning Loop: Phase Mapping from Source Frameworks

| Mechanism                              | Source  | Maps To                                                               | Phase       |
| -------------------------------------- | ------- | --------------------------------------------------------------------- | ----------- |
| Deriver (observation extraction)       | Honcho  | `ObservationExtractor` with multi-strategy extraction                 | 6.1         |
| Dialectic contradiction resolution     | Honcho  | `DialecticResolver` with 4 representation views                       | 6.2         |
| Dreamer multi-specialist consolidation | Honcho  | `ConsolidationSpecialist` with deduction/induction/surprisal/temporal | 6.3         |
| Reflection/doubling                    | Hermes  | `onResponse` hook captures agent output for observation               | 7.2.4 + 6.1 |
| GEP signal extraction                  | Evolver | `ObservationKind` enum (factual/emotional/procedural/corrective)      | 6.1         |
| Gene scoring & selection               | Evolver | `Solidifier.evaluate()` with confidence/importance thresholds         | 6.4         |
| Validation & solidification            | Evolver | `Solidifier.apply()` promoting to LTM/knowledge graph                 | 6.4         |
| Canary degradation detection           | Evolver | `CanaryDetector` monitoring LTM for staleness/contradiction           | 6.5         |
| Narrative memory                       | Evolver | Consolidated summaries stored as `episodic` memories                  | 6.3         |
| Evolvable personality state            | Evolver | `PersonaStore` (Phase 5) updated by learning cycle                    | 5 + 6       |

---

## Updated File Structure Summary

```text
src/
├── cognitive/                    # Phase 1-4
│   ├── tier-types.ts
│   ├── memory-tier.ts
│   ├── sensory-buffer.ts
│   ├── sensory-register.ts
│   ├── working-memory.ts
│   ├── short-term-memory.ts
│   ├── long-term-memory.ts
│   ├── tier-bridge.ts
│   ├── compressor.ts
│   ├── synthesizer.ts
│   ├── summarizer.ts
│   ├── importance.ts
│   ├── decay.ts
│   ├── tier-scheduler.ts
│   ├── token-budget.ts
│   ├── awaken.ts
│   ├── memory-engine.ts
│   ├── persona/
│   │   └── persona-store.ts
│   ├── knowledge/
│   │   └── graph-builder.ts
│   ├── learning/                  # Phase 6
│   │   ├── observation-extractor.ts
│   │   ├── dialectic-resolver.ts
│   │   ├── consolidation-specialist.ts
│   │   ├── solidifier.ts
│   │   ├── canary-detector.ts
│   │   ├── loop-orchestrator.ts
│   │   └── index.ts
│   ├── testing.ts
│   └── index.ts
├── hooks/                        # Phase 7.2
│   ├── on-session-start.ts
│   ├── on-session-end.ts
│   ├── on-tool-call.ts
│   ├── on-response.ts
│   └── index.ts
├── mcp/                          # Phase 7.3
│   ├── tools.ts                  # MCP tool wrappers
│   ├── server.ts                 # MCP server (stdio + HTTP)
│   ├── daemon.ts                 # Daemon process management
│   └── index.ts
├── config.ts                     # Phase 7.4.1
├── init.ts                       # Phase 7.4 (programmatic)
├── (existing modules unchanged)
skill/
├── SKILL.md                      # Phase 7.1
scripts/
├── init.ts                       # CLI entrypoint for init
├── mcp-server.ts                 # CLI entrypoint for MCP server
```

### Updated package.json additions

```jsonc
{
  // ... existing config ...
  "bin": {
    "agentsy-memory": "./dist/scripts/init.js",
    "agentsy-memory-mcp": "./dist/scripts/mcp-server.js"
  },
  "exports": {
    // ... existing exports ...
    "./cognitive": {
      "types": "./dist/cognitive/index.d.ts",
      "import": "./dist/cognitive/index.js",
      "require": "./dist/cognitive/index.js.cjs"
    },
    "./learning": {
      "types": "./dist/cognitive/learning/index.d.ts",
      "import": "./dist/cognitive/learning/index.js",
      "require": "./dist/cognitive/learning/index.js.cjs"
    },
    "./hooks": {
      "types": "./dist/hooks/index.d.ts",
      "import": "./dist/hooks/index.js",
      "require": "./dist/hooks/index.js.cjs"
    },
    "./mcp": {
      "types": "./dist/mcp/index.d.ts",
      "import": "./dist/mcp/index.js",
      "require": "./dist/mcp/index.js.cjs"
    },
    "./config": { "types": "./dist/config.d.ts", "import": "./dist/config.js", "require": "./dist/config.js.cjs" },
    "./init": { "types": "./dist/init.d.ts", "import": "./dist/init.js", "require": "./dist/init.js.cjs" }
  },
  "dependencies": {
    // ... existing ...
    "@modelcontextprotocol/sdk": "^1.12.0" // MCP server SDK
  }
}
```

### Updated tsup.config.ts additions

```typescript
entry: {
  // ... existing index entry ...
  cognitive: 'src/cognitive/index.ts',
  learning: 'src/cognitive/learning/index.ts',
  hooks: 'src/hooks/index.ts',
  mcp: 'src/mcp/index.ts',
  config: 'src/config.ts',
  init: 'src/init.ts',
  'scripts/init': 'scripts/init.ts',
  'scripts/mcp-server': 'scripts/mcp-server.ts'
}
```

---

## Dependency Map (Updated)

```text
cognitive/*           ←── cognitive/tier-types, content-addressing/fingerprint, wiki/content-processor, wiki/entity-extractor, wiki/local-embedding-engine, coordination/scheduler, coordination/pub-sub-manager, scope/scope-manager
cognitive/learning/*  ←── cognitive/tier-types, cognitive/memory-engine, cognitive/importance, cognitive/decay, cognitive/tier-bridge, wiki/entity-extractor, retrieval/retriever, content-addressing/fingerprint
hooks/*               ←── cognitive/memory-engine, cognitive/tier-types, cognitive/learning/loop-orchestrator
mcp/tools             ←── tools/*, cognitive/memory-engine, cognitive/tier-types, retrieval/injection, retrieval/retriever
mcp/server            ←── mcp/tools, mcp/daemon, sync/turso-manager, config
mcp/daemon            ←── mcp/server, config
config                ←── cognitive/tier-types, sync/turso-manager
init                  ←── config, mcp/server, fs operations for skill/hooks installation
skill/SKILL.md        ←── (static file, no code dependencies)
```

---

## CLI Integration (Phase 7.3.4)

The `@agentsy/cli` package adds these commands:

```bash
agentsy memory daemon start [--port 4231] [--sync-url URL] [--sync-auth-token TOKEN]
agentsy memory daemon stop
agentsy memory daemon status
agentsy memory daemon restart
agentsy memory init                 # delegates to @agentsy/memory init
```

All logic lives in `@agentsy/memory`. CLI only provides argument parsing and `child_process.spawn()`.

---

## Implementation Order for Phase 7

| Step  | File                            | Depends On                                    | Estimated Lines |
| ----- | ------------------------------- | --------------------------------------------- | --------------- |
| 7.1   | `skill/SKILL.md`                | Phase 1-6 design (can draft earlier)          | ~250            |
| 7.2.1 | `src/hooks/on-session-start.ts` | `cognitive/memory-engine`, `cognitive/awaken` | ~60             |
| 7.2.2 | `src/hooks/on-session-end.ts`   | `cognitive/memory-engine`                     | ~40             |
| 7.2.3 | `src/hooks/on-tool-call.ts`     | `cognitive/memory-engine`                     | ~50             |
| 7.2.4 | `src/hooks/on-response.ts`      | `cognitive/memory-engine`                     | ~40             |
| 7.2   | `src/hooks/index.ts`            | all hooks                                     | ~15             |
| 7.3.1 | `src/mcp/tools.ts`              | existing `tools/*`, `cognitive/tier-types`    | ~200            |
| 7.3.2 | `src/mcp/server.ts`             | `mcp/tools`, `config`, `sync/turso-manager`   | ~150            |
| 7.3.3 | `src/mcp/daemon.ts`             | `mcp/server`                                  | ~120            |
| 7.3   | `src/mcp/index.ts`              | server, daemon, tools                         | ~10             |
| 7.4.1 | `src/config.ts`                 | `cognitive/tier-types`, `sync/turso-manager`  | ~100            |
| 7.4   | `src/init.ts`                   | `config`, `mcp/server`                        | ~180            |
| 7.4   | `scripts/init.ts`               | `init.ts` exports                             | ~30             |
| 7.4   | `scripts/mcp-server.ts`         | `mcp/server` exports                          | ~20             |
| 7.3.4 | CLI commands in `@agentsy/cli`  | `@agentsy/memory` exports                     | ~80             |

**Phase 7 total**: ~1,335 lines (implementation) + ~250 lines (skill doc) ≈ **1,585 lines**

---

## Implementation Order for Phase 6

| Step | File                                                 | Depends On                                                                                                       | Estimated Lines |
| ---- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------- |
| 6.1  | `src/cognitive/learning/observation-extractor.ts`    | `cognitive/tier-types`, `content-addressing/fingerprint`                                                         | ~180            |
| 6.2  | `src/cognitive/learning/dialectic-resolver.ts`       | `cognitive/tier-types`, `cognitive/learning/observation-extractor`                                               | ~220            |
| 6.3  | `src/cognitive/learning/consolidation-specialist.ts` | `cognitive/tier-types`, `cognitive/learning/observation-extractor`, `cognitive/learning/dialectic-resolver`      | ~250            |
| 6.4  | `src/cognitive/learning/solidifier.ts`               | `cognitive/tier-types`, `cognitive/learning/consolidation-specialist`, `cognitive/decay`, `cognitive/importance` | ~150            |
| 6.5  | `src/cognitive/learning/canary-detector.ts`          | `cognitive/tier-types`, `cognitive/importance`, `cognitive/learning/dialectic-resolver`                          | ~120            |
| 6.6  | `src/cognitive/learning/loop-orchestrator.ts`        | all Phase 6 modules, `cognitive/memory-engine`, `cognitive/awaken`, `coordination/pub-sub-manager`               | ~200            |
| 6.7  | `src/cognitive/awaken.ts` (extends)                  | `cognitive/learning/loop-orchestrator`                                                                           | ~30             |
| 6.x  | `src/cognitive/learning/index.ts`                    | all Phase 6 modules                                                                                              | ~10             |

**Phase 6 total**: ~1,160 lines

---

## Updated Success Metrics

| Metric                   | Target                                                                   | Measurement                                                                         |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Standalone install       | Single `npx @agentsy/memory init` sets up everything                     | Fresh project → init → `memory_ingest` works                                        |
| MCP compatibility        | Works with Claude Code, Cursor, OpenCode, any MCP client                 | MCP Inspector validates tool schemas                                                |
| CLI independence         | Memory daemon runs without `@agentsy/cli` installed                      | `agentsy-memory-mcp` starts standalone                                              |
| Skill discoverability    | Agent reads skill and knows how to use memory                            | Skill triggers on "remember", "recall", "forget"                                    |
| Hook integration         | Session start/end auto-triggers consolidation                            | Agent session → hooks fire → stats change                                           |
| Learning cycle           | Observation → dialectic → consolidation → solidification runs end-to-end | Feed 100 items → full cycle produces at least 1 LTM promotion                       |
| Contradiction resolution | Dialectic resolves conflicting observations                              | "user likes dark" vs "user prefers light" → resolution with correct source priority |
| Canary detection         | Stale memories are identified and flagged                                | 30-day unused memory → canary returns `stale` status                                |
| Specialist consolidation | Multiple specialists produce merged insights                             | 10 observations → deduction + induction + temporal → merged consolidation           |

---

## Updated Risks & Mitigations (Full)

| Risk                               | Mitigation                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | ---------- |
| Embedding engine unavailable       | Synthesizer falls back to `EntityExtractor` keyword matching; `LocalEmbeddingEngine` already exists in wiki                                                               |
| LTM unbounded growth               | `importance` threshold + `accessCount` heuristics archive cold items; TTL-based cleanup in `awaken()`                                                                     |
| Bridge transforms too lossy        | Each bridge starts with identity transform; compress/synthesize/summarize are additive (Phase 2)                                                                          |
| Tier promotion thrashing           | Hysteresis: must exceed `consolidationThreshold` to promote; must drop below `minimumImportance` to demote                                                                |
| Budget starvation                  | `reclaim()` automatically frees tokens from lowest-importance items when a tier hits quota                                                                                |
| MCP clients config format varies   | Init script detects client type (OpenCode/Claude/Cursor) and writes correct format; fallback writes generic `mcp.json`                                                    |
| Daemon port conflicts              | Default port 4231 (unlikely collision); configurable via `--port` or `AGENTSY_MEMORY_PORT`                                                                                |
| Skill directory location varies    | Init script checks common locations (`~/.agents/skills/`, `.agents/skills/`, project-local) and uses first writable path                                                  |
| Learning loop too aggressive       | `runLearningCycle` defaults to `false` in Phase 4, `true` in Phase 6 — gradual opt-in; `learningConfig` allows disabling individual specialists                           |
| Contradiction resolution incorrect | Dialectic resolver uses configurable `ResolutionPriority` with source weights and recency bias; low-confidence resolutions flagged for review, not auto-applied           |
| Specialist consolidation too noisy | `maxTokenBudgetPerCycle` caps consolidation cost; merge step deduplicates and weights by confidence; low-confidence results are kept but not promoted                     |
| Canary false positives             | `staleThreshold` and `degradationThreshold` are configurable; `refresh` action (not `archive`) is the default for stale memories, giving them a chance to prove relevance |
| @agentsy/cli not installed         | Daemon and MCP server are fully independent; CLI is optional convenience wrapper                                                                                          |
|                                    |                                                                                                                                                                           |     |     |     |     | Stash base |

=======

# @agentsy/memory — Implementation Plan v2

> Supersedes `UPDATED-IMPLEMENTATION-PLAN.md`. Accounts for the ~5,500 lines of implementation code that now exist and focuses only on remaining gaps.

---

## Current Implementation Inventory

| Module                   | Lines      | Key Exports                                                                                                                                                                                                        | Status                          |
| ------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `types.ts`               | 50         | `ContextFingerprint`, `MemoryReuseHint`                                                                                                                                                                            | Done                            |
| `reuse.ts`               | 49         | `rankReusableMemoryBlocks`, `ReusableMemoryBlock`                                                                                                                                                                  | Done                            |
| `coordination/`          | 335        | `AtomicWorkflowCoordinator`, `Scheduler`, `TaskQueue`, `PubSubManager`, `HonkerLoader`                                                                                                                             | Done                            |
| `content-addressing/`    | 163        | `blake3` fingerprint, `DedupStore`, `migrate`, `verify`                                                                                                                                                            | Done                            |
| `filesystem/agentfs/`    | 427        | `AgentFsManager`, `KVStore`, `Snapshots`, `AuditTrail`                                                                                                                                                             | Done                            |
| `observability/`         | 116        | `MemoryMetrics`, `redactSecretLikeValues`                                                                                                                                                                          | Done                            |
| `retrieval/injection.ts` | 132        | `injectMemoryContext`, `formatMemoryContextXml`                                                                                                                                                                    | Done                            |
| `retrieval/retriever.ts` | 175        | `MemoryRetriever`, top-K search                                                                                                                                                                                    | Done                            |
| `retrieval/rag/`         | 723        | `HybridRetriever`, `QueryPlanner`, `RAGBootstrapper`, `KnowledgeBaseManager`, `IndexManager`, `DocumentIngestor`, `ReindexScheduler`, `ContextPacker`, `Reranker`, `Sanitizer`, `ServerClient`, `SourceConnectors` | Done                            |
| `scope/`                 | 91         | `ScopeManager`, `MemoryScope` (5 levels)                                                                                                                                                                           | Done                            |
| `sync/`                  | ~1200      | `TursoClient`, `TursoManager`, `MemoryStateAdapter`, `ConflictResolution`, `BackupManager`, `SyncScheduler`, `Security`, `Integrity`, `Metrics`                                                                    | Done                            |
| `tools/`                 | 275        | `capture`, `search`, `list`, `stats`, `lint`                                                                                                                                                                       | Done                            |
| `wiki/`                  | 778        | `WikiManager`, `EntityExtractor`, `ContentProcessor`, `NavigationSystem`, `VersionTracker`, `LocalEmbeddingEngine`                                                                                                 | Done                            |
| **Total**                | **~5,491** |                                                                                                                                                                                                                    | **All phase-1/2 modules exist** |

---

## Gap Analysis — What's Missing

The five gaps mapped against the architecture document:

| #   | Gap                                                                                                                                                                     | Architecture Reference                      | Existing Code Overlap                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **Cognitive tier lifecycle engine** — no `MemoryTier` base, no `SensoryBuffer`/`SensoryRegister`/`WorkingMemory`/`ShortTermMemory`/`LongTermMemory` classes, no bridges | Architecture §1–5                           | `MemoryScope` (5 levels in scope-manager) is the tier enum but has no lifecycle; `reuse.ts` has hot/warm/cold classification but no promotion |
| G2  | **Processing pipeline** — no Compressor, Synthesizer, or Summarizer classes connecting tiers                                                                            | Architecture §6 (Bridges & Processing)      | `ContentProcessor` (wiki) and `EntityExtractor` (wiki) can be reused as components but not wired as tier-bridges                              |
| G3  | **Confidence scoring & decay** — no per-memory importance score, no time-decay, no auto-promotion/demotion                                                              | Strategy Synthesis §4 (agentmemory pattern) | `rankReusableMemoryBlocks` sorts by reuse class but doesn't track decay                                                                       |
| G4  | **Token budget enforcement** — no per-tier quota tracking, no budget negotiation with honker                                                                            | Architecture §7 (Token Budgets)             | `injectMemoryContext` formats XML but doesn't enforce budget caps; `ContextPacker` packs evidence but doesn't track tier quotas               |
| G5  | **Top-level engine & MCP surface** — no `MemoryEngine` orchestrator, no `awaken()`, no MCP server                                                                       | Architecture §8 (Integration)               | `HonkerLoader` loads coordination extensions but nothing wires the tiers together                                                             |

---

## Implementation Phases

### Phase 1: Cognitive Tier Engine (G1)

**Goal**: Implement the 5-tier lifecycle as composable, testable modules.

#### 1.1 Core types and tier interface

**File**: `src/cognitive/tier-types.ts`

```typescript
export type TierLevel = 1 | 2 | 3 | 4 | 5;
export type TierName =
  | 'sensory_buffer'
  | 'sensory_register'
  | 'working_memory'
  | 'short_term_memory'
  | 'long_term_memory';
export type WriteHeap = 'event' | 'query' | 'doc' | 'ref';
export type MemoryKind = 'semantic' | 'episodic' | 'procedural' | 'sensory';
export type ReuseClass = 'hot' | 'warm' | 'cold';

export interface TierConfig {
  level: TierLevel;
  name: TierName;
  maxTokens: number;
  maxItems: number;
  ttlMs: number; // time-to-live in ms (Infinity for LTM)
  consolidationThreshold: number; // 0-1, triggers promotion
  compressionTarget: number; // target reduction percentage
}

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  content: string;
  tokenCount: number;
  importance: number; // 0-1 confidence score
  writeHeap: WriteHeap;
  reuseClass: ReuseClass;
  createdAt: number; // performance.now()
  lastAccessedAt: number;
  accessCount: number;
  fingerprint: string; // blake3 from content-addressing
  metadata: Record<string, unknown>;
}

export interface TierReadResult<T = MemoryItem> {
  items: T[];
  tierName: TierName;
  tokenCount: number;
  overflowed: boolean;
}
```

**Acceptance**: Types compile without errors, exported from `src/cognitive/index.ts`.

#### 1.2 MemoryTier base class

**File**: `src/cognitive/memory-tier.ts`

```typescript
export interface MemoryTierLike {
  readonly name: TierName;
  readonly level: TierLevel;
  readonly config: TierConfig;
  write(item: MemoryItem): MemoryItem | null; // null if rejected
  read(query: TierReadQuery): TierReadResult;
  capacity(): { usedTokens: number; maxTokens: number; usedItems: number; maxItems: number };
  evict(count: number): MemoryItem[]; // FIFO eviction
  promote(count: number, to: MemoryTierLike): number; // returns items promoted
  demote(count: number, from: MemoryTierLike): number;
  clear(): void;
  items(): readonly MemoryItem[];
}
```

- In-memory `Map<string, MemoryItem>` store (pluggable later)
- Eviction: FIFO by default, respects importance threshold
- Promotion: sorts by `importance * recencyWeight(accessCount, age)` and moves top-N
- Demotion: moves bottom-N items to lower tier

**Acceptance**: Unit tests for write/read/evict/promote/demote on a generic `MemoryTier`.

#### 1.3 Five concrete tier implementations

**Files**: `src/cognitive/sensory-buffer.ts`, `sensory-register.ts`, `working-memory.ts`, `short-term-memory.ts`, `long-term-memory.ts`

Each extends `MemoryTier` with tier-specific defaults:

| Tier            | maxTokens | maxItems | ttlMs     | consolidationThreshold |
| --------------- | --------- | -------- | --------- | ---------------------- |
| SensoryBuffer   | 200       | 50       | 5_000     | 0.6                    |
| SensoryRegister | 400       | 4        | 2_000     | 0.5                    |
| WorkingMemory   | 1_000     | 7        | 30_000    | 0.4                    |
| ShortTermMemory | 2_000     | 12       | 3_600_000 | 0.3                    |
| LongTermMemory  | ∞         | ∞        | ∞         | 0.0                    |

**Acceptance**: Each tier instantiates with correct defaults; overflow behavior tested; TTL expiration tested (fast-clock pattern with injectable `now()`).

#### 1.4 Tier bridges

**File**: `src/cognitive/tier-bridge.ts`

```typescript
export interface TierBridge {
  from: TierName;
  to: TierName;
  transfer(items: MemoryItem[], reason: 'consolidation' | 'eviction' | 'manual'): number;
  canTransfer(): boolean;
}
```

Four bridges: 1→2, 2→3, 3→4, 4→5. Each bridge:

- Applies a **transform** (compress/synthesize/summarize — initially identity, Phase 2 adds transforms)
- Updates `lastAccessedAt` and `accessCount`
- Returns count of items actually transferred

**Acceptance**: Bridge integration test — insert 10 items into SensoryBuffer, trigger promotion, verify items appear in SensoryRegister.

#### 1.5 Tier-aware test infrastructure

- `src/cognitive/testing.ts` — `createTierTestClock()` returning injectable `now()` for deterministic TTL tests
- `src/cognitive/test-utils.ts` — `createTestMemoryItem()` factory with sensible defaults

**Acceptance**: Tests use injectable clock; no `setTimeout`/`Date.now()` in tier logic.

---

### Phase 2: Processing Pipeline (G2)

**Goal**: Wire Compressor, Synthesizer, and Summarizer into the tier bridges.

#### 2.1 Compressor (raw → working chunks)

**File**: `src/cognitive/compressor.ts`

Reuses `ContentProcessor` from wiki for chunking logic. Responsibilities:

- Split raw events into chunks (respecting `maxTokens` per chunk)
- Assign initial importance score based on: recency, content-type weight, source heuristics
- Compute blake3 fingerprint via existing `content-addressing/fingerprint.ts`

```typescript
export interface Compressor {
  compress(items: MemoryItem[], budget: number): CompressResult;
}

export interface CompressResult {
  chunks: MemoryItem[];
  discarded: MemoryItem[];
  tokenReduction: number; // percentage
}
```

**Acceptance**: Compressor reduces 500-token input to ≤200 tokens; discarded items tracked; fingerprint computed.

#### 2.2 Synthesizer (working → short-term)

**File**: `src/cognitive/synthesizer.ts`

Reuses `EntityExtractor` from wiki for relationship extraction. Responsibilities:

- Merge related chunks using semantic similarity (delegating to `LocalEmbeddingEngine`)
- Produce synthesized memory with higher importance score
- Preserve source references in `metadata.sourceIds`

```typescript
export interface Synthesizer {
  synthesize(items: MemoryItem[], budget: number): SynthesizeResult;
}

export interface SynthesizeResult {
  synthesized: MemoryItem[];
  sources: string[]; // source item IDs merged
  discarded: MemoryItem[];
  tokenReduction: number;
}
```

**Acceptance**: 5 related working-memory items synthesize into 1-2 short-term items with `metadata.sourceIds` referencing originals.

#### 2.3 Summarizer (short-term → long-term)

**File**: `src/cognitive/summarizer.ts`

Responsibilities:

- Apply LLM-based or rule-based summarization (defaults to rule-based, LLM pluggable)
- Generate `MetaAction` entries (patterns observed across memories)
- Write to appropriate write-heaps (event/query/doc/ref)

```typescript
export interface Summarizer {
  summarize(items: MemoryItem[], budget: number): SummarizeResult;
}

export interface SummarizeResult {
  longTermItems: MemoryItem[];
  metaActions: MetaAction[];
  discarded: MemoryItem[];
  tokenReduction: number;
}

export interface MetaAction {
  id: string;
  pattern: string;
  frequency: number;
  lastObserved: number;
  sourceIds: string[];
}
```

**Acceptance**: 10 short-term items summarize to 2-3 long-term items; at least one `MetaAction` extracted if pattern present.

#### 2.4 Wire bridges to pipeline

Update `TierBridge.transfer()` to use:

- Bridge 1→2: identity transform (passthrough)
- Bridge 2→3: `Compressor.compress()`
- Bridge 3→4: `Synthesizer.synthesize()`
- Bridge 4→5: `Summarizer.summarize()`

**Acceptance**: Full-pipeline integration test — insert event → SensoryBuffer → flows through all tiers → produces long-term item.

---

### Phase 3: Confidence Scoring & Decay (G3)

**Goal**: Add per-memory importance tracking with time-based decay and auto-promotion/demotion.

#### 3.1 Importance scoring

**File**: `src/cognitive/importance.ts`

```typescript
export function computeImportance(item: MemoryItem, factors: ImportanceFactors): number;

export interface ImportanceFactors {
  recencyWeight: number; // default: 0.3
  frequencyWeight: number; // default: 0.2
  sourceReliability: number; // 0-1, heuristic per source
  contentTypeWeight: number; // actions=0.8, observations=0.5, etc.
  relationalBoost: number; // boost for items referenced by other items
}
```

Applies weighted sum, clamped to [0, 1].

#### 3.2 Time-decay engine

**File**: `src/cognitive/decay.ts`

```typescript
export function applyDecay(items: MemoryItem[], now: number, config: DecayConfig): DecayedItem[];

export interface DecayConfig {
  sensoryBufferHalfLife: number; // ms, default: 2_500
  sensoryRegisterHalfLife: number; // ms, default: 1_000
  workingMemoryHalfLife: number; // ms, default: 15_000
  shortTermHalfLife: number; // ms, default: 1_800_000 (30 min)
  longTermHalfLife: number; // ms, default: Infinity (no decay)
  minimumImportance: number; // delete below this, default: 0.05
}

export interface DecayedItem {
  item: MemoryItem;
  newImportance: number;
  tier: TierName;
  action: 'keep' | 'promote' | 'demote' | 'discard';
}
```

Uses exponential decay: `importance * Math.pow(0.5, age / halfLife)`

**Acceptance**: Items older than halfLife have halved importance; items below `minimumImportance` get action `'discard'`.

#### 3.3 Auto-promotion/demotion scheduler

**File**: `src/cognitive/tier-scheduler.ts`

Integrates with existing `createInMemoryScheduler()` from coordination:

- Runs decay pass every N seconds (configurable, default 30s)
- Triggers bridge promotion for items exceeding `consolidationThreshold`
- Triggers bridge demotion for items falling below minimum importance
- Emits events via existing `PubSubManager`

**Acceptance**: Scheduler runs decay pass, promotes a high-importance item from working → short-term, and demotes a low-importance item back to sensory register.

---

### Phase 4: MemoryEngine Orchestrator & Token Budget (G4, G5)

**Goal**: Top-level `MemoryEngine` that wires everything together, enforces budgets, provides `awaken()`, and exposes the MCP surface.

#### 4.1 TokenBudget tracker

**File**: `src/cognitive/token-budget.ts`

```typescript
export interface TokenBudget {
  readonly config: BudgetConfig;
  available(name: TierName): number;
  allocated(name: TierName): number;
  allocate(name: TierName, tokens: number): boolean; // false if over budget
  release(name: TierName, tokens: number): void;
  reclaim(name: TierName): number; // reclaim up to reclamationThreshold, return bytes freed
}

export interface BudgetConfig {
  tierQuotas: Record<TierName, number>;
  reclamationThresholds: Record<TierName, number>;
  outputReductionTarget: number; // 0.75
  memoryReductionTarget: number; // 0.46
}
```

Reuses `ScopeManager` for RBAC validation of budget changes.

**Acceptance**: Budget enforcement prevents over-allocation; `reclaim()` returns freed tokens.

#### 4.2 awaken()

**File**: `src/cognitive/awaken.ts`

```typescript
export async function awaken(engine: MemoryEngine, context: AwakenContext): Promise<AwakenResult>;

export interface AwakenContext {
  now: number;
  idleTimeMs: number;
  pendingEvents: MemoryItem[];
}

export interface AwakenResult {
  consolidated: number; // items consolidated
  decayed: number; // items decay-processed
  promoted: number; // items promoted
  demoted: number; // items demoted
  discarded: number; // items discarded
  budgetReclaimed: number; // tokens reclaimed
  durationMs: number;
}
```

Logic:

1. Process `idleTimeMs` — run decay for items that aged during idle
2. Run scheduled consolidations (bridge promotions for items above threshold)
3. Ingest any `pendingEvents` into SensoryBuffer
4. Reclaim budget from low-importance items
5. Return summary

**Acceptance**: `awaken()` with `idleTimeMs=60_000` triggers decay and promotion; returns counts matching expected behavior.

#### 4.3 MemoryEngine orchestrator

**File**: `src/cognitive/memory-engine.ts`

```typescript
export interface MemoryEngine {
  readonly tiers: Record<TierName, MemoryTierLike>;
  readonly bridges: TierBridge[];
  readonly budget: TokenBudget;
  readonly scheduler: TierScheduler;

  ingest(event: MemoryItem): IngestResult;
  recall(query: RecalQuery): RecallResult;
  awaken(context: AwakenContext): Promise<AwakenResult>;
  snapshot(): EngineSnapshot;
  reset(): void;
}

export interface IngestResult {
  tier: TierName;
  itemId: string;
  promoted: boolean;
  targetTier?: TierName;
}

export interface RecallQuery {
  query: string;
  scope?: MemoryScope;
  maxTokens?: number;
  minImportance?: number;
  tiers?: TierName[];
}

export interface RecallResult {
  items: MemoryItem[];
  totalTokens: number;
  budgetRemaining: number;
  fromTiers: TierName[];
}

export interface EngineSnapshot {
  tiers: Record<TierName, { itemCount: number; tokenCount: number }>;
  budget: Record<TierName, { allocated: number; max: number }>;
  timestamp: number;
}
```

`recall()` delegates to existing `MemoryRetriever` for semantic search, but also falls back to tier-scoped enumeration when no embedding engine is available.

**Acceptance**: Integration test — `ingest()` → item flows through tiers via `awaken()` → `recall()` returns relevant items within budget.

---

### Phase 5: Persona Memory & Knowledge Graph (Extension)

**Goal**: Per-user persona layers and auto-built knowledge graphs, inspired by memUBot and agentmemory.

#### 5.1 Persona memory

**File**: `src/cognitive/persona/persona-store.ts`

```typescript
export interface PersonaStore {
  get(userId: string): PersonaMemory;
  update(userId: string, patch: PersonaPatch): PersonaMemory;
  listAttributes(userId: string): PersonaAttribute[];
}

export interface PersonaMemory {
  userId: string;
  attributes: PersonaAttribute[];
  preferences: Record<string, unknown>;
  communicationStyle: CommunicationProfile;
  updatedAt: number;
}
```

Backed by existing `KVStore` from `filesystem/agentfs`.

#### 5.2 Knowledge graph auto-building

**File**: `src/cognitive/knowledge/graph-builder.ts`

Uses existing `EntityExtractor` + `EntityRelationship` types to build an adjacency-list graph:

- On each `ingest()`, extract entities and relations
- Merge into graph (dedup by `fingerprint`)
- Expose `queryGraph(entity)` for RAG context enrichment

```typescript
export interface KnowledgeGraph {
  addNode(node: GraphNode): void;
  addEdge(edge: GraphEdge): void;
  query(entity: string, depth?: number): Subgraph;
  merge(other: KnowledgeGraph): number; // returns merged count
}

export interface GraphNode {
  id: string;
  kind: EntityKind;
  label: string;
  importance: number;
  firstSeen: number;
  lastSeen: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
}
```

**Acceptance**: Ingesting "Alice met Bob at Conference X" produces nodes for Alice, Bob, Conference X with a `met_at` edge.

---

### Phase 6: MCP Server Surface (Integration)

**Goal**: Expose `MemoryEngine` as Model Context Protocol tools so any MCP client can use it.

#### 6.1 MCP tool definitions

**File**: `src/mcp/tools.ts` (new directory)

Tools to expose:

- `memory_ingest` — ingest an event
- `memory_recall` — recall memories matching a query
- `memory_awaken` — trigger consolidation/decay
- `memory_stats` — get tier utilization and budget info
- `memory_lint` — check memory health (already exists as tool)

Uses existing `tools/memory-*.ts` implementations internally.

#### 6.2 MCP server

**File**: `src/mcp/server.ts` (new)

Stdio-based MCP server using the `@modelcontextprotocol/sdk` package (already a dependency or add it).

**Acceptance**: MCP client can call `memory_ingest` → `memory_awaken` → `memory_recall` and get context-enriched results.

---

## File Structure Summary

```text
src/
├── cognitive/                    # NEW — Phase 1-4
│   ├── tier-types.ts             # TierLevel, TierName, TierConfig, MemoryItem, etc.
│   ├── memory-tier.ts            # MemoryTierLike interface + base implementation
│   ├── sensory-buffer.ts         # Tier 1
│   ├── sensory-register.ts       # Tier 2
│   ├── working-memory.ts         # Tier 3
│   ├── short-term-memory.ts      # Tier 4
│   ├── long-term-memory.ts       # Tier 5
│   ├── tier-bridge.ts            # Bridge interface + 4 implementations
│   ├── compressor.ts             # Phase 2: SensoryCompressor
│   ├── synthesizer.ts            # Phase 2: WorkingMemorySynthesizer
│   ├── summarizer.ts             # Phase 2: ShortTermSummarizer
│   ├── importance.ts             # Phase 3: importance scoring
│   ├── decay.ts                  # Phase 3: time-decay engine
│   ├── tier-scheduler.ts         # Phase 3: auto-promotion/demotion
│   ├── token-budget.ts           # Phase 4: budget enforcement
│   ├── awaken.ts                 # Phase 4: sleep-mode recovery
│   ├── memory-engine.ts          # Phase 4: top-level orchestrator
│   ├── persona/                  # Phase 5
│   │   └── persona-store.ts
│   ├── knowledge/                # Phase 5
│   │   └── graph-builder.ts
│   ├── testing.ts                # Test clock + factory helpers
│   └── index.ts                  # Barrel export
├── mcp/                          # NEW — Phase 6
│   ├── tools.ts
│   └── server.ts
├── (existing modules unchanged)
```

---

## Dependency Map

```text
cognitive/tier-types  ←── cognitive/memory-tier ←── cognitive/sensory-buffer, sensory-register, working-memory, short-term-memory, long-term-memory
cognitive/tier-bridge ←── cognitive/memory-tier
cognitive/compressor  ←── wiki/content-processor, content-addressing/fingerprint
cognitive/synthesizer ←── wiki/entity-extractor, wiki/local-embedding-engine, cognitive/tier-types
cognitive/summarizer  ←── cognitive/tier-types
cognitive/importance   ←── cognitive/tier-types
cognitive/decay        ←── cognitive/importance, cognitive/tier-types, cognitive/tier-scheduler
cognitive/tier-scheduler ←── coordination/scheduler, coordination/pub-sub-manager, cognitive/decay, cognitive/tier-bridge
cognitive/token-budget ←── cognitive/tier-types, scope/scope-manager
cognitive/awaken       ←── cognitive/memory-engine, cognitive/decay, cognitive/tier-scheduler, cognitive/token-budget
cognitive/memory-engine ←── all cognitive modules, retrieval/retriever, retrieval/injection
mcp/*                  ←── cognitive/memory-engine, tools/*
```

---

## Testing Standards

All new cognitive modules follow existing conventions:

- Vitest with `vi.fn()` spies
- Colocated `*.test.ts` files
- Deterministic time via injectable `now()` (no `Date.now()` or `setTimeout`)
- Chunk-by-chunk testing for streaming/processing paths
- Adversarial inputs (empty, malformed, oversized)
- Safety rails (token limits, depth limits)

Test target: ≥80% coverage per module, 100% coverage of promotion/demotion budget enforcement paths.

---

## Success Metrics

| Metric                 | Target                 | Measurement                                  |
| ---------------------- | ---------------------- | -------------------------------------------- |
| Output token reduction | 75%                    | `recall()` returns ≤25% of raw memory tokens |
| Memory token reduction | 46%                    | Tier storage uses ≤54% of raw input tokens   |
| Consolidation latency  | <200ms                 | `awaken()` time for 100 items                |
| Promotions per awaken  | ≥1 for saturated tiers | Items above threshold get promoted           |
| Budget enforcement     | 100%                   | No tier exceeds its quota                    |
| Test coverage          | ≥80%                   | `vitest --coverage`                          |

---

## Risks & Mitigations

| Risk                         | Mitigation                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Embedding engine unavailable | Synthesizer falls back to `EntityExtractor` keyword matching; `LocalEmbeddingEngine` already exists in wiki |
| LTM unbounded growth         | `importance` threshold + `accessCount` heuristics archive cold items; TTL-based cleanup in `awaken()`       |
| Bridge transforms too lossy  | Each bridge starts with identity transform; compress/synthesize/summarize are additive (Phase 2)            |
| Tier promotion thrashing     | Hysteresis: must exceed `consolidationThreshold` to promote; must drop below `minimumImportance` to demote  |
| Budget starvation            | `reclaim()` automatically frees tokens from lowest-importance items when a tier hits quota                  |

---

## Phase 7: Standalone Distribution (Skill, Hooks, Installer, Daemon)

The memory package must work independently — installed, configured, and running without the monorepo or the CLI package. This phase adds four deliverables that make `@agentsy/memory` a self-contained product.

### 7.1 Agent Skill — `memory` SKILL.md

**File**: `packages/memory/skill/SKILL.md`

A portable skill file that teaches any MCP-compatible agent how to use the memory system. Follows the skill frontmatter format already used in this repo (see `.agents/skills/`).

```yaml
---
name: memory
description: >
  Persistent cognitive memory for AI agents. Ingest events, recall context,
  manage tier lifecycle (awaken/sleep), enforce token budgets, and query
  knowledge graphs. Use when the agent needs to remember across sessions,
  reduce context window waste, or maintain per-user persona profiles.
---
```

The skill document covers:

1. **Quick start** — `npx @agentsy/memory init` + first ingest/recall
2. **Tier model** — 5-tier cognitive architecture at a glance
3. **Tool reference** — `memory_ingest`, `memory_recall`, `memory_awaken`, `memory_stats`, `memory_lint`, `memory_search`, `memory_list`, `memory_capture`
4. **Token budget strategy** — how to negotiate memory quota with the host agent
5. **Session lifecycle** — `awaken()` on boot, decay during idle, flush on shutdown
6. **Persona/memory scopes** — per-user isolation, shared project memory
7. **Error handling** — what happens when tiers overflow or budget exhausts
8. **CLI commands** — `memory-sync-dev`, `content-address-stats`, `daemon`

The skill is installed by the `init` script (7.4) into the agent's skill directory (e.g. `~/.agents/skills/` or project `.agents/skills/`).

### 7.2 Agent Hooks — Lifecycle Integration Scripts

**Directory**: `packages/memory/src/hooks/`

Four lifecycle hooks that integrate with agent runtimes:

#### 7.2.1 `hooks/on-session-start.ts`

```typescript
export interface OnSessionStartInput {
  engine: MemoryEngine;
  userId?: string;
  projectId?: string;
  pendingEvents?: MemoryItem[];
}

export interface OnSessionStartOutput {
  warmMemories: MemoryItem[]; // pre-loaded context for agent prompt
  tierCapacity: Record<TierName, { used: number; max: number }>;
  budgetAvailable: number;
}

export async function onSessionStart(input: OnSessionStartInput): Promise<OnSessionStartOutput>;
```

- Calls `awaken()` to process idle-time decay
- Loads hot memories for immediate injection
- Returns capacity/budget summary for the agent to plan context allocation

#### 7.2.2 `hooks/on-session-end.ts`

```typescript
export interface OnSessionEndInput {
  engine: MemoryEngine;
  sessionEvents: MemoryItem[];
  persist?: boolean; // default true
}

export interface OnSessionEndOutput {
  consolidated: number;
  persisted: number;
  durationMs: number;
}

export async function onSessionEnd(input: OnSessionEndInput): Promise<OnSessionEndOutput>;
```

- Ingests remainder of session events
- Runs final consolidation pass
- Returns summary for agent logging

#### 7.2.3 `hooks/on-tool-call.ts`

```typescript
export interface OnToolCallInput {
  engine: MemoryEngine;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: string;
  importance?: number; // default: 0.5
}

export async function onToolCall(input: OnToolCallInput): Promise<void>;
```

- Automatically captures tool call results as sensory events
- Assigns importance based on tool type heuristics (write tools → higher, read tools → lower)

#### 7.2.4 `hooks/on-response.ts`

```typescript
export interface OnResponseInput {
  engine: MemoryEngine;
  responseContent: string;
  responseTokens: number;
  modelFamily: string;
}

export async function onResponse(input: OnResponseInput): Promise<void>;
```

- Captures agent responses as episodic memories
- Tracks token usage against budget
- Flags high-importance responses for promotion

All hooks are exported from the package and usable programmatically. They are also referenced by the skill and wired by the init script into agent hook configurations.

### 7.3 MCP Server & Daemon

**Directory**: `packages/memory/src/mcp/`

#### 7.3.1 MCP tool definitions

**File**: `src/mcp/tools.ts`

Wraps existing `tools/memory-*.ts` implementations as MCP tool handlers:

| MCP Tool Name    | Maps To                   | Description                         |
| ---------------- | ------------------------- | ----------------------------------- |
| `memory_ingest`  | `tools/memory-capture.ts` | Ingest an event into sensory buffer |
| `memory_recall`  | `tools/memory-search.ts`  | Recall memories matching a query    |
| `memory_awaken`  | `cognitive/awaken.ts`     | Trigger consolidation/decay cycle   |
| `memory_stats`   | `tools/memory-stats.ts`   | Get tier utilization and budget     |
| `memory_lint`    | `tools/memory-lint.ts`    | Check memory health                 |
| `memory_list`    | `tools/memory-list.ts`    | List memories in a tier             |
| `memory_search`  | `tools/memory-search.ts`  | Semantic search across tiers        |
| `memory_capture` | `tools/memory-capture.ts` | Capture raw content                 |

Each tool follows the MCP protocol: accepts `CallToolRequest`, returns `CallToolResult` with structured content.

#### 7.3.2 MCP server process

**File**: `src/mcp/server.ts`

Stdio-based MCP server using `@modelcontextprotocol/sdk`:

```typescript
export interface MemoryMCPServerOptions {
  transport: 'stdio' | 'http';
  port?: number; // for HTTP mode
  dbPath?: string; // SQLite path, default: .agentsy/memory.db
  syncUrl?: string; // Turso sync URL, optional
  syncAuthToken?: string; // Turso auth token, optional
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export async function createMemoryMCPServer(options: MemoryMCPServerOptions): Promise<MCPServer>;
export async function startMemoryMCPServer(options: MemoryMCPServerOptions): Promise<void>;
```

Key design decisions:

- **Stdio mode** (default): runs as a child process of the agent, communicates via MCP protocol over stdin/stdout
- **HTTP mode**: runs as a standalone daemon, communicates via SSE or StreamableHTTP transport
- **Database**: defaults to local SQLite (via `sync/turso-manager.ts`), optionally syncs to Turso cloud
- **Configuration**: via environment variables (`AGENTSY_MEMORY_*`) or constructor options
- **Graceful shutdown**: SIGTERM handler flushes pending events and closes database connections

The server is **independent of `@agentsy/cli`** — it imports only from `@agentsy/memory` (workspace dependency) and `@modelcontextprotocol/sdk` (external dependency).

#### 7.3.3 Daemon process

**File**: `src/mcp/daemon.ts`

Wraps the MCP server with process management:

```typescript
export interface DaemonConfig {
  pidFile?: string; // default: .agentsy/memory-daemon.pid
  logFile?: string; // default: .agentsy/memory-daemon.log
  restart?: boolean; // auto-restart on crash, default: true
  restartDelay?: number; // ms, default: 1000
  maxRestarts?: number; // default: 5 within restartWindow
  restartWindow?: number; // ms, default: 60000
}

export async function startDaemon(options: MemoryMCPServerOptions & DaemonConfig): Promise<void>;
export async function stopDaemon(pidFile?: string): Promise<void>;
export async function isDaemonRunning(pidFile?: string): Promise<boolean>;
export async function getDaemonStatus(pidFile?: string): Promise<DaemonStatus | null>;
```

- PID file tracks the daemon process
- Log file captures stdout/stderr
- Auto-restart with exponential backoff
- Health check endpoint (HTTP mode): `GET /health` returns `DaemonStatus`

#### 7.3.4 Integration with CLI package

The `@agentsy/cli` package gains a thin wrapper command:

```typescript
// packages/cli/src/commands/memory-daemon.ts
export async function runMemoryDaemonCommand(rest: readonly string[], io: CliIO): Promise<number>;
```

- `agentsy memory daemon start` — starts the daemon via `@agentsy/memory`'s `startDaemon()`
- `agentsy memory daemon stop` — stops the daemon
- `agentsy memory daemon status` — checks daemon status
- `agentsy memory daemon restart` — restart

This is a **thin wrapper** — all logic lives in `@agentsy/memory`. The CLI package only provides the argument parsing and process spawning. This keeps memory fully standalone.

### 7.4 Install & Init Script

**File**: `packages/memory/src/init.ts` (exports) + `packages/memory/scripts/init.ts` (CLI entrypoint)

```typescript
export interface InitOptions {
  projectRoot?: string; // default: process.cwd()
  skillDir?: string; // default: <projectRoot>/.agents/skills/
  hooksDir?: string; // default: <projectRoot>/.agents/hooks/
  dbDir?: string; // default: <projectRoot>/.agentsy/
  mcpConfig?: string; // default: <projectRoot>/.opencode/mcp.json or <home>/.config/opencode/mcp.json
  transport?: 'stdio' | 'http';
  port?: number; // HTTP mode only, default: 4231
  syncUrl?: string; // Turso sync URL
  syncAuthToken?: string; // Turso auth token
  skipSkill?: boolean;
  skipHooks?: boolean;
  skipDb?: boolean;
  skipMcp?: boolean;
  force?: boolean; // overwrite existing files
}

export interface InitResult {
  skillPath: string;
  hooksPaths: string[];
  dbPath: string;
  mcpConfigPath: string;
  mcpEntry: Record<string, unknown>; // the MCP server config that was added
  warnings: string[];
}
```

The init script does five things, each skippable:

1. **Install skill** — copies `packages/memory/skill/SKILL.md` to `<skillDir>/memory/SKILL.md`
2. **Install hooks** — writes hook configuration files to `<hooksDir>/memory/`:
   - `on-session-start.json` — describes when/how to call `onSessionStart`
   - `on-session-end.json` — describes when/how to call `onSessionEnd`
   - `on-tool-call.json` — describes when/how to call `onToolCall`
   - `on-response.json` — describes when/how to call `onResponse`
3. **Initialize database** — creates SQLite database at `<dbDir>/memory.db` using `createTursoManager({ path: dbPath })`; runs schema migrations if needed
4. **Register MCP server** — adds the memory MCP server entry to the agent's config:
   - For OpenCode: `.opencode/mcp.json`
   - For Claude Code: `.claude/mcp.json`
   - For Cursor: `.cursor/mcp.json`
   - Generic: writes a standalone `mcp.json` that any MCP client can consume

   The MCP config entry:

   ```json
   {
     "mcpServers": {
       "agentsy-memory": {
         "command": "npx",
         "args": ["-y", "@agentsy/memory", "mcp"],
         "env": {
           "AGENTSY_MEMORY_DB": "<dbDir>/memory.db",
           "AGENTSY_MEMORY_TRANSPORT": "stdio"
         }
       }
     }
   }
   ```

5. **Print summary** — shows what was created, where, and how to verify

#### CLI entrypoint

**File**: `packages/memory/scripts/init.ts`

```bash
npx @agentsy/memory init [--skip-skill] [--skip-hooks] [--skip-db] [--skip-mcp] [--force] [--transport stdio|http] [--port 4231] [--sync-url URL] [--sync-auth-token TOKEN]
```

Also registers as a bin in `package.json`:

```json
{
  "bin": {
    "agentsy-memory": "./dist/scripts/init.js",
    "agentsy-memory-mcp": "./dist/scripts/mcp-server.js"
  }
}
```

So users can run:

- `agentsy-memory init` — run init
- `agentsy-memory-mcp` — start the MCP server directly (stdio mode)

#### 7.4.1 Configuration file

**File**: `packages/memory/src/config.ts`

Loads configuration from (in priority order):

1. Constructor options (programmatic)
2. Environment variables (`AGENTSY_MEMORY_*`)
3. `.agentsy/memory.env` (project-level)
4. `~/.agentsy/memory.env` (user-level)
5. Built-in defaults

```typescript
export interface MemoryConfig {
  db: { path: string; syncUrl?: string; syncAuthToken?: string; syncIntervalMs?: number };
  tiers: Record<TierName, TierConfig>;
  budget: BudgetConfig;
  decay: DecayConfig;
  mcp: { transport: 'stdio' | 'http'; port?: number };
  hooks: { onSessionStart: boolean; onSessionEnd: boolean; onToolCall: boolean; onResponse: boolean };
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadConfig(overrides?: Partial<MemoryConfig>): MemoryConfig;
```

---

### Phase 6: Learning Loop — Reflection, Dialectic & Solidification (New)

**Goal**: Implement the observation → reflection → consolidation cycle that transforms raw experience into durable knowledge, drawing from Honcho's dialectic pipeline, Hermes's reflection/doubling, and Evolver's GEP signal extraction.

This phase closes the loop: memories enter via sensory tiers (Phase 1), get bridged and compressed (Phase 2), receive importance scores (Phase 3), budget enforcement (Phase 4), and persona/graph enrichment (Phase 5). Phase 6 adds the **self-improving feedback mechanism** — the engine that learns from its own memories to refine importance heuristics, resolve contradictions, and solidify high-confidence knowledge.

#### 6.1 Observation extraction (inspired by Honcho `Deriver` + Evolver signal extraction)

**File**: `src/cognitive/learning/observation-extractor.ts`

Honcho's deriver extracts explicit observations from conversation turns. Evolver's signal extraction identifies multiple signal types (factual, emotional, procedural, corrective) from raw events. We unify these into a single `ObservationExtractor` that pulls structured observations from `MemoryItem` content.

```typescript
export type ObservationKind = 'factual' | 'emotional' | 'procedural' | 'corrective' | 'relational';

export interface Observation {
  id: string;
  kind: ObservationKind;
  content: string;
  sourceMemoryId: string;
  confidence: number; // 0-1, initial extraction confidence
  contradictsWith: string[]; // IDs of observations this contradicts
  supportsIds: string[]; // IDs of observations this reinforces
  extractedAt: number;
}

export interface ObservationExtractor {
  extract(memoryItem: MemoryItem): Promise<Observation[]>;
  extractBatch(items: MemoryItem[]): Promise<Observation[]>;
}
```

**Strategy composition** (from Evolver's multi-strategy extraction):

- `FactualExtractor` — extracts declarative facts ("X is Y", "user prefers Z")
- `ProceduralExtractor` — extracts step sequences ("to do X, first Y then Z")
- `CorrectiveExtractor` — extracts corrections ("previously thought X, actually Y") — feeds contradiction detection
- `EmotionalExtractor` — extracts preferences and affect ("user dislikes W", "user was frustrated with V")

Each strategy is a pure function `(content: string) => RawObservation[]`. The `ObservationExtractor` orchestrates them and deduplicates using content-addressing fingerprints.

**Acceptance**: Unit test — feed a `MemoryItem` with mixed content, verify multiple observations of different kinds are extracted with correct `kind` labeling.

#### 6.2 Dialectic resolution (inspired by Honcho `Dialectic` + `Representation` model)

**File**: `src/cognitive/learning/dialectic-resolver.ts`

Honcho's dialectic resolves contradictions between observations using four representation views (explicit, deductive, inductive, contradiction). We implement this as a `DialecticResolver` that detects contradictions among observations and produces resolved `Resolution` objects.

```typescript
export type RepresentationView = 'explicit' | 'deductive' | 'inductive' | 'contradiction';

export interface Representation {
  id: string;
  observationIds: string[];
  view: RepresentationView;
  summary: string;
  confidence: number;
}

export interface Resolution {
  id: string;
  contradictionIds: string[]; // observations in conflict
  representations: Representation[];
  resolvedSummary: string;
  resolutionConfidence: number; // how confident the resolution is
  method: 'deductive' | 'inductive' | 'temporal' | 'source_priority';
  timestamp: number;
}

export interface DialecticResolver {
  detectContradictions(observations: Observation[]): Promise<Observation[][]>;
  resolve(contradictions: Observation[][], priorityRules?: ResolutionPriority): Promise<Resolution[]>;
}

export interface ResolutionPriority {
  sourceWeights: Record<WriteHeap, number>; // e.g., { event: 0.8, doc: 0.6, query: 0.4, ref: 0.3 }
  recencyBias: number; // 0-1, how much to prefer newer observations
  confidenceThreshold: number; // minimum confidence to attempt resolution
}
```

Resolution methods:

1. **Deductive** — if one observation logically entails another, keep the entailed one
2. **Inductive** — if multiple observations point to a pattern, synthesize the general rule
3. **Temporal** — newer observations override older ones (weighted by `recencyBias`)
4. **Source priority** — observations from higher-priority heaps (`event` > `doc` > `query` > `ref`) win ties

**Acceptance**: Test — create two observations that contradict ("user likes dark mode" vs "user prefers light mode") with different timestamps; verify resolution picks the newer one when `recencyBias > 0.5` and the higher-source-weight one otherwise.

#### 6.3 Multi-specialist consolidation (inspired by Honcho `Dreamer` + Evolver `reflection`)

**File**: `src/cognitive/learning/consolidation-specialist.ts`

Honcho's dreamer uses multiple specialist agents (deduction, induction, surprisal) to consolidate memories. Evolver's reflection phase scores and selects genes. We implement a `ConsolidationSpecialist` that applies independent strategies to produce consolidated knowledge, then merges their outputs.

```typescript
export type SpecialistRole = 'deduction' | 'induction' | 'surprisal' | 'temporal';

export interface ConsolidationResult {
  id: string;
  role: SpecialistRole;
  inputObservationIds: string[];
  output: string; // consolidated summary
  confidence: number;
  noveltyScore: number; // how surprising is this consolidation (0-1)
  tokenCost: number; // approximate token cost of producing this
}

export interface ConsolidationSpecialist {
  consolidate(role: SpecialistRole, observations: Observation[]): Promise<ConsolidationResult>;
  merge(results: ConsolidationResult[]): Promise<MergedConsolidation>;
}

export interface MergedConsolidation {
  id: string;
  specialistResults: ConsolidationResult[];
  mergedSummary: string;
  finalConfidence: number;
  sourceObservationIds: string[];
}
```

Specialist strategies:

- **Deduction specialist** — identifies logical implications across observations; produces rules that must hold
- **Induction specialist** — identifies patterns across observations; produces probabilistic rules
- **Surprisal specialist** — identifies observations that contradicted expectations; produces "lesson learned" entries with high importance
- **Temporal specialist** — identifies how preferences or knowledge evolve over time; produces timeline entries

The `merge()` step:

1. Deduplicate overlapping summaries
2. Weight by `confidence × (1 - redundancy_score)`
3. If specialists agree, boost `finalConfidence`; if they disagree, lower it
4. Cap total `tokenCost` within budget constraints

**Note**: In the initial implementation, these specialists use deterministic heuristics (pattern matching, frequency counting, temporal ordering), not LLM calls. The architecture supports plugging in LLM-based specialists later via a `SpecialistProvider` interface.

```typescript
export interface SpecialistProvider {
  readonly role: SpecialistRole;
  consolidate(input: string, observations: Observation[]): Promise<string>;
}
```

Default providers are heuristic; LLM providers can be registered by the consumer.

**Acceptance**: Test — feed 10 observations about a user's theme preference over time; verify the temporal specialist identifies the trend, the induciton specialist identifies the pattern, and merge produces a single consolidated insight with `finalConfidence > 0.7`.

#### 6.4 Solidification & knowledge update (inspired by Evolver validation + gene scoring)

**File**: `src/cognitive/learning/solidifier.ts`

Evolver's solidification step validates and promotes genes from candidate to active state. Our solidifier validates consolidation results and promotes high-confidence knowledge to the Long-Term Memory tier and/or the knowledge graph.

```typescript
export interface SolidificationCandidate {
  consolidation: MergedConsolidation;
  currentImportance: number;
  accessCount: number;
  ageMs: number;
  existingInLTM: boolean;
}

export interface SolidificationResult {
  id: string;
  candidateId: string;
  action: 'promote' | 'demote' | 'merge' | 'archive';
  targetTier: TierName;
  confidence: number;
  reason: string;
}

export interface Solidifier {
  evaluate(candidate: SolidificationCandidate): Promise<SolidificationResult>;
  apply(result: SolidificationResult): Promise<void>;
  evaluateBatch(candidates: SolidificationCandidate[]): Promise<SolidificationResult[]>;
}
```

Solidification rules (configurable):

- `promote` when `consolidation.finalConfidence >= promotionThreshold` and `!existingInLTM`
- `merge` when `existingInLTM` and the new consolidation is compatible with existing LTM entry (semantic similarity > mergeThreshold)
- `demote` when `consolidation.finalConfidence < demotionThreshold` and `ageMs > minAgeForDemotion`
- `archive` when `accessCount < archiveAccessThreshold` and `ageMs > maxAgeBeforeArchive`

Each solidification result is recorded in the audit trail (reusing existing `AuditTrail` from `filesystem/agentfs/`).

**Acceptance**: Test — create a consolidation result with high confidence; verify solidifier returns `promote` action targeting `long_term_memory`; apply it and verify the memory item appears in LTM with updated importance.

#### 6.5 Canary degradation detection (inspired by Evolver canary system)

**File**: `src/cognitive/learning/canary-detector.ts`

Evolver's canary system detects when consolidated knowledge begins to degrade (no longer relevant, contradicted by new data). We implement this as a `CanaryDetector` that monitors consolidated memories for staleness and contradiction.

```typescript
export interface CanaryCheck {
  memoryId: string;
  lastAccessedAge: number; // time since last access in ms
  recentContradictionCount: number;
  importanceDecay: number; // how much importance has dropped since last check
  accessFrequencyTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface CanaryResult {
  memoryId: string;
  status: 'healthy' | 'stale' | 'degraded' | 'contradicted';
  action: 'keep' | 'refresh' | 'demote' | 'archive' | 'flag_for_review';
  reason: string;
  nextCheckMs: number; // when to check again
}

export interface CanaryDetector {
  check(memory: MemoryItem, recentObservations: Observation[]): Promise<CanaryResult>;
  checkBatch(memories: MemoryItem[], recentObservations: Observation[]): Promise<CanaryResult[]>;
}
```

Status determination:

- `healthy`: recently accessed, no contradictions, stable or increasing frequency
- `stale`: not accessed in > staleThreshold (configurable, default: 7 days), no contradictions
- `degraded`: importance has dropped below degradation threshold, frequency is decreasing
- `contradicted`: recent observations directly contradict this memory (detected by dialectic resolver)

Action mapping:

- `healthy` → `keep`
- `stale` → `refresh` (re-validate via consolidation specialist)
- `degraded` → `demote` (move to lower tier)
- `contradicted` → `flag_for_review` (feed into dialectic resolver)

**Acceptance**: Test — create a memory item with high importance that hasn't been accessed in 30 days; verify canary returns `stale` status with `refresh` action.

#### 6.6 Learning loop orchestrator

**File**: `src/cognitive/learning/loop-orchestrator.ts`

The orchestrator ties together the full learning cycle: observation → dialectic → consolidation → solidification → canary monitoring.

```typescript
export interface LearningLoopConfig {
  observation: {
    extractors: ObservationKind[]; // which kinds to run
    batchSize: number; // observations per cycle, default: 50
  };
  dialectic: {
    priorityRules: ResolutionPriority;
  };
  consolidation: {
    specialists: SpecialistRole[];
    maxTokenBudgetPerCycle: number; // default: 2000
  };
  solidification: {
    promotionThreshold: number; // default: 0.75
    demotionThreshold: number; // default: 0.3
    mergeSimilarityThreshold: number; // default: 0.85
    archiveAccessThreshold: number; // default: 2
    maxAgeBeforeArchive: number; // ms, default: 30 days
  };
  canary: {
    staleThreshold: number; // ms, default: 7 days
    degradationThreshold: number; // default: 0.4
    checkInterval: number; // ms, default: 1 hour
  };
}

export interface LearningCycleResult {
  observationsExtracted: number;
  contradictionsFound: number;
  resolutionsProduced: number;
  consolidationsProduced: number;
  solidificationActions: SolidificationResult[];
  canaryActions: CanaryResult[];
  durationMs: number;
}

export interface LearningLoopOrchestrator {
  runCycle(engine: MemoryEngine, config?: Partial<LearningLoopConfig>): Promise<LearningCycleResult>;
}
```

The `runCycle` method executes:

1. **Observe** — extract observations from new memories since last cycle
2. **Dialectic** — detect and resolve contradictions among observations
3. **Consolidate** — run specialists on resolved observations, merge results
4. **Solidify** — evaluate consolidation results, promote/demote/merge/archive
5. **Canary** — check existing LTM memories for degradation

Each step emits events via the existing `PubSubManager` for observability.

**Acceptance**: Integration test — feed 100 memory items into a fresh `MemoryEngine`, run a full learning cycle, verify that observations are extracted, contradictions resolved, consolidations produced, and at least one item is promoted to LTM.

#### 6.7 Integration with `MemoryEngine.awaken()`

**File**: `src/cognitive/awaken.ts` (extends existing)

The `awaken()` method (from Phase 4) is extended to optionally trigger a learning cycle:

```typescript
export interface AwakenOptions {
  // ... existing options ...
  runLearningCycle?: boolean; // default: false in Phase 4, true in Phase 6
  learningConfig?: Partial<LearningLoopConfig>;
}
```

When `runLearningCycle` is true, `awaken()` calls `LearningLoopOrchestrator.runCycle()` after the existing consolidation and decay passes. This keeps learning opt-in during Phase 4 (not all memory engines need it) and on-by-default in Phase 6+.

**Acceptance**: Existing awaken tests pass with `runLearningCycle: false` (no behavior change). New test with `runLearningCycle: true` produces a `LearningCycleResult`.

---

## Learning Loop: Phase Mapping from Source Frameworks

| Mechanism                              | Source  | Maps To                                                               | Phase       |
| -------------------------------------- | ------- | --------------------------------------------------------------------- | ----------- |
| Deriver (observation extraction)       | Honcho  | `ObservationExtractor` with multi-strategy extraction                 | 6.1         |
| Dialectic contradiction resolution     | Honcho  | `DialecticResolver` with 4 representation views                       | 6.2         |
| Dreamer multi-specialist consolidation | Honcho  | `ConsolidationSpecialist` with deduction/induction/surprisal/temporal | 6.3         |
| Reflection/doubling                    | Hermes  | `onResponse` hook captures agent output for observation               | 7.2.4 + 6.1 |
| GEP signal extraction                  | Evolver | `ObservationKind` enum (factual/emotional/procedural/corrective)      | 6.1         |
| Gene scoring & selection               | Evolver | `Solidifier.evaluate()` with confidence/importance thresholds         | 6.4         |
| Validation & solidification            | Evolver | `Solidifier.apply()` promoting to LTM/knowledge graph                 | 6.4         |
| Canary degradation detection           | Evolver | `CanaryDetector` monitoring LTM for staleness/contradiction           | 6.5         |
| Narrative memory                       | Evolver | Consolidated summaries stored as `episodic` memories                  | 6.3         |
| Evolvable personality state            | Evolver | `PersonaStore` (Phase 5) updated by learning cycle                    | 5 + 6       |

---

## Updated File Structure Summary

```text
src/
├── cognitive/                    # Phase 1-4
│   ├── tier-types.ts
│   ├── memory-tier.ts
│   ├── sensory-buffer.ts
│   ├── sensory-register.ts
│   ├── working-memory.ts
│   ├── short-term-memory.ts
│   ├── long-term-memory.ts
│   ├── tier-bridge.ts
│   ├── compressor.ts
│   ├── synthesizer.ts
│   ├── summarizer.ts
│   ├── importance.ts
│   ├── decay.ts
│   ├── tier-scheduler.ts
│   ├── token-budget.ts
│   ├── awaken.ts
│   ├── memory-engine.ts
│   ├── persona/
│   │   └── persona-store.ts
│   ├── knowledge/
│   │   └── graph-builder.ts
│   ├── learning/                  # Phase 6
│   │   ├── observation-extractor.ts
│   │   ├── dialectic-resolver.ts
│   │   ├── consolidation-specialist.ts
│   │   ├── solidifier.ts
│   │   ├── canary-detector.ts
│   │   ├── loop-orchestrator.ts
│   │   └── index.ts
│   ├── testing.ts
│   └── index.ts
├── hooks/                        # Phase 7.2
│   ├── on-session-start.ts
│   ├── on-session-end.ts
│   ├── on-tool-call.ts
│   ├── on-response.ts
│   └── index.ts
├── mcp/                          # Phase 7.3
│   ├── tools.ts                  # MCP tool wrappers
│   ├── server.ts                 # MCP server (stdio + HTTP)
│   ├── daemon.ts                 # Daemon process management
│   └── index.ts
├── config.ts                     # Phase 7.4.1
├── init.ts                       # Phase 7.4 (programmatic)
├── (existing modules unchanged)
skill/
├── SKILL.md                      # Phase 7.1
scripts/
├── init.ts                       # CLI entrypoint for init
├── mcp-server.ts                 # CLI entrypoint for MCP server
```

### Updated package.json additions

```jsonc
{
  // ... existing config ...
  "bin": {
    "agentsy-memory": "./dist/scripts/init.js",
    "agentsy-memory-mcp": "./dist/scripts/mcp-server.js"
  },
  "exports": {
    // ... existing exports ...
    "./cognitive": {
      "types": "./dist/cognitive/index.d.ts",
      "import": "./dist/cognitive/index.js",
      "require": "./dist/cognitive/index.js.cjs"
    },
    "./learning": {
      "types": "./dist/cognitive/learning/index.d.ts",
      "import": "./dist/cognitive/learning/index.js",
      "require": "./dist/cognitive/learning/index.js.cjs"
    },
    "./hooks": {
      "types": "./dist/hooks/index.d.ts",
      "import": "./dist/hooks/index.js",
      "require": "./dist/hooks/index.js.cjs"
    },
    "./mcp": {
      "types": "./dist/mcp/index.d.ts",
      "import": "./dist/mcp/index.js",
      "require": "./dist/mcp/index.js.cjs"
    },
    "./config": { "types": "./dist/config.d.ts", "import": "./dist/config.js", "require": "./dist/config.js.cjs" },
    "./init": { "types": "./dist/init.d.ts", "import": "./dist/init.js", "require": "./dist/init.js.cjs" }
  },
  "dependencies": {
    // ... existing ...
    "@modelcontextprotocol/sdk": "^1.12.0" // MCP server SDK
  }
}
```

### Updated tsup.config.ts additions

```typescript
entry: {
  // ... existing index entry ...
  cognitive: 'src/cognitive/index.ts',
  hooks: 'src/hooks/index.ts',
  mcp: 'src/mcp/index.ts',
  config: 'src/config.ts',
  init: 'src/init.ts',
  'scripts/init': 'scripts/init.ts',
  'scripts/mcp-server': 'scripts/mcp-server.ts'
}
```

---

## Dependency Map (Updated)

```text
cognitive/*           ←── cognitive/tier-types, content-addressing/fingerprint, wiki/content-processor, wiki/entity-extractor, wiki/local-embedding-engine, coordination/scheduler, coordination/pub-sub-manager, scope/scope-manager
cognitive/learning/*  ←── cognitive/tier-types, cognitive/memory-engine, cognitive/importance, cognitive/decay, cognitive/tier-bridge, wiki/entity-extractor, retrieval/retriever, content-addressing/fingerprint
hooks/*               ←── cognitive/memory-engine, cognitive/tier-types, cognitive/learning/loop-orchestrator
mcp/tools             ←── tools/*, cognitive/memory-engine, cognitive/tier-types, retrieval/injection, retrieval/retriever
mcp/server            ←── mcp/tools, mcp/daemon, sync/turso-manager, config
mcp/daemon            ←── mcp/server, config
config                ←── cognitive/tier-types, sync/turso-manager
init                  ←── config, mcp/server, fs operations for skill/hooks installation
skill/SKILL.md        ←── (static file, no code dependencies)
```

---

## CLI Integration (Phase 7.3.4)

The `@agentsy/cli` package adds these commands:

```bash
agentsy memory daemon start [--port 4231] [--sync-url URL] [--sync-auth-token TOKEN]
agentsy memory daemon stop
agentsy memory daemon status
agentsy memory daemon restart
agentsy memory init                 # delegates to @agentsy/memory init
```

All logic lives in `@agentsy/memory`. CLI only provides argument parsing and `child_process.spawn()`.

---

## Implementation Order for Phase 7

| Step  | File                            | Depends On                                    | Estimated Lines |
| ----- | ------------------------------- | --------------------------------------------- | --------------- |
| 7.1   | `skill/SKILL.md`                | Phase 1-6 design (can draft earlier)          | ~250            |
| 7.2.1 | `src/hooks/on-session-start.ts` | `cognitive/memory-engine`, `cognitive/awaken` | ~60             |
| 7.2.2 | `src/hooks/on-session-end.ts`   | `cognitive/memory-engine`                     | ~40             |
| 7.2.3 | `src/hooks/on-tool-call.ts`     | `cognitive/memory-engine`                     | ~50             |
| 7.2.4 | `src/hooks/on-response.ts`      | `cognitive/memory-engine`                     | ~40             |
| 7.2   | `src/hooks/index.ts`            | all hooks                                     | ~15             |
| 7.3.1 | `src/mcp/tools.ts`              | existing `tools/*`, `cognitive/tier-types`    | ~200            |
| 7.3.2 | `src/mcp/server.ts`             | `mcp/tools`, `config`, `sync/turso-manager`   | ~150            |
| 7.3.3 | `src/mcp/daemon.ts`             | `mcp/server`                                  | ~120            |
| 7.3   | `src/mcp/index.ts`              | server, daemon, tools                         | ~10             |
| 7.4.1 | `src/config.ts`                 | `cognitive/tier-types`, `sync/turso-manager`  | ~100            |
| 7.4   | `src/init.ts`                   | `config`, `mcp/server`                        | ~180            |
| 7.4   | `scripts/init.ts`               | `init.ts` exports                             | ~30             |
| 7.4   | `scripts/mcp-server.ts`         | `mcp/server` exports                          | ~20             |
| 7.3.4 | CLI commands in `@agentsy/cli`  | `@agentsy/memory` exports                     | ~80             |

**Phase 7 total**: ~1,335 lines (implementation) + ~250 lines (skill doc) ≈ **1,585 lines**

---

## Implementation Order for Phase 6

| Step | File                                                 | Depends On                                                                                                       | Estimated Lines |
| ---- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------- |
| 6.1  | `src/cognitive/learning/observation-extractor.ts`    | `cognitive/tier-types`, `content-addressing/fingerprint`                                                         | ~180            |
| 6.2  | `src/cognitive/learning/dialectic-resolver.ts`       | `cognitive/tier-types`, `cognitive/learning/observation-extractor`                                               | ~220            |
| 6.3  | `src/cognitive/learning/consolidation-specialist.ts` | `cognitive/tier-types`, `cognitive/learning/observation-extractor`, `cognitive/learning/dialectic-resolver`      | ~250            |
| 6.4  | `src/cognitive/learning/solidifier.ts`               | `cognitive/tier-types`, `cognitive/learning/consolidation-specialist`, `cognitive/decay`, `cognitive/importance` | ~150            |
| 6.5  | `src/cognitive/learning/canary-detector.ts`          | `cognitive/tier-types`, `cognitive/importance`, `cognitive/learning/dialectic-resolver`                          | ~120            |
| 6.6  | `src/cognitive/learning/loop-orchestrator.ts`        | all Phase 6 modules, `cognitive/memory-engine`, `cognitive/awaken`, `coordination/pub-sub-manager`               | ~200            |
| 6.7  | `src/cognitive/awaken.ts` (extends)                  | `cognitive/learning/loop-orchestrator`                                                                           | ~30             |
| 6.x  | `src/cognitive/learning/index.ts`                    | all Phase 6 modules                                                                                              | ~10             |

**Phase 6 total**: ~1,160 lines

---

## Updated Success Metrics

| Metric                   | Target                                                                   | Measurement                                                                         |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Standalone install       | Single `npx @agentsy/memory init` sets up everything                     | Fresh project → init → `memory_ingest` works                                        |
| MCP compatibility        | Works with Claude Code, Cursor, OpenCode, any MCP client                 | MCP Inspector validates tool schemas                                                |
| CLI independence         | Memory daemon runs without `@agentsy/cli` installed                      | `agentsy-memory-mcp` starts standalone                                              |
| Skill discoverability    | Agent reads skill and knows how to use memory                            | Skill triggers on "remember", "recall", "forget"                                    |
| Hook integration         | Session start/end auto-triggers consolidation                            | Agent session → hooks fire → stats change                                           |
| Learning cycle           | Observation → dialectic → consolidation → solidification runs end-to-end | Feed 100 items → full cycle produces at least 1 LTM promotion                       |
| Contradiction resolution | Dialectic resolves conflicting observations                              | "user likes dark" vs "user prefers light" → resolution with correct source priority |
| Canary detection         | Stale memories are identified and flagged                                | 30-day unused memory → canary returns `stale` status                                |
| Specialist consolidation | Multiple specialists produce merged insights                             | 10 observations → deduction + induction + temporal → merged consolidation           |

---

## Updated Risks & Mitigations (Full)

| Risk                               | Mitigation                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Embedding engine unavailable       | Synthesizer falls back to `EntityExtractor` keyword matching; `LocalEmbeddingEngine` already exists in wiki                                                               |
| LTM unbounded growth               | `importance` threshold + `accessCount` heuristics archive cold items; TTL-based cleanup in `awaken()`                                                                     |
| Bridge transforms too lossy        | Each bridge starts with identity transform; compress/synthesize/summarize are additive (Phase 2)                                                                          |
| Tier promotion thrashing           | Hysteresis: must exceed `consolidationThreshold` to promote; must drop below `minimumImportance` to demote                                                                |
| Budget starvation                  | `reclaim()` automatically frees tokens from lowest-importance items when a tier hits quota                                                                                |
| MCP clients config format varies   | Init script detects client type (OpenCode/Claude/Cursor) and writes correct format; fallback writes generic `mcp.json`                                                    |
| Daemon port conflicts              | Default port 4231 (unlikely collision); configurable via `--port` or `AGENTSY_MEMORY_PORT`                                                                                |
| Skill directory location varies    | Init script checks common locations (`~/.agents/skills/`, `.agents/skills/`, project-local) and uses first writable path                                                  |
| Learning loop too aggressive       | `runLearningCycle` defaults to `false` in Phase 4, `true` in Phase 6 — gradual opt-in; `learningConfig` allows disabling individual specialists                           |
| Contradiction resolution incorrect | Dialectic resolver uses configurable `ResolutionPriority` with source weights and recency bias; low-confidence resolutions flagged for review, not auto-applied           |
| Specialist consolidation too noisy | `maxTokenBudgetPerCycle` caps consolidation cost; merge step deduplicates and weights by confidence; low-confidence results are kept but not promoted                     |
| Canary false positives             | `staleThreshold` and `degradationThreshold` are configurable; `refresh` action (not `archive`) is the default for stale memories, giving them a chance to prove relevance |
| @agentsy/cli not installed         | Daemon and MCP server are fully independent; CLI is optional convenience wrapper                                                                                          |

> > > > > > > Stashed changes
