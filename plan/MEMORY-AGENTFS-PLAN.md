# @agentsy/memory — AgentFS Foundation Plan (Canonical)

**Revised:** 2026-05-21  
**Supersedes:** `packages/memory/IMPLEMENTATION-GAPS.md` Phases 1–8 (storage-layer portions)  
**Status:** Phase 5 (Unified Query) complete. Phases 6+ revised to build on AgentFS.

---

## 1. Why AgentFS?

Our current `@agentsy/memory` persistence layer uses custom Drizzle ORM tables (`memory_items`, `wiki_pages`, `rag_documents`, etc.) inside a SQLite file. This works for local-first operation, but it is **not** the architecture intended by our ecosystem strategy.

The [Turso AgentFS specification](https://github.com/tursodatabase/agentfs/blob/main/SPEC.md) defines a canonical SQLite schema for agent state:

- **`tool_calls`** — insert-only audit trail for every tool invocation
- **`fs_inode`, `fs_dentry`, `fs_data`, `fs_config`** — POSIX-like virtual filesystem with chunked BLOB storage, hard links, and proper metadata
- **`fs_whiteout`, `fs_origin`** — overlay filesystem for copy-on-write sandboxing
- **`fs_symlink`** — symbolic links
- **`kv_store`** — structured key-value with automatic timestamping

Adopting AgentFS as the foundation gives us:

| Benefit                     | How                                                                               |
| --------------------------- | --------------------------------------------------------------------------------- |
| **Auditability**            | Every tool call, file write, and state change is a queryable SQL record           |
| **Reproducibility**         | `cp agent.db snapshot.db` captures exact state; WAL enables time-travel           |
| **Portability**             | Single `.db` file moves between machines, CI, and edge nodes                      |
| **Turso Sync**              | `@tursodatabase/sync` replicates the SQLite file natively — no JSON serialization |
| **Multi-agent sandboxing**  | Overlay + whiteout tables isolate agents without VMs                              |
| **Ecosystem compatibility** | AgentFS SDKs (TypeScript, Python, Rust) can read our state                        |

Our existing custom tables will be **migrated into views and triggers** on top of AgentFS base tables, not replaced outright. This preserves our domain semantics while gaining the AgentFS substrate.

---

## 2. Concept Mapping: Our Domain → AgentFS Tables

### 2.1 Memory Tiers → `kv_store` + `fs_data`

| Our Concept                              | AgentFS Storage                                   | Rationale                                     |
| ---------------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| Sensory buffer items                     | `kv_store` keys: `tier:sensory:{id}` with TTL     | Short-lived, high-throughput, fits KV model   |
| Working memory items                     | `kv_store` keys: `tier:working:{id}`              | Small, frequently accessed, KV is fast        |
| Short-term memory items                  | `fs_data` chunks under `/memory/stm/{id}.json`    | Larger content, benefits from chunked storage |
| Long-term memory items                   | `fs_data` chunks under `/memory/ltm/{id}.json`    | Persistent, may be large, needs offset reads  |
| Memory metadata (importance, timestamps) | `kv_store` keys: `meta:{id}` or `fs_inode` xattrs | Structured fields alongside content           |

**Migration path:**

- Replace `memory_items` Drizzle table with a virtual table (`CREATE VIRTUAL TABLE`) backed by `kv_store` and `fs_inode` queries.
- Retain the `MemoryEngine` API unchanged — consumers do not know the storage shifted.

### 2.2 Wiki → `fs_data` + `fs_dentry`

| Our Concept                          | AgentFS Storage                                              |
| ------------------------------------ | ------------------------------------------------------------ |
| Wiki page content                    | `fs_data` chunks under `/wiki/pages/{pageId}.md`             |
| Page metadata (title, tags, version) | `kv_store` keys: `wiki:meta:{pageId}` or extended `fs_inode` |
| Page history                         | `fs_data` chunks under `/wiki/history/{pageId}/{version}.md` |
| Concept links                        | `fs_symlink` entries or `kv_store` graph records             |
| Backlinks index                      | `kv_store` key: `wiki:backlinks:{pageId}` (JSON array)       |
| Embeddings                           | `kv_store` key: `wiki:embedding:{pageId}` (JSON vector)      |

**Migration path:**

- Replace `wiki_pages`, `wiki_page_history`, `wiki_vectors`, `wiki_concepts`, `wiki_backlinks` tables.
- Provide a `WikiFsAdapter` that implements `WikiManager` by reading/writing AgentFS paths.
- Wiki full-text search becomes a SQLite FTS5 virtual table over `fs_data` content.

### 2.3 RAG Knowledge Base → `fs_data` + `fs_inode`

| Our Concept             | AgentFS Storage                                                   |
| ----------------------- | ----------------------------------------------------------------- |
| Source documents        | `fs_data` chunks under `/rag/sources/{sourceId}/{chunkIndex}.txt` |
| Document metadata       | `kv_store` keys: `rag:meta:{docId}`                               |
| Chunk embeddings        | `kv_store` keys: `rag:embedding:{docId}:{chunkIndex}`             |
| Source connectors state | `kv_store` keys: `rag:connector:{sourceType}`                     |

**Migration path:**

- Replace `rag_documents` and `rag_vectors` tables.
- RAG hybrid search queries `fs_data` content (lexical) + `kv_store` embeddings (vector), same as today but via AgentFS schema.
- Source connectors write ingested content directly to `/rag/sources/...` paths.

### 2.4 Tool Calls → `tool_calls` (native)

Our MCP tools (`memory_ingest`, `memory_recall`, etc.) currently have no durable audit log.

| Our Concept         | AgentFS Storage                   |
| ------------------- | --------------------------------- |
| MCP tool invocation | Insert-only row in `tool_calls`   |
| Tool parameters     | `parameters` column (JSON string) |
| Tool result/error   | `result` or `error` column        |
| Duration            | `duration_ms` column              |

**Migration path:**

- Add a `ToolCallAuditor` wrapper around every `McpToolHandler`.
- No schema migration needed — AgentFS `tool_calls` is the schema.

### 2.5 Audit Trail → `tool_calls` + custom event tables

Our in-memory `AuditTrail` (`filesystem/agentfs/audit-trail.ts`) records file operations.

| Our Concept          | AgentFS Storage                                         |
| -------------------- | ------------------------------------------------------- |
| File write audit     | `tool_calls` row with `name='fs_write'`                 |
| File read audit      | `tool_calls` row with `name='fs_read'`                  |
| Snapshot capture     | `tool_calls` row with `name='fs_snapshot'`              |
| Custom memory events | Extension table `memory_events` (FK to `tool_calls.id`) |

**Migration path:**

- Replace `createAuditTrail()` with a writer to `tool_calls`.
- The `AuditTrail` interface stays the same — implementation swaps to SQL inserts.

### 2.6 Snapshots → `cp agent.db snapshot.db`

Our `SnapshotStore` (`filesystem/agentfs/snapshots.ts`) clones a Map.

| Our Concept       | AgentFS Equivalent                                 |
| ----------------- | -------------------------------------------------- |
| Snapshot creation | SQLite backup API or `VACUUM INTO`                 |
| Snapshot restore  | Replace `.db` file and reopen connection           |
| Named snapshots   | `fs_data` file `/snapshots/{label}.db` (BLOB copy) |

**Migration path:**

- Replace `createSnapshotStore()` with `AgentFsSnapshotManager` using SQLite's native backup.
- Snapshots become first-class AgentFS operations, not in-memory clones.

---

## 3. Architecture After Migration

```text
┌─────────────────────────────────────────────────────────────┐
│                     @agentsy/memory                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐│
│  │ MemoryEngine │  │ WikiManager │  │ KnowledgeBaseManager││
│  │  (tiers)     │  │  (pages)    │  │  (RAG search)       ││
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘│
│         │                │                    │           │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────────┴──────────┐│
│  │ TierStore   │  │ WikiFsStore │  │   RagFsStore        ││
│  │  Adapter    │  │  Adapter    │  │   Adapter           ││
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘│
│         │                │                    │           │
│  ┌──────┴────────────────┴────────────────────┴──────────┐│
│  │              AgentFS SQLite Layer                      ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ ││
│  │  │ kv_store│ │ fs_data │ │fs_dentry│ │ tool_calls│ ││
│  │  └─────────┘ └─────────┘ └─────────┘ └───────────┘ ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ ││
│  │  │fs_inode │ │fs_config│ │fs_whiteo│ │  fs_origin│ ││
│  │  └─────────┘ └─────────┘ └─────────┘ └──────────┘ ││
│  └───────────────────────────────────────────────────────┘│
│                           │                                │
│  ┌────────────────────────┴──────────────────────────┐  │
│  │            @tursodatabase/sync (Phase 8)            │  │
│  │        Bidirectional SQLite ↔ Turso Cloud        │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Principle: Storage Adapters

The `MemoryEngine`, `WikiManager`, and `KnowledgeBaseManager` interfaces do **not** change. Each gains an optional `db` parameter (already partially true). Behind each interface is an **adapter** that speaks AgentFS SQL:

- `TierFsAdapter` — implements tier read/write via `kv_store` + `fs_data`
- `WikiFsAdapter` — implements wiki CRUD via `fs_data` paths + `kv_store` metadata
- `RagFsAdapter` — implements RAG ingest/search via `fs_data` + `kv_store` embeddings

This means:

- **Phase 5 unified query** (`queryUnified()`) needs **zero changes** — it still queries the three managers through their interfaces.
- **MCP tools** need **zero changes** — they call `memory_recall`, `wiki_search`, etc.
- **Tests** for the unified query layer continue to pass.
- Only the **adapter implementations** and **schema initialization** change.

---

## 4. Revised Phase Sequence

| Phase  | Work                                                                                         | Depends On | Duration |
| ------ | -------------------------------------------------------------------------------------------- | ---------- | -------- |
| **5**  | ✅ Unified Query Interface (`queryUnified`)                                                  | 2, 3, 4    | Done     |
| **6**  | MCP Tools for Wiki + RAG                                                                     | 5          | 2–3 days |
| **7**  | Unified Initialization (`initMemory` with all layers)                                        | 5, 6       | 1–2 days |
| **8a** | **AgentFS Schema Migration** — Replace custom tables with AgentFS base tables + domain views | 1, 7       | 4–5 days |
| **8b** | **AgentFS Storage Adapters** — Implement `TierFsAdapter`, `WikiFsAdapter`, `RagFsAdapter`    | 8a         | 3–4 days |
| **8c** | **Turso Sync** — Wire `@tursodatabase/sync` for bidirectional replication                    | 8a, 8b     | 3–4 days |
| **9**  | Agent Learning + Wiki Validation                                                             | 8b         | 2–3 days |
| **10** | Documentation + Testing                                                                      | All        | 2–3 days |

**Total remaining effort: ~17–24 days.**

### 4.1 Phase 8a: AgentFS Schema Migration (Detailed)

**Goal:** Replace `packages/memory/src/database/schema.ts` custom Drizzle tables with AgentFS base tables + domain-specific views.

**Schema files to create:**

```text
packages/memory/src/agentfs/
  schema.ts              # AgentFS base tables (fs_*, kv_store, tool_calls)
  schema-domain.ts       # Views/triggers mapping our domain to AgentFS
  init.ts                # Database initialization (root dir, config, fs_config)
  migrate.ts             # Migration from old custom schema to AgentFS
```

**Base tables (from SPEC.md, verbatim):**

```sql
-- Tool call audit trail
CREATE TABLE tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parameters TEXT,
  result TEXT,
  error TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL
);
CREATE INDEX idx_tool_calls_name ON tool_calls(name);
CREATE INDEX idx_tool_calls_started_at ON tool_calls(started_at);

