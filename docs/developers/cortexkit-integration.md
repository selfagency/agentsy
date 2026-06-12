# CortexKit Integration Architecture

**Last updated:** 2026-06-12  
**Phase:** 22 (CortexKit Integration) + Phase 7 (Memory Integration)

---

## Overview

`@agentsy` integrates with two CortexKit packages as hard (non-optional) dependencies:

- **`@cortexkit/magic-context`** — Durable session & memory storage via shared SQLite database
- **`@cortexkit/aft-bridge`** — Persistent Rust process for tree-sitter backed code intelligence

Both are published npm packages consumed at build time. No forks, no optional loading.

---

## Shared SQLite Database

### Location

`~/.local/share/cortexkit/magic-context/context.db` (XDG-compatible, respects `$XDG_DATA_HOME`)

### Access Layer (`@agentsy/shared/src/cortexkit/`)

| File | Purpose |
|------|---------|
| `db-path.ts` | Platform-aware path resolution for MC's database |
| `db.ts` | `openCortexKitDb()`, `openCortexKitDbReadOnly()`, `withRetry()` |
| `schema.ts` | Exported table/column name constants for shared tables |
| `aft-manager.ts` | `getAftBridge()`, `getAftSessionBridge()`, `shutdownAftBridge()` |

Schema tables consumed:

| Table | Purpose | Consumers |
|-------|---------|-----------|
| `project_memories` | Durable project knowledge (5-category taxonomy) | `@agentsy/memory`, dreamer consumer |
| `compartments` | Tiered session history | `@agentsy/session` snapshot bridge |
| `session_meta` | Per-session KV metadata | `@agentsy/session` store |
| `project_state` | Epoch tracker for dreamer runs | Dreamer consumer |

---

## Session Integration (`@agentsy/session/src/cortexkit/`)

```text
┌──────────────────┐     ┌──────────────────────┐
│  SessionManager   │────▶│ CortexKitSessionStore │
│  (manager.ts)     │     │ (session-store.ts)    │
└──────────────────┘     └──────────┬───────────┘
                                    │ reads/writes
                                    ▼
                           ┌──────────────────┐
                           │  MC session_meta  │
                           │  (SQLite KV)      │
                           └──────────────────┘

┌──────────────────┐     ┌──────────────────────────┐
│  Crash Recovery   │────▶│ CortexKitSnapshotBridge   │
│  (recovery/)      │     │ (snapshot-bridge.ts)      │
└──────────────────┘     └──────────┬───────────────┘
                                    │ reads compartments
                                    ▼
                           ┌──────────────────┐
                           │  MC compartments  │
                           │  (tiered history) │
                           └──────────────────┘
```

---

## Memory Bridge (`@agentsy/memory/src/cortexkit/`)

### Memory Adapter

```text
┌──────────────────────┐      ┌──────────────────┐
│  createMemoryBridge   │─────▶│  WikiManager      │
│  (memory-adapter.ts)  │      │  (wiki-manager.ts)│
│                       │      └──────────────────┘
│  - readMemories()     │
│  - mapCategory()      │
│  - toWikiEntry()      │
│  - promoteMemories()  │
└──────────────────────┘
```

Maps MC's 5-category taxonomy (`ARCHITECTURE`, `CONSTRAINTS`, `CONFIG_VALUES`, `NAMING`, `PROJECT_RULES`) to wiki entity kinds. Low-importance items (< 0.3) are skipped during promotion.

### Dreamer Consumer

```text
┌────────────────────────┐      ┌──────────────────┐
│  createDreamerConsumer  │─────▶│  WikiManager      │
│  (dreamer-consumer.ts)  │      │  (upsertPage)    │
│                         │      └──────────────────┘
│  - polls project_state  │
│  - detects epoch change │
│  - syncs memories       │
└────────────────────────┘
```

Polls `project_state.project_memory_epoch` on each `checkAndSync()` call. When the epoch advances (indicating the dreamer consolidated), reads all project memories and upserts them as wiki pages.

---

## Runtime Memory Hooks (`@agentsy/runtime/src/hooks/`)

| Hook | Event | Priority | Purpose |
|------|-------|----------|---------|
| `memory:pre-turn` | `PostResponse` | 100 | Retrieve relevant memories before each turn |
| `memory:post-turn` | `PostResponse` | 100 | Capture observations from completed turns |
| `memory:wiki-synthesis` | `PostResponse` | 50 | Trigger wiki consolidation every N turns |

All hooks follow the error-isolation pattern: `try/catch` at the handler boundary ensures a failing memory provider cannot crash the hook chain.

---

## Context Fingerprint (`@agentsy/session/src/context-fingerprint.ts`)

For cache-aware context reuse on session resume:

```ts
const fresh = computeContextFingerprint({ contextContent, lastMemoryRefresh, messageCount, modelId });
if (isCacheValid(fresh, cachedSnapshot)) {
  // Reuse cached context — reduces re-encoding tokens
}
```

Comparison dimensions: modelId, messageCount, lastMemoryRefresh (ISO), SHA-256 content hash.

---

## LLM Fact Extraction (`@agentsy/memory/src/extraction/`)

Clean-DI pattern — `FactExtractor` accepts an injectable LLM client:

```ts
const extractor = createFactExtractor({ model: myLlmClient });
const facts = await extractor.extract('User says they want PostgreSQL');

// Returns structured facts with kind, content, confidence
// Kinds: user_preference | entity | procedure | constraint | task_context
```

Facts below minConfidence (default 0.5) are filtered. All errors return empty array (fail-safe).

---

## Memory Tools (`@agentsy/tools/src/tools/memory/`)

Two tools for agent-facing memory access:

- **`memory_append`**: Store a fact (type, content, optional TTL)
- **`memory_search`**: Query long-term memory (query, optional limit)

Both inject memory provider + sessionId at runtime. Error isolation wraps all provider calls.

---

## Tokenizer Bridge (`@agentsy/tokenomics/src/cortexkit/budget-provider.ts`)

Replaces MC's crude `text.length / 4` estimates with accurate BPE token counts:

```ts
const provider = createCortexKitBudgetProvider();
const tokens = provider.countTokens('Some text', 'gpt-4o');
const factor = provider.costFactor('claude-3-5-sonnet');
```

Used for precise budget enforcement and decay scheduling.

---

## Lifecycle Diagram

```text
Session Start
  │
  ├── pre-turn hook: memory:pre-turn
  │     └── retrieve relevant memories → inject into context
  │
  ├── model call + tool calls
  │
  ├── post-turn hook: memory:post-turn
  │     └── extract observations → capture to memory
  │
  ├── post-turn hook: memory:wiki-synthesis (every N turns)
  │     └── trigger wiki consolidation
  │
  ├── dreamer consumer (periodic)
  │     └── detect MC epoch change → sync to wiki
  │
  └── session resume
        └── context fingerprint check → reuse cached context if valid
```
