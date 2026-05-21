# @agentsy/memory — Implementation Gap Analysis & Remediation Plan

## Executive Summary

`@agentsy/memory` has seven fully implemented **functional layers** (cognitive tiers, wiki, RAG, sync, MCP, hooks, CLI) but they are **not integrated**. Each layer operates in isolation with in-memory storage. The intended architecture — a unified SQLite-backed system where cognitive memory, wiki pages, and RAG documents coexist in one database, are queryable through one interface, and replicate through one sync layer — does not yet exist.

This plan describes how to close those gaps.

---

## Current State vs. Intended Architecture

### What exists today (all in-memory)

| Layer                                      | Status        | Storage                                               |
| ------------------------------------------ | ------------- | ----------------------------------------------------- |
| `MemoryEngine` + 5 tiers                   | ✅ Functional | `Map<string, MemoryItem>`                             |
| `WikiManager`                              | ✅ Functional | `Map<string, WikiPage>` + `Map<string, VectorEntry>`  |
| `KnowledgeBaseManager` + `HybridRetriever` | ✅ Functional | `Map<string, HybridRecord>` + `Map<string, number[]>` |
| `TursoManager` + sync                      | ✅ Functional | Serializes in-memory state to `SyncSnapshot` JSON     |
| MCP server (`memory_*` tools)              | ✅ Functional | Talks to `MemoryEngine` only                          |
| Hooks (`onSessionStart`, etc.)             | ✅ Functional | Talks to `MemoryEngine` only                          |
| CLI (`agentsy-memory`)                     | ✅ Functional | Starts MCP server with `MemoryEngine` only            |

### What is missing

| Gap                                                                    | Impact                                                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| No SQLite persistence for any layer                                    | Everything is ephemeral                                                       |
| `initMemory()` does not create a SQLite DB                             | `db.path` in config is unused                                                 |
| MemoryEngine, WikiManager, KnowledgeBaseManager are not wired together | `memory_recall` cannot find wiki pages; wiki search cannot find tier memories |
| MCP server has no wiki or RAG tools                                    | Agents cannot query the wiki or knowledge base via MCP                        |
| Sync layer serializes in-memory state instead of syncing the actual DB | Turso sync works but is a workaround                                          |
| Honker extensions are loaded but never used for storage primitives     | Coordination primitives are in-memory even when Honker is available           |

---

## Phased Remediation Plan

---

## Phase 1: Unified SQLite Persistence Layer

**Goal:** Create a single SQLite database that stores memory tiers, wiki pages, RAG documents, and sync state. All existing in-memory implementations gain an optional database adapter.

### 1.1 Schema design

Create `src/database/schema.ts` and `src/database/migrations.ts`.

**`memory_items`** — Cognitive tier storage

```sql
CREATE TABLE memory_items (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL CHECK(tier IN ('sensory_buffer','sensory_register','working_memory','short_term_memory','long_term_memory')),
  kind TEXT NOT NULL CHECK(kind IN ('semantic','episodic','procedural','sensory')),
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  importance REAL NOT NULL,
  write_heap TEXT NOT NULL CHECK(write_heap IN ('event','query','doc','ref')),
  reuse_class TEXT NOT NULL CHECK(reuse_class IN ('hot','warm','cold')),
  created_at INTEGER NOT NULL,  -- performance.now() timestamp
  last_accessed_at INTEGER NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  fingerprint TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'  -- JSON
);

CREATE INDEX idx_memory_items_tier ON memory_items(tier);
CREATE INDEX idx_memory_items_importance ON memory_items(importance DESC);
CREATE INDEX idx_memory_items_kind ON memory_items(kind);
CREATE INDEX idx_memory_items_created ON memory_items(created_at DESC);
CREATE INDEX idx_memory_items_fingerprint ON memory_items(fingerprint);
```

**`wiki_pages`** — Wiki storage

```sql
CREATE TABLE wiki_pages (
  page_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',  -- JSON array
  format TEXT NOT NULL CHECK(format IN ('markdown','text','code','json')),
  writer_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE wiki_pages_fts USING fts5(page_id, title, body);
```

**`wiki_page_history`** — Version history

```sql
CREATE TABLE wiki_page_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT NOT NULL REFERENCES wiki_pages(page_id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  edited_at INTEGER NOT NULL
);
```

**`wiki_vectors`** — Embeddings for wiki pages

```sql
CREATE TABLE wiki_vectors (
  page_id TEXT PRIMARY KEY REFERENCES wiki_pages(page_id) ON DELETE CASCADE,
  embedding TEXT NOT NULL  -- JSON array of floats
);
```

**`wiki_concepts`** — Concept relations

```sql
CREATE TABLE wiki_concepts (
  from_page_id TEXT NOT NULL REFERENCES wiki_pages(page_id) ON DELETE CASCADE,
  to_page_id TEXT NOT NULL REFERENCES wiki_pages(page_id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  PRIMARY KEY (from_page_id, to_page_id, relation)
);
```

**`wiki_backlinks`** — Page navigation