-- Filesystem config
CREATE TABLE fs_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO fs_config (key, value) VALUES ('chunk_size', '4096');

-- Inode metadata
CREATE TABLE fs_inode (
  ino INTEGER PRIMARY KEY AUTOINCREMENT,
  mode INTEGER NOT NULL,
  nlink INTEGER NOT NULL DEFAULT 0,
  uid INTEGER NOT NULL DEFAULT 0,
  gid INTEGER NOT NULL DEFAULT 0,
  size INTEGER NOT NULL DEFAULT 0,
  atime INTEGER NOT NULL,
  mtime INTEGER NOT NULL,
  ctime INTEGER NOT NULL,
  rdev INTEGER NOT NULL DEFAULT 0,
  atime_nsec INTEGER NOT NULL DEFAULT 0,
  mtime_nsec INTEGER NOT NULL DEFAULT 0,
  ctime_nsec INTEGER NOT NULL DEFAULT 0
);

-- Directory entries
CREATE TABLE fs_dentry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_ino INTEGER NOT NULL,
  ino INTEGER NOT NULL,
  UNIQUE(parent_ino, name)
);
CREATE INDEX idx_fs_dentry_parent ON fs_dentry(parent_ino, name);

-- File content chunks
CREATE TABLE fs_data (
  ino INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (ino, chunk_index)
);