```sql
CREATE TABLE wiki_backlinks (
  from_page_id TEXT NOT NULL REFERENCES wiki_pages(page_id) ON DELETE CASCADE,
  to_page_id TEXT NOT NULL REFERENCES wiki_pages(page_id) ON DELETE CASCADE,
  PRIMARY KEY (from_page_id, to_page_id)
);
```

**`rag_documents`** — RAG chunked documents

```sql
CREATE TABLE rag_documents (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('wiki','file','document','web')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE VIRTUAL TABLE rag_documents_fts USING fts5(id, title, content);
```

**`rag_vectors`** — RAG embeddings

```sql
CREATE TABLE rag_vectors (
  doc_id TEXT PRIMARY KEY REFERENCES rag_documents(id) ON DELETE CASCADE,
  embedding TEXT NOT NULL
);
```

**`sync_state`** — Sync cursor and metadata

```sql
CREATE TABLE sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

**`sync_conflicts`** — Unresolved conflicts

```sql
CREATE TABLE sync_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_key TEXT NOT NULL,
  local_record TEXT NOT NULL,
  remote_record TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

### 1.2 Database adapter abstraction

Create `src/database/adapter.ts`:

```typescript
export interface DatabaseAdapter {
  exec(sql: string, params?: unknown[]): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
```

Create `src/database/sqlite-adapter.ts`:

- Uses `@tursodatabase/sync` (or `better-sqlite3` if that's the actual dependency) to connect to the SQLite file.
- Implements `DatabaseAdapter`.
- Handles connection pooling, prepared statements, and transactions.

Create `src/database/memory-adapter.ts`:

- In-memory fallback implementing `DatabaseAdapter`.
- Uses Maps to simulate tables.
- Enables existing tests to run without SQLite.

### 1.3 Migration system

Create `src/database/migrate.ts`:

- Tracks schema version in `sync_state` table.
- Runs migrations on startup if `user_version` is behind.
- Migrations are idempotent SQLite scripts stored as strings.

### 1.4 Factory

```typescript
export async function createDatabaseAdapter(config: { path: string }): Promise<DatabaseAdapter>;
export function createInMemoryDatabaseAdapter(): DatabaseAdapter;
```

**Acceptance criteria:**

- `pnpm test` passes with both SQLite and in-memory adapters.
- Schema creates all tables and indexes on first run.
- Migrations apply incrementally.

---

## Phase 2: Wire SQLite into MemoryEngine

**Goal:** `MemoryEngine` reads from and writes to SQLite, with an in-memory cache for hot paths.

### 2.1 Modify `MemoryTierLike`

Add optional `dbAdapter` to `MemoryTierOptions`:

```typescript
export interface MemoryTierOptions {
  config: TierConfig;
  dbAdapter?: DatabaseAdapter;
  cache?: { enabled: boolean; maxItems: number };
  now?: (() => number) | undefined;
}
```

### 2.2 Modify `createMemoryTier`

When `dbAdapter` is provided:

- `write(item)` → `INSERT OR REPLACE INTO memory_items (...)` + update in-memory cache.
- `read(query)` → `SELECT * FROM memory_items WHERE tier = ? AND importance >= ? ...` + populate cache.
- `capacity()` → `SELECT COUNT(*), SUM(token_count) FROM memory_items WHERE tier = ?`.
- `evict(count)` → `DELETE FROM memory_items WHERE tier = ? ORDER BY importance ASC LIMIT ?`.
- `promote(count, to)` → `UPDATE memory_items SET tier = ?, access_count = access_count + 1 WHERE id IN (...)`.

When `dbAdapter` is absent, keep existing in-memory behavior.

### 2.3 Modify `createMemoryEngine`

```typescript
export interface MemoryEngineOptions {
  dbAdapter?: DatabaseAdapter;
  // ... existing options
}
```

In `createMemoryEngine()`:

- If `dbAdapter` is provided, pass it to all tier constructors.
- On startup, load recent items from DB into in-memory cache.
- On `reset()`, clear DB records AND in-memory state.

### 2.4 Update `initMemory()`

```typescript
export async function initMemory(options: InitOptions = {}): Promise<InitResult> {
  const config = loadConfig(options.config);
  const dbAdapter = options.skipDb
    ? createInMemoryDatabaseAdapter()
    : await createDatabaseAdapter({ path: config.db.path });

  // Run migrations
  await migrateDatabase(dbAdapter);

  const engine = createMemoryEngine({
    dbAdapter,
    ...options.engine
  });

  // ... rest of existing init logic
}
```

**Acceptance criteria:**

- `initMemory()` creates `.agentsy/memory.db` if it doesn't exist.
- `engine.ingest()` persists to SQLite.
- `engine.recall()` reads from SQLite.
- `engine.reset()` clears the database.
- Existing tests still pass with in-memory adapter.
- New test file `memory-engine.sqlite.test.ts` validates persistence.

---

## Phase 3: Wire SQLite into WikiManager

**Goal:** `WikiManager` stores pages, history, vectors, concepts, and backlinks in SQLite. FTS5 enables fast full-text search.

### 3.1 Modify `WikiManagerDependencies`

```typescript
export interface WikiManagerDependencies {
  dbAdapter?: DatabaseAdapter;
  contentProcessor?: ContentProcessor;
  entityExtractor?: EntityExtractor;
  embeddingEngine?: LocalEmbeddingEngine;
  versionTracker?: VersionTracker;
  navigation?: NavigationSystem;
}
```

### 3.2 Implement SQL-backed methods

| Method                  | SQLite Operation                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `captureRaw()`          | `INSERT INTO memory_items (tier='sensory_buffer', kind='episodic', content=?, ...)` — also inserts into cognitive memory! |
| `upsertPage()`          | `INSERT OR REPLACE INTO wiki_pages ...` + `INSERT INTO wiki_page_history ...` + `INSERT INTO wiki_vectors ...`            |
| `getPage()`             | `SELECT * FROM wiki_pages WHERE page_id = ?`                                                                              |
| `updatePage()`          | `UPDATE wiki_pages SET ...` + `INSERT INTO wiki_page_history ...`                                                         |
| `getPageHistory()`      | `SELECT * FROM wiki_page_history WHERE page_id = ? ORDER BY version DESC`                                                 |
| `diffPageVersions()`    | Query two history rows, compute diff                                                                                      |
| `searchFullText()`      | `SELECT * FROM wiki_pages_fts WHERE wiki_pages_fts MATCH ?`                                                               |
| `searchVector()`        | Load embedding from `wiki_vectors`, compute cosine similarity in SQL or TS                                                |
| `searchHybrid()`        | Combine FTS5 + vector scores                                                                                              |
| `extractEntities()`     | Run entity extractor on page content, cache in `metadata`                                                                 |
| `linkConcepts()`        | `INSERT INTO wiki_concepts ...`                                                                                           |
| `getConceptRelations()` | `SELECT * FROM wiki_concepts WHERE from_page_id = ?`                                                                      |
| `linkPages()`           | `INSERT INTO wiki_backlinks ...`                                                                                          |
| `getBacklinks()`        | `SELECT from_page_id FROM wiki_backlinks WHERE to_page_id = ?`                                                            |

### 3.3 Important: `captureRaw` integration

When `captureRaw()` is called, it should **also** insert the raw content into the cognitive tier engine (sensory_buffer) as an `episodic` memory. This is the first step in unifying the layers.

```typescript
async function captureRaw(input: RawCaptureInput): Promise<RawCapture> {
  const capture = /* ... build RawCapture ... */;

  // Also store in cognitive memory
  if (engine) {
    engine.ingest(capture.content, {
      kind: 'episodic',
      writeHeap: 'event',
      importance: 0.5
    });
  }

  return capture;
}
```

**Acceptance criteria:**

- `createWikiManager({ dbAdapter })` persists to SQLite.
- FTS5 search returns results.
- Page history and diffs work.
- `captureRaw` also creates a cognitive memory item.
- Tests pass with both SQLite and in-memory adapters.

---

## Phase 4: Wire SQLite into RAG Knowledge Base

**Goal:** `KnowledgeBaseManager` and `HybridRetriever` use SQLite for documents, vectors, and search.

### 4.1 Modify `KnowledgeBaseManager`

```typescript
export interface KnowledgeBaseManager {
  ingest(source: IngestSource): Promise<IngestSummary>;
  remove(documentId: string): Promise<boolean>;
  search(input: { query: string; scope?: string; limit?: number; weights: RAGWeightConfig }): Promise<RAGEvidence[]>;
}

export interface KnowledgeBaseManagerOptions {
  dbAdapter?: DatabaseAdapter;
  embeddingEngine?: LocalEmbeddingEngine;
}
```

### 4.2 Implement SQL-backed RAG

| Method     | SQLite Operation                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ingest()` | Chunk content → `INSERT INTO rag_documents ...` for each chunk → `INSERT INTO rag_vectors ...` → `INSERT INTO rag_documents_fts ...` |
| `remove()` | `DELETE FROM rag_documents WHERE id = ?` (cascade deletes vectors and FTS)                                                           |
| `search()` | FTS5 query + vector similarity + entity match + temporal decay                                                                       |

### 4.3 Hybrid search in SQL

For `search()`:

1. Run FTS5 query: `SELECT id, rank FROM rag_documents_fts WHERE rag_documents_fts MATCH ?`.
2. Get vector for query from `embeddingEngine.embed(query)`.
3. For each candidate, load vector from `rag_vectors`, compute cosine similarity.
4. Load metadata, compute entity score.
5. Compute temporal score from `updated_at`.
6. Combine: `vector*0.4 + lexical*0.3 + entity*0.2 + temporal*0.1`.
7. Return sorted, truncated results.

### 4.4 Integration with wiki

When a wiki page is upserted, it should **automatically** be ingested into the RAG knowledge base:

```typescript
// In WikiManager.upsertPage()
if (knowledgeBase) {
  await knowledgeBase.ingest({
    sourceId: `wiki:${page.pageId}`,
    sourceType: 'wiki',
    title: page.title,
    content: page.body,
    metadata: { tags: page.tags, writerIds: page.writerIds }
  });
}
```

**Acceptance criteria:**

- `kb.ingest()` persists to SQLite.
- `kb.search()` returns results using FTS5 + vector + entity + temporal.
- `kb.remove()` deletes from all tables.
- Wiki page upserts automatically appear in RAG search.
- Tests pass with both adapters.

---

## Phase 5: Unified Query Interface

**Goal:** One query searches memory tiers, wiki pages, and RAG documents simultaneously. Results are ranked and attributed by source.

### 5.1 Create `UnifiedMemoryQuery`

```typescript
export interface UnifiedMemoryQuery {
  query: string;
  limit?: number;
  includeTiers?: TierName[];
  includeWiki?: boolean;
  includeRAG?: boolean;
  minImportance?: number;
  weights?: {
    tierMemory: number;
    wiki: number;
    rag: number;
  };
}

export interface UnifiedMemoryResult {
  source: 'tier' | 'wiki' | 'rag';
  id: string;
  title?: string;
  content: string;
  score: number;
  tier?: TierName;
  pageId?: string;
  citations?: RAGEvidenceCitation[];
}
```

### 5.2 Implement `queryUnified()`

Create `src/unified-query.ts`:

```typescript
export async function queryUnified(
  engine: MemoryEngine,
  wiki: WikiManager,
  kb: KnowledgeBaseManager,
  query: UnifiedMemoryQuery
): Promise<UnifiedMemoryResult[]> {
  const results: UnifiedMemoryResult[] = [];

  // Query tiers
  if (query.includeTiers !== false) {
    const tierResults = engine.recall({
      query: query.query,
      tiers: query.includeTiers,
      crossTier: true,
      minImportance: query.minImportance ?? 0.3,
      limit: query.limit
    });
    for (const tierResult of tierResults) {
      for (const item of tierResult.items) {
        results.push({
          source: 'tier',
          id: item.id,
          content: item.content,
          score: item.importance,
          tier: tierResult.tierName
        });
      }
    }
  }

  // Query wiki
  if (query.includeWiki !== false) {
    const wikiResults = await wiki.searchHybrid(query.query, embeddingEngine.embed(query.query), query.limit ?? 5);
    for (const wr of wikiResults) {
      const page = await wiki.getPage(wr.pageId);
      if (page) {
        results.push({
          source: 'wiki',
          id: wr.pageId,
          title: page.title,
          content: page.body.slice(0, 500),
          score: wr.score
        });
      }
    }
  }

  // Query RAG
  if (query.includeRAG !== false) {
    const ragResults = await kb.search({
      query: query.query,
      limit: query.limit ?? 5,
      weights: { vector: 0.4, lexical: 0.3, entity: 0.2, temporal: 0.1 }
    });
    for (const rr of ragResults) {
      results.push({
        source: 'rag',
        id: rr.id,
        title: rr.title,
        content: rr.content,
        score: rr.score,
        citations: rr.citations
      });
    }
  }

  // Re-rank combined results
  const weights = query.weights ?? { tierMemory: 0.3, wiki: 0.3, rag: 0.4 };
  results.sort((a, b) => {
    const wa = weights[`${a.source}Memory` as keyof typeof weights] ?? weights[a.source as keyof typeof weights] ?? 0.3;
    const wb = weights[`${b.source}Memory` as keyof typeof weights] ?? weights[b.source as keyof typeof weights] ?? 0.3;
    return b.score * wb - a.score * wa;
  });

  return results.slice(0, query.limit ?? 10);
}
```

### 5.3 Use unified query in MCP

Modify `memory_recall` and `memory_search` MCP tools to accept a new `scope` argument:

```json
{
  "tool": "memory_recall",
  "arguments": {
    "query": "OAuth",
    "scope": "unified", // "tiers" | "wiki" | "rag" | "unified" (default)
    "limit": 5
  }
}
```

When `scope` is `"unified"` or omitted, search all three layers.

**Acceptance criteria:**

- `queryUnified()` returns results from all three layers.
- Results are ranked by weighted score.
- Each result includes `source` attribution.
- MCP `memory_recall` with `"scope": "unified"` returns combined results.

---

## Phase 5b: CLI Commands for Wiki, RAG, and Retrieval

**Goal:** The `agentsy-memory` CLI exposes all wiki and RAG operations, so users and scripts can manage knowledge without writing JavaScript.

### 5b.1 Wiki commands

| Command                         | Description                       | Flags                                                                |
| ------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `agentsy-memory wiki:page`      | Get a page by ID                  | `--page-id`                                                          |
| `agentsy-memory wiki:upsert`    | Create or update a page           | `--page-id`, `--title`, `--body`, `--tags`, `--format`, `--actor-id` |
| `agentsy-memory wiki:update`    | Patch an existing page            | `--page-id`, `--body`, `--title`, `--tags`, `--actor-id`             |
| `agentsy-memory wiki:search`    | Search pages (fulltext or hybrid) | `--query`, `--type` (`fulltext`/`hybrid`), `--limit`                 |
| `agentsy-memory wiki:list`      | List all pages                    | `--limit`, `--tag`                                                   |
| `agentsy-memory wiki:history`   | Show version history              | `--page-id`                                                          |
| `agentsy-memory wiki:diff`      | Diff two versions                 | `--page-id`, `--from`, `--to`                                        |
| `agentsy-memory wiki:entities`  | Extract entities from a page      | `--page-id`                                                          |
| `agentsy-memory wiki:link`      | Link two pages                    | `--from`, `--to`                                                     |
| `agentsy-memory wiki:backlinks` | Get backlinks for a page          | `--page-id`                                                          |
| `agentsy-memory wiki:concepts`  | Get concept relations             | `--page-id`                                                          |
| `agentsy-memory wiki:delete`    | Delete a page                     | `--page-id`                                                          |
| `agentsy-memory wiki:capture`   | Capture raw content as a page     | `--source-id`, `--source-type`, `--content`, `--title`               |

### 5b.2 RAG / knowledge base commands

| Command                         | Description                   | Flags                                                                          |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `agentsy-memory kb:ingest`      | Ingest a document             | `--source-id`, `--source-type`, `--title`, `--content`, `--file`, `--metadata` |
| `agentsy-memory kb:ingest-file` | Ingest a local file           | `--file`, `--source-id`, `--source-type`                                       |
| `agentsy-memory kb:ingest-web`  | Ingest a web page             | `--url`, `--source-id`, `--allow-host`                                         |
| `agentsy-memory kb:search`      | Search the knowledge base     | `--query`, `--limit`, `--scope`, `--weights`                                   |
| `agentsy-memory kb:remove`      | Remove a document             | `--document-id`                                                                |
| `agentsy-memory kb:stats`       | Show KB stats                 | —                                                                              |
| `agentsy-memory kb:bootstrap`   | Bulk ingest from a directory  | `--dir`, `--pattern`                                                           |
| `agentsy-memory kb:pack`        | Pack evidence for LLM context | `--query`, `--max-tokens`, `--output`                                          |

### 5b.3 Retrieval / embedding commands

| Command                   | Description                           | Flags                                                                                |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `agentsy-memory retrieve` | Unified search across all layers      | `--query`, `--scope` (`tiers`/`wiki`/`rag`/`unified`), `--limit`, `--min-importance` |
| `agentsy-memory embed`    | Generate an embedding for text        | `--text`, `--dimensions`                                                             |
| `agentsy-memory context`  | Build citation-preserving context XML | `--query`, `--max-tokens`, `--output`                                                |

### 5b.4 Memory tier commands

| Command                       | Description                   | Flags                                           |
| ----------------------------- | ----------------------------- | ----------------------------------------------- |
| `agentsy-memory tier:list`    | List memories in a tier       | `--tier`, `--limit`                             |
| `agentsy-memory tier:ingest`  | Ingest directly into a tier   | `--content`, `--tier`, `--importance`, `--kind` |
| `agentsy-memory tier:evict`   | Evict lowest-importance items | `--tier`, `--count`                             |
| `agentsy-memory tier:promote` | Manually promote items        | `--tier`, `--count`                             |
| `agentsy-memory tier:stats`   | Detailed tier stats           | `--tier`                                        |

### 5b.5 Implementation

Create command files under `src/commands/`:

```
src/commands/
  wiki/
    page.ts
    upsert.ts
    update.ts
    search.ts
    list.ts
    history.ts
    diff.ts
    entities.ts
    link.ts
    backlinks.ts
    concepts.ts
    delete.ts
    capture.ts
  kb/
    ingest.ts
    ingest-file.ts
    ingest-web.ts
    search.ts
    remove.ts
    stats.ts
    bootstrap.ts
    pack.ts
  retrieve.ts
  embed.ts
  context.ts
  tier/
    list.ts
    ingest.ts
    evict.ts
    promote.ts
    stats.ts
```

Each command:

1. Loads config via `loadConfig()`.
2. Creates the appropriate manager (wiki, kb, engine) using the database adapter.
3. Executes the operation.
4. Outputs results as JSON (default) or human-readable text (with `--format text`).

**Acceptance criteria:**

- All commands listed above exist and are discoverable via `agentsy-memory --help`.
- Each command has `--help` with examples.
- Output is valid JSON by default (parseable by scripts).
- `--format text` produces human-readable tables/lists.
- Commands use the same database adapter as the MCP server and daemon.
- Tests in `src/commands/*.test.ts` cover each command.

---

## Phase 6: MCP Tools for Wiki and RAG

**Goal:** Agents can manage wiki pages and query the knowledge base through MCP.

### 6.1 Wiki tools

| Tool                 | Arguments                                              | Returns                      |
| -------------------- | ------------------------------------------------------ | ---------------------------- |
| `wiki_upsert_page`   | `pageId`, `title`, `body`, `tags`, `format`, `actorId` | Page ID                      |
| `wiki_get_page`      | `pageId`                                               | Page content, history, tags  |
| `wiki_search`        | `query`, `limit`, `type` (`'fulltext'` or `'hybrid'`)  | Array of pages               |
| `wiki_list_pages`    | `limit`, `tag`                                         | Array of page IDs and titles |
| `wiki_update_page`   | `pageId`, `body`, `title`, `tags`, `actorId`           | Updated page                 |
| `wiki_link_pages`    | `fromPageId`, `toPageId`                               | Success                      |
| `wiki_get_backlinks` | `pageId`                                               | Array of page IDs            |

### 6.2 RAG / knowledge base tools

| Tool        | Arguments                                                | Returns                          |
| ----------- | -------------------------------------------------------- | -------------------------------- |
| `kb_ingest` | `sourceId`, `sourceType`, `title`, `content`, `metadata` | Ingest summary                   |
| `kb_search` | `query`, `limit`, `scope`                                | Array of evidence                |
| `kb_remove` | `documentId`                                             | Success                          |
| `kb_stats`  | —                                                        | Document count, source breakdown |

### 6.3 Implementation

Add to `src/mcp/tools.ts`:

- Import `WikiManager` and `KnowledgeBaseManager` types.
- Add tool definitions and handlers for all wiki and RAG tools.
- The `createMemoryMcpTools()` function should accept `wiki` and `kb` as optional dependencies.
- If they are not provided, those tools return "Not configured" errors.

### 6.4 Update `createMemoryMCPServer`

```typescript
export async function createMemoryMCPServer(
  engine: MemoryEngine,
  options: MemoryMCPServerOptions = {},
  wiki?: WikiManager,
  kb?: KnowledgeBaseManager
): Promise<MemoryMCPServer> {
  const { definitions, handlers } = createMemoryMcpTools(engine, wiki, kb);
  // ...
}
```

**Acceptance criteria:**

- All wiki and RAG tools are exposed via MCP.
- Tools return proper JSON-RPC responses.
- Missing dependencies return graceful error messages.
- Tests in `mcp/tools.test.ts` cover new tools.

---

## Phase 7: Unified Initialization

**Goal:** `initMemory()` creates and wires together the entire system: SQLite DB, MemoryEngine, WikiManager, KnowledgeBaseManager, and MCP server.

### 7.1 New `InitResult`

```typescript
export interface InitResultWithServer {
  engine: MemoryEngine;
  wiki: WikiManager;
  knowledgeBase: KnowledgeBaseManager;
  config: MemoryConfig;
  server: MemoryMCPServer;
  dbAdapter: DatabaseAdapter;
}

export interface InitResultWithoutServer {
  engine: MemoryEngine;
  wiki: WikiManager;
  knowledgeBase: KnowledgeBaseManager;
  config: MemoryConfig;
  dbAdapter: DatabaseAdapter;
}
```

### 7.2 New `initMemory()` implementation

```typescript
export async function initMemory(options: InitOptions = {}): Promise<InitResult> {
  const config = loadConfig(options.config);

  // 1. Create database adapter
  const dbAdapter = options.skipDb
    ? createInMemoryDatabaseAdapter()
    : await createDatabaseAdapter({ path: config.db.path });

  // 2. Run migrations
  await migrateDatabase(dbAdapter);

  // 3. Build engine options from config
  const engineOptions = buildEngineOptions(config, options.engine);
  engineOptions.dbAdapter = dbAdapter;

  // 4. Create engine
  const engine = createMemoryEngine(engineOptions);

  // 5. Create wiki manager (with engine reference for captureRaw integration)
  const wiki = createWikiManager({
    dbAdapter,
    embeddingEngine: createLocalEmbeddingEngine({ dimensions: 64 })
  });

  // 6. Create knowledge base
  const kb = createKnowledgeBaseManager({
    dbAdapter,
    embeddingEngine: createLocalEmbeddingEngine({ dimensions: 64 })
  });

  // 7. Wire wiki → knowledge base auto-ingestion
  wiki.onPageUpsert = async (page: WikiPage) => {
    await kb.ingest({
      sourceId: `wiki:${page.pageId}`,
      sourceType: 'wiki',
      title: page.title,
      content: page.body,
      metadata: { tags: page.tags, writerIds: page.writerIds, version: page.version }
    });
  };

  // 8. Optionally create MCP server
  if (!options.skipMcp) {
    const server = await createMemoryMCPServer(engine, config.mcp, wiki, kb);
    return { engine, wiki, knowledgeBase: kb, config, server, dbAdapter };
  }

  return { engine, wiki, knowledgeBase: kb, config, dbAdapter };
}
```

### 7.3 Update hooks

Modify hooks to accept `wiki` and `kb`:

```typescript
export interface OnSessionStartInput {
  engine: MemoryEngine;
  wiki?: WikiManager;
  knowledgeBase?: KnowledgeBaseManager;
  userId?: string;
  projectId?: string;
}
```

In `onSessionStart`:

- Recall from tiers (existing).
- Also recall from wiki: `wiki.searchHybrid(query, embedding, 5)`.
- Also recall from KB: `kb.search({ query, limit: 5, weights: ... })`.
- Combine into `warmMemories`.

**Acceptance criteria:**

- `initMemory()` returns `engine`, `wiki`, `knowledgeBase`, `dbAdapter`.
- All components share the same SQLite database.
- Wiki page upserts automatically appear in KB search.
- Hooks can query all three layers.

---

## Phase 8: Real Turso Sync (Database-Level)

**Goal:** Instead of serializing in-memory state to JSON snapshots, sync the actual SQLite database with Turso Cloud.

### 8.1 Current workaround

Today, `TursoManager.sync()` takes a `SyncSnapshot` (JSON), resolves conflicts, and uploads the merged JSON. The actual SQLite file is not synced.

### 8.2 Intended behavior

Use `@tursodatabase/sync` (the actual package) to:

1. Open the local SQLite file as a Turso embedded database.
2. Use Turso's built-in sync protocol to replicate changes to Turso Cloud.
3. Conflict resolution happens at the row level in SQLite.

### 8.3 Implementation

Create `src/sync/turso-sync-engine.ts`:

```typescript
import { connect } from '@tursodatabase/database'; // or @tursodatabase/sync

export interface TursoSyncEngine {
  sync(): Promise<SyncRunResult>;
  pause(): void;
  resume(): void;
}

export function createTursoSyncEngine(config: TursoSyncConfig): TursoSyncEngine {
  // Use @tursodatabase/sync to connect to local DB with remote URL
  // Call sync() to push/pull changes
  // Handle conflicts via mergePolicy
}
```

### 8.4 Update `createTursoManager`

Replace the JSON snapshot approach with `createTursoSyncEngine()` when the Turso SDK is available.

### 8.5 Honker integration

When Honker extensions are loaded, use them for:

- `pubsub_publish('memory/ingest', JSON.stringify(item))` on each memory write
- `task_enqueue('awaken', { timestamp: now() })` for scheduled awaken calls
- `schedule_run()` for periodic sync and decay

**Acceptance criteria:**

- Turso sync replicates the actual SQLite file, not JSON snapshots.
- Sync is bidirectional (local changes push, remote changes pull).
- Conflict resolution works at the row level.
- Honker primitives are used when available.

---

## Phase 9: Agent Learning and Self-Improvement

**Goal:** The learning loop (`engine.awaken({ runLearningCycle: true })`) uses the wiki as a source of truth to validate and consolidate memories.

### 9.1 Current learning loop

The learning loop (Phase 6) already exists:

1. Observation extraction
2. Dialectic resolution
3. Multi-specialist consolidation
4. Solidification
5. Canary detection

But it only operates on `MemoryItem[]` from the tier engine. It does not consult the wiki or RAG.

### 9.2 Wiki-validated consolidation

Modify `createLearningLoopOrchestrator()` to accept `wiki` and `kb`:

```typescript
export interface LearningLoopOrchestratorOptions {
  engine: MemoryEngine;
  wiki?: WikiManager;
  knowledgeBase?: KnowledgeBaseManager;
  now?: () => number;
}
```

In the consolidation step:

- For each candidate memory, search the wiki for corroborating or contradicting pages.
- If the wiki has a page on the same topic with higher confidence, promote the memory to LTM.
- If the wiki contradicts the memory, flag it for review or demote it.
- If the memory contains novel information not in the wiki, suggest a wiki page update.

### 9.3 Auto-wiki-updates

After `awaken()` completes, if the learning cycle extracted new facts:

```typescript
// In awaken() or the learning loop
for (const fact of learningCycle.consolidations) {
  const existing = await wiki.getPage(fact.topic);
  if (!existing) {
    // Suggest creating a new wiki page
    await wiki.upsertPage({
      pageId: slugify(fact.topic),
      title: fact.topic,
      body: fact.summary,
      tags: ['auto-generated'],
      actorId: 'learning-loop'
    });
  } else {
    // Append to existing page with a note
    await wiki.updatePage(
      existing.pageId,
      {
        body: existing.body + '\n\n## Update\n' + fact.summary
      },
      'learning-loop'
    );
  }
}
```

**Acceptance criteria:**

- Learning loop queries the wiki during consolidation.
- Conflicts between memories and wiki pages are detected.
- New facts can auto-generate or update wiki pages.
- Canary checks compare LTM against wiki for staleness.

---

## Phase 10: Documentation and Testing

### 10.1 Update README.md

- Remove "in-memory" caveat.
- Document unified query (`memory_recall` searches all layers).
- Document new MCP tools (`wiki_*`, `kb_*`).
- Document SQLite backend and Honker extensions.

### 10.2 Update AGENTS.md

- Add instructions for wiki tools (`wiki_upsert_page`, `wiki_search`, etc.).
- Add instructions for knowledge base tools (`kb_ingest`, `kb_search`).
- Update retrieval patterns: `memory_recall` with `"scope": "unified"` searches everything.
- Add workflow: "When you learn something from a web search, store it in both memory AND the wiki."

### 10.3 Update docs/packages/memory.md

- Remove "Known limitations" section (or shrink it).
- Document the unified architecture.
- Document SQLite schema.
- Document Honker integration.
- Add examples for unified queries and wiki/RAG MCP tools.

### 10.4 Testing

Create test files:

- `src/database/adapter.test.ts` — SQLite adapter basics
- `src/database/migrations.test.ts` — Migration application
- `src/cognitive/memory-engine.sqlite.test.ts` — Persistence round-trip
- `src/wiki/wiki-manager.sqlite.test.ts` — Wiki persistence
- `src/retrieval/rag/knowledge-base.sqlite.test.ts` — RAG persistence
- `src/unified-query.test.ts` — Combined search
- `src/mcp/tools-wiki.test.ts` — Wiki MCP tools
- `src/mcp/tools-rag.test.ts` — RAG MCP tools
- `src/commands/wiki/*.test.ts` — Wiki CLI commands
- `src/commands/kb/*.test.ts` — KB CLI commands
- `src/commands/retrieve.test.ts` — Unified retrieval CLI
- `src/commands/tier/*.test.ts` — Tier CLI commands
- `src/init.integration.test.ts` — Full `initMemory()` with all layers

**Acceptance criteria:**

- All existing tests still pass.
- New SQLite-backed tests pass.
- `pnpm check-types` passes.
- `pnpm test` passes (492+ existing + ~100 new tests).

---

## Implementation Order

| Phase                                         | Duration | Depends on           |
| --------------------------------------------- | -------- | -------------------- |
| Phase 1: SQLite persistence layer             | 3–4 days | —                    |
| Phase 2: Wire SQLite into MemoryEngine        | 2–3 days | Phase 1              |
| Phase 3: Wire SQLite into WikiManager         | 2–3 days | Phase 1              |
| Phase 4: Wire SQLite into RAG KB              | 2–3 days | Phase 1, Phase 3     |
| Phase 5: Unified query interface              | 1–2 days | Phase 2, 3, 4        |
| Phase 5b: CLI commands for wiki/RAG/retrieval | 3–4 days | Phase 2, 3, 4        |
| Phase 6: MCP tools for wiki/RAG               | 2–3 days | Phase 3, 4, 5        |
| Phase 7: Unified initialization               | 1–2 days | Phase 2, 3, 4, 5b, 6 |
| Phase 8: Real Turso sync                      | 3–4 days | Phase 1, 7           |
| Phase 9: Learning + wiki validation           | 2–3 days | Phase 3, 4, 7        |
| Phase 10: Docs + testing                      | 2–3 days | All above            |

**Total estimated effort: 23–33 days.**

---

## Files to create

```
src/database/
  adapter.ts              # DatabaseAdapter interface
  sqlite-adapter.ts       # SQLite implementation
  memory-adapter.ts       # In-memory fallback
  schema.ts               # SQL schema definitions
  migrations.ts           # Migration scripts
  migrate.ts              # Migration runner

src/unified-query.ts      # queryUnified() function

src/mcp/
  wiki-tools.ts           # Wiki MCP tool definitions/handlers
  rag-tools.ts            # RAG MCP tool definitions/handlers

src/commands/
  wiki/
    page.ts
    upsert.ts
    update.ts
    search.ts
    list.ts
    history.ts
    diff.ts
    entities.ts
    link.ts
    backlinks.ts
    concepts.ts
    delete.ts
    capture.ts
  kb/
    ingest.ts
    ingest-file.ts
    ingest-web.ts
    search.ts
    remove.ts
    stats.ts
    bootstrap.ts
    pack.ts
  retrieve.ts
  embed.ts
  context.ts
  tier/
    list.ts
    ingest.ts
    evict.ts
    promote.ts
    stats.ts
```

## Files to modify

```
src/cognitive/memory-engine.ts      # Add dbAdapter option
src/cognitive/memory-tier.ts       # Add dbAdapter option
cognitive/sensory-buffer.ts        # Pass dbAdapter
cognitive/sensory-register.ts    # Pass dbAdapter
cognitive/working-memory.ts       # Pass dbAdapter
cognitive/short-term-memory.ts   # Pass dbAgent
cognitive/long-term-memory.ts    # Pass dbAdapter
src/cognitive/awaken.ts           # Accept wiki/kb in learning loop
src/cognitive/learning/loop-orchestrator.ts # Query wiki during consolidation

src/wiki/wiki-manager.ts          # Use dbAdapter, auto-ingest to KB
src/retrieval/rag/knowledge-base.ts # Use dbAdapter
src/retrieval/rag/hybrid-retriever.ts # Use dbAdapter
src/retrieval/rag/index-manager.ts  # Use dbAdapter

src/mcp/tools.ts                  # Add wiki and RAG tools
src/mcp/server.ts                 # Accept wiki/kb
src/mcp/protocol.ts               # (no changes needed)

src/init.ts                       # Create db, wiki, kb, wire together
src/config.ts                   # (no schema changes needed)

src/sync/turso-manager.ts         # Use real Turso sync engine
src/sync/turso-sync-engine.ts     # NEW: Real sync implementation
```

## Risk analysis

| Risk                                         | Mitigation                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@tursodatabase/sync` API changes            | Pin dependency version; add abstraction layer                                                     |
| SQLite performance with large RAG corpus     | Add pagination, limit vector comparisons to top-k FTS candidates                                  |
| Breaking existing in-memory tests            | Keep `createInMemoryDatabaseAdapter()` as default for tests; only use SQLite in integration tests |
| FTS5 not available in all SQLite builds      | Gracefully fall back to `LIKE` queries if `fts5` module missing                                   |
| Migration conflicts between dev environments | Use deterministic migration hashes; test migrations in CI                                         |