-- Symlinks
CREATE TABLE fs_symlink (
  ino INTEGER PRIMARY KEY,
  target TEXT NOT NULL
);

-- Key-value store
CREATE TABLE kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_kv_store_created_at ON kv_store(created_at);

-- Overlay whiteouts
CREATE TABLE fs_whiteout (
  path TEXT PRIMARY KEY,
  parent_path TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_fs_whiteout_parent ON fs_whiteout(parent_path);

-- Origin tracking for copy-up
CREATE TABLE fs_origin (
  delta_ino INTEGER PRIMARY KEY,
  base_ino INTEGER NOT NULL
);

-- Root directory initialization
INSERT INTO fs_inode (ino, mode, nlink, uid, gid, size, atime, mtime, ctime)
VALUES (1, 16877, 1, 0, 0, 0, unixepoch(), unixepoch(), unixepoch());
```

**Domain views (for backward compatibility during transition):**

```sql
-- View: memory_items (for old queries during transition)
CREATE VIEW v_memory_items AS
SELECT
  json_extract(value, '$.id') AS id,
  json_extract(value, '$.tier') AS tier,
  json_extract(value, '$.content') AS content,
  json_extract(value, '$.importance') AS importance,
  json_extract(value, '$.created_at') AS created_at
FROM kv_store
WHERE key LIKE 'tier:%';

-- Trigger: auto-populate kv_store on memory insert (during migration window)
-- ...etc
```

### 4.2 Phase 8b: AgentFS Storage Adapters (Detailed)

**Goal:** Implement domain adapters that speak AgentFS SQL but expose our existing interfaces.

```typescript
// packages/memory/src/agentfs/tier-adapter.ts
export interface TierFsAdapterOptions {
  db: MemoryDatabase; // Drizzle connection to AgentFS schema
  namespace?: string; // e.g., 'default' or 'agent-42'
}

export function createTierFsAdapter(options: TierFsAdapterOptions): MemoryTierLike {
  // Implements read/write via kv_store + fs_data
  // Content-addressed deduplication via fs_inode + fs_dentry
  // TTL/purge via kv_store.updated_at + periodic sweep
}

// packages/memory/src/agentfs/wiki-adapter.ts
export function createWikiFsAdapter(options: WikiFsAdapterOptions): WikiManager {
  // getPage(pageId) -> resolve /wiki/pages/{pageId}.md via fs_dentry/fs_data
  // upsertPage(input) -> write fs_data chunks, update fs_inode, upsert kv_store meta
  // searchFullText(query) -> FTS5 over fs_data content
  // searchVector(query, embedding) -> cosine similarity over kv_store embeddings
}

// packages/memory/src/agentfs/rag-adapter.ts
export function createRagFsAdapter(options: RagFsAdapterOptions): KnowledgeBaseManager {
  // ingest(source) -> write /rag/sources/{sourceId}/{chunkIndex}.txt
  // search(query) -> hybrid lexical/vector search over fs_data + kv_store
}
```

### 4.3 Phase 8c: Turso Sync (Detailed)

**Goal:** Replace JSON snapshot sync with `@tursodatabase/sync` database-level replication.

```typescript
// packages/memory/src/sync/turso-sync-engine.ts
import { createClient } from '@tursodatabase/sync';

export interface TursoSyncEngine {
  sync(): Promise<SyncRunResult>;
  pause(): void;
  resume(): void;
  status(): SyncStatus;
}

export function createTursoSyncEngine(config: TursoSyncConfig): TursoSyncEngine {
  const client = createClient({
    url: config.url,
    authToken: config.authToken,
    syncUrl: config.syncUrl
  });

  return {
    async sync() {
      // Push local SQLite changes to Turso Cloud
      // Pull remote changes down
      // Conflict resolution at row level via last-write-wins or custom merge
      return client.sync();
    },
    pause() {
      /* stop background sync loop */
    },
    resume() {
      /* restart background sync loop */
    },
    status() {
      /* return sync status */
    }
  };
}
```

**Acceptance criteria:**

- `sync()` replicates the actual SQLite `.db` file, not JSON snapshots.
- Sync is bidirectional (local → remote, remote → local).
- Conflict resolution uses SQLite row-level timestamps, not whole-file replacement.
- Sync works with AgentFS schema natively — no translation layer.

---

## 5. Deprecations and Renames

### 5.1 Current `filesystem/agentfs/` module

The existing `packages/memory/src/filesystem/agentfs/` is **not** Turso AgentFS. It is a simple in-memory `Map<string, AgentFsEntry>` with no relation to the spec.

**Action:** Rename to avoid confusion.

```text
packages/memory/src/filesystem/agentfs/
  -> packages/memory/src/filesystem/internal-store/
```

All exports updated:

- `createAgentFsManager` → `createInternalStore`
- `AgentFsManager` → `InternalStore`
- `AgentFsEntry` → `InternalStoreEntry`

This module is used by tests and some internal utilities. It is **not** wired into the memory engine, wiki, or RAG. After Phase 8b, it can be deleted entirely (all consumers migrated to AgentFS adapters).

### 5.2 Custom Drizzle tables

The tables in `packages/memory/src/database/schema.ts` are replaced by AgentFS base tables.

**Migration strategy:**

1. Phase 8a creates AgentFS base tables alongside existing custom tables.
2. Phase 8b adapters read from/write to AgentFS tables.
3. A data migration script copies existing data from custom tables → AgentFS tables.
4. Phase 8c drops custom tables (after sync verification).

---

## 6. Files to Create / Modify

### New files

```text
packages/memory/src/agentfs/
  schema.ts              # AgentFS base SQL schema
  schema-domain.ts       # Domain views and triggers
  init.ts                # Database bootstrap (root dir, config)
  migrate.ts             # Migration runner
  tier-adapter.ts        # MemoryTierLike adapter
  wiki-adapter.ts        # WikiManager adapter
  rag-adapter.ts         # KnowledgeBaseManager adapter
  tool-auditor.ts        # Wraps McpToolHandlers to write tool_calls
  snapshot.ts            # SQLite-native snapshot/restore
  index.ts               # Barrel exports
  tests/
    schema.test.ts
    tier-adapter.test.ts
    wiki-adapter.test.ts
    rag-adapter.test.ts
    snapshot.test.ts
```

### Modified files

```text
packages/memory/src/database/schema.ts
  # Add AgentFS base tables; mark custom tables deprecated

packages/memory/src/database/migrate.ts
  # Add AgentFS initialization to migration sequence

packages/memory/src/cognitive/memory-engine.ts
  # Accept AgentFS db; use TierFsAdapter when AgentFS schema detected

packages/memory/src/wiki/wiki-manager.ts
  # Accept AgentFS db; use WikiFsAdapter when AgentFS schema detected

packages/memory/src/retrieval/rag/knowledge-base.ts
  # Accept AgentFS db; use RagFsAdapter when AgentFS schema detected

packages/memory/src/mcp/tools.ts
  # Wrap handlers with tool_auditor for AgentFS tool_calls

packages/memory/src/init.ts
  # Initialize AgentFS schema when db is provided

packages/memory/src/index.ts
  # Export new agentfs adapters
```

### Renamed files

```text
packages/memory/src/filesystem/agentfs/
  -> packages/memory/src/filesystem/internal-store/
```

---

## 7. Testing Strategy

| Layer          | Tests                      | Approach                                                             |
| -------------- | -------------------------- | -------------------------------------------------------------------- |
| AgentFS schema | `schema.test.ts`           | Verify all base tables exist, constraints hold, root dir initialized |
| Tier adapter   | `tier-adapter.test.ts`     | Round-trip read/write, TTL expiration, chunked large content         |
| Wiki adapter   | `wiki-adapter.test.ts`     | Page CRUD, history, search, backlinks, concept links                 |
| RAG adapter    | `rag-adapter.test.ts`      | Ingest, remove, hybrid search, source connectors                     |
| Snapshot       | `snapshot.test.ts`         | `VACUUM INTO`, restore, named snapshots                              |
| Unified query  | `unified-query.test.ts`    | **No changes needed** — tests already interface-agnostic             |
| MCP tools      | `mcp/tools.test.ts`        | **No changes needed** — tests already interface-agnostic             |
| Integration    | `init.integration.test.ts` | Full `initMemory()` with AgentFS db + all adapters                   |
| Migration      | `migration.test.ts`        | Custom table → AgentFS table data integrity                          |

---

## 8. Risk Analysis

| Risk                                | Mitigation                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Performance regression**          | Benchmark AgentFS KV vs custom Drizzle before full migration. Keep custom tables as fallback during transition. |
| **Schema compatibility**            | AgentFS spec is versioned (0.4). Pin to 0.4 and track upstream changes.                                         |
| **Turso sync latency**              | Sync is async; critical writes use `await sync()` before returning to caller.                                   |
| **Multi-agent whiteout complexity** | Defer overlay filesystem to Phase 9; Phase 8 uses single-agent flat namespace.                                  |
| **Data loss during migration**      | Always `VACUUM INTO` backup before schema changes. Test migration on copies.                                    |

---

## 9. Acceptance Criteria (Phase 8 Complete)

- [ ] AgentFS base tables (`fs_*`, `kv_store`, `tool_calls`) are the only storage schema in new databases.
- [ ] `MemoryEngine`, `WikiManager`, and `KnowledgeBaseManager` all operate through AgentFS adapters.
- [ ] `queryUnified()` returns results from all three layers without code changes.
- [ ] Every MCP tool invocation is recorded in `tool_calls`.
- [ ] Turso sync replicates the `.db` file bidirectionally with row-level conflict resolution.
- [ ] Snapshots use SQLite native backup, not in-memory clones.
- [ ] Old custom Drizzle tables are dropped (after migration verification).
- [ ] `pnpm test` passes (565+ tests).
- [ ] `pnpm check-types` passes.
- [ ] `pnpm build` produces valid DTS.

---

## 10. Glossary

- **AgentFS** — The [Turso AgentFS specification](https://github.com/tursodatabase/agentfs/blob/main/SPEC.md): a SQLite-based filesystem for agents.
- **Base table** — An AgentFS-spec-defined table (`fs_inode`, `fs_data`, etc.).
- **Domain adapter** — Our code that implements `MemoryTierLike`, `WikiManager`, or `KnowledgeBaseManager` by reading/writing AgentFS base tables.
- **Storage-agnostic interface** — An API (like `queryUnified`) that does not know which storage layer is underneath.
- **Whiteout** — An overlay filesystem marker indicating a path has been explicitly deleted (used for agent sandboxing).
