# `@agentsy/memory`

Cognitive memory engine with tiered event storage, synthesized wiki, RAG retrieval, and SQLite-backed sync.

---

## What this package does

`@agentsy/memory` implements a multi-layered memory system for AI agents:

1. **Cognitive tier engine** — Human-inspired memory (sensory → working → short-term → long-term) with token budgets, time decay, and automatic promotion/demotion.
2. **Wiki pipeline** — Raw capture → content processing → versioned pages with entity extraction, backlinks, and local embeddings.
3. **RAG knowledge base** — Document ingestion from files, web, or wiki sources; hybrid retrieval (vector + lexical + temporal); evidence packing with citations.
4. **Sync layer** — Local SQLite database with optional Turso bidirectional sync, conflict resolution, backups, and rollback.
5. **MCP server** — Exposes memory operations as tools to any Model Context Protocol consumer.
6. **Lifecycle hooks** — Session start/end, tool-call capture, and response capture for automatic memory management.

The entire system is designed to run on a **local SQLite database** (`.agentsy/memory.db` by default). Optional **Honker SQLite extensions** add pub-sub, task queue, and scheduler primitives. Optional **Turso sync** replicates the local database to Turso Cloud for cross-device or team access.

**Important:** The cognitive tier engine, wiki, and RAG layers are fully functional but currently operate **in-memory**. SQLite-backed persistence is the intended architecture. The sync layer works today for snapshot-based replication.

---

## Architecture overview

```text
┌─────────────────────────────────────────────────────────────────┐
│  Agent Environment (events, user input, tool output, responses)  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Tier 1: Sensory Buffer      │     ┌─────────────────────────┐
        │  200 tokens, 50 items, 5s TTL│     │  Raw Capture Pipeline   │
        └────────────┬─────────────────┘     │  (documents, web, chat) │
                     │                        └──────────┬──────────────┘
                     │                                   │
                     ▼                                   ▼
        ┌──────────────────────────────┐     ┌─────────────────────────┐
        │  Tier 2: Sensory Register    │     │  ContentProcessor       │
        │  400 tokens, 4 items, 2s TTL │     │  (normalize, extract) │
        └────────────┬─────────────────┘     └──────────┬──────────────┘
                     │                                   │
                     ▼                                   ▼
        ┌──────────────────────────────┐     ┌─────────────────────────┐
        │  Tier 3: Working Memory      │     │  WikiManager            │
        │  1,000 tokens, 7 items, 30s  │     │  (pages, versions,     │
        └────────────┬─────────────────┘     │   entities, backlinks)  │
                     │                        └──────────┬──────────────┘
                     ▼                                   │
        ┌──────────────────────────────┐                 ▼
        │  Tier 4: Short-Term Memory   │     ┌─────────────────────────┐
        │  2,000 tokens, 12 items, 1h  │     │  LocalEmbeddingEngine   │
        └────────────┬─────────────────┘     │  (64-dim vectors)       │
                     │                        └──────────┬──────────────┘
                     ▼                                   │
        ┌──────────────────────────────┐                 ▼
        │  Tier 5: Long-Term Memory    │     ┌─────────────────────────┐
        │  Unbounded, indefinite       │     │  HybridRetriever        │
        │  EVENT | QUERY | DOC | REF     │     │  (vector+lexical+temp)  │
        └──────────────────────────────┘     └──────────┬──────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────────────┐
                                              │  KnowledgeBaseManager   │
                                              │  (ingest, search, pack) │
                                              └─────────────────────────┘
                                                        │
             ┌──────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Local SQLite Backend (.agentsy/memory.db)                       │
│  — Memory tiers, wiki pages, vector embeddings, sync state     │
│  — Honker extensions (optional): pub-sub, task queue, scheduler │
└────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Turso Sync (optional)                                         │
│  — Bidirectional replication to Turso Cloud                    │
│  — Conflict resolution (lastWriteWins, manual)               │
│  — Backup/restore, rollback, checksum validation            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Package status

| Phase   | Feature                                                                       | Status      |
| ------- | ----------------------------------------------------------------------------- | ----------- |
| Phase 1 | Cognitive tiers, wiki pipeline, hybrid retrieval                              | ✅ Complete |
| Phase 2 | Turso sync, conflict resolution, backup/restore                               | ✅ Complete |
| Phase 3 | RAG knowledge base, evidence packing, citations                               | ✅ Complete |
| Phase 4 | AgentFS, content-addressing (blake3 fingerprints)                             | ✅ Complete |
| Phase 5 | Persona memory, knowledge graph                                               | ✅ Complete |
| Phase 6 | Learning loop (observation, dialectic, consolidation, solidification, canary) | ✅ Complete |
| Phase 7 | MCP server, daemon, lifecycle hooks, CLI                                      | ✅ Complete |

---

## Installation

```bash
# In the monorepo
cd packages/memory
pnpm build

# From npm
npm install @agentsy/memory
```

---

## Usage

### As an MCP server

The easiest way to use this package is as an MCP server. Any MCP-compatible client can connect.

```bash
# Stdio mode (for Claude Desktop, Cline, Zed)
agentsy-memory mcp

# HTTP mode (for custom integrations)
agentsy-memory mcp --transport http --port 4231
```

**Claude Desktop config** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agentsy-memory": {
      "command": "agentsy-memory",
      "args": ["mcp"],
      "env": {
        "AGENTSY_MEMORY_DB": ".agentsy/memory.db",
        "AGENTSY_MEMORY_TRANSPORT": "stdio"
      }
    }
  }
}
```

**Zed config** (`settings.json`):

```json
{
  "context_servers": [
    {
      "id": "agentsy-memory",
      "name": "Agentsy Memory",
      "command": { "path": "agentsy-memory", "args": ["mcp"] }
    }
  ]
}
```

### As a programmatic library

```typescript
import { initMemory } from '@agentsy/memory/init';

const { engine, config, server } = await initMemory({
  config: {
    db: { path: '.agentsy/memory.db' },
    mcp: { transport: 'stdio' }
  }
});

// Ingest a memory
const id = engine.ingest('User prefers TypeScript', {
  importance: 0.8,
  kind: 'semantic',
  targetTier: 'long_term_memory'
});

// Recall memories
const results = engine.recall({ query: 'TypeScript', crossTier: true });

// Consolidate
await engine.awaken();

// Start MCP server
await server.start();
```

### As a daemon (background process)

```bash
# Start with auto-restart on crash
agentsy-memory daemon:start

# Check if running
agentsy-memory daemon:status

# Stop
agentsy-memory daemon:stop
```

---

## Cognitive tier engine

### The five tiers

| Tier              | Level | Max Tokens | Max Items | TTL    | Consolidation Threshold |
| ----------------- | ----- | ---------- | --------- | ------ | ----------------------- |
| Sensory Buffer    | 1     | 200        | 50        | 5s     | 0.6                     |
| Sensory Register  | 2     | 400        | 4         | 2s     | 0.5                     |
| Working Memory    | 3     | 1,000      | 7         | 30s    | 0.4                     |
| Short-Term Memory | 4     | 2,000      | 12        | 1 hour | 0.3                     |
| Long-Term Memory  | 5     | ∞          | ∞         | ∞      | 0.0                     |

### How memories flow

1. **Ingestion** — Events enter at the sensory buffer (default) or a specific tier.
2. **Promotion** — High-importance items move upward when a tier exceeds its consolidation threshold. Promotion uses: `importance × recency × accessCount`.
3. **Decay** — Each tier has a half-life. Over time, `importance *= 0.5^(age / halfLife)`.
4. **Discarding** — Items below `minimumImportance` are discarded and their token budget is released.
5. **Demotion** — Items can move downward if importance erodes or the upper tier is full.

### Importance scoring

```text
importance = recency × 0.3 + frequency × 0.2 + contentType × 0.5 + reliability × 0.2 + relationalBoost × 0.1
```

- **Recency**: 1.0 at creation, decays over time.
- **Frequency**: Based on access count, capped at 10 accesses.
- **Content type**: `doc` (0.9) > `event` (0.7) > `query` (0.4) > `ref` (0.3).
- **Source reliability** and **relational boost**: Configurable.

### Token budget

Each tier has a token budget. `ingest()` allocates tokens; `release()` frees them. If a write fails due to budget exhaustion, the event is queued as a pending event for the next `awaken()` cycle.

### The `awaken()` cycle

```typescript
await engine.awaken();
```

Runs in order:

1. **Decay pass** — Applies half-life decay to all tiers.
2. **Consolidation** — Promotes items from full tiers upward.
3. **Pending ingestion** — Processes queued events.
4. **Learning cycle** (optional) — Runs observation extraction, dialectic resolution, multi-specialist consolidation, solidification, and canary detection.

Call `awaken()`:

- At session start (always)
- When budget utilization >90%
- After bursts of ingestion
- At session end (always)
- Every 20–30 turns in long sessions

---

## Wiki pipeline

### Overview

The wiki pipeline turns raw captures into navigable, versioned knowledge pages:

```text
Raw Capture → ContentProcessor → WikiPage → LocalEmbeddingEngine → VectorStore
                │                                │
                ▼                                ▼
        EntityExtractor                  NavigationSystem
        (concepts, relations)            (backlinks, graph)
```

### API

```typescript
import { createWikiManager } from '@agentsy/memory';

const wiki = createWikiManager();

// Capture raw content
const raw = await wiki.captureRaw({
  sourceId: 'chat-123',
  sourceType: 'conversation',
  content: 'User: How do I use useEffect?\nAgent: ...'
});

// Create or update a page
const page = await wiki.upsertPage({
  pageId: 'react-hooks',
  title: 'React Hooks',
  body: '## useEffect\n...',
  tags: ['react', 'hooks'],
  actorId: 'agent-1'
});

// Retrieve a page
const existing = await wiki.getPage('react-hooks');

// Search
const textResults = await wiki.searchFullText('useEffect cleanup', 5);
const hybridResults = await wiki.searchHybrid('useEffect', embedding, 5);

// Entity extraction
const entities = await wiki.extractEntities('react-hooks');

// Concept linking
await wiki.linkConcepts('react-hooks', 'react-state', 'relates-to');
const relations = await wiki.getConceptRelations('react-hooks');

// Page linking
await wiki.linkPages('react-hooks', 'react-state');
const backlinks = await wiki.getBacklinks('react-hooks');

// Version history
const history = await wiki.getPageHistory('react-hooks');
const diff = await wiki.diffPageVersions('react-hooks', 1, 2);

// Update a page
const updated = await wiki.updatePage(
  'react-hooks',
  {
    body: '## useEffect\nUpdated content...'
  },
  'agent-1'
);
```

### Components

- **`createWikiManager()`** — Orchestrates the full pipeline.
- **`createContentProcessor()`** — Normalizes text, detects format (markdown/text/code/json), converts to searchable text.
- **`createEntityExtractor()`** — Extracts named entities and their relationships from text.
- **`createLocalEmbeddingEngine({ dimensions: 64 })`** — Produces lightweight local embeddings using a simple hash-based approach. No external model required.
- **`createNavigationSystem()`** — Tracks page links and backlinks.
- **`createVersionTracker()`** — Maintains versioned history with diffs.

---

## RAG knowledge base

### Overview

The RAG layer provides retrieval-augmented generation with hybrid scoring:

```typescript
import {
  createKnowledgeBaseManager,
  createRAGConfig,
  createQueryPlanner,
  createSourceConnectors,
  packEvidenceForContext
} from '@agentsy/memory';
```

### Ingesting documents

```typescript
const kb = createKnowledgeBaseManager();

// Ingest from a string
const summary = await kb.ingest({
  sourceId: 'wiki:oauth-policy',
  sourceType: 'wiki',
  title: 'OAuth Policy',
  content: 'Use short-lived access tokens and rotate refresh tokens.',
  metadata: { entities: ['oauth', 'token', 'refresh'] }
});
console.log(summary.inserted, summary.updated, summary.skipped);

// Ingest from a file (via source connectors)
const connectors = createSourceConnectors({
  web: { enabled: true, allowHosts: ['docs.example.com'] }
});
const fileContent = await connectors.readLocalFile('./docs/architecture.md');
await kb.ingest({ sourceId: 'file:architecture', sourceType: 'file', content: fileContent });

// Ingest from web (if allowed)
const webContent = await connectors.fetchWebSource('https://docs.example.com/api');
await kb.ingest({ sourceId: 'web:docs', sourceType: 'web', content: webContent });
```

### Searching

```typescript
const results = await kb.search({
  query: 'how to authenticate users',
  scope: 'project',
  limit: 5,
  weights: { vector: 0.4, lexical: 0.3, entity: 0.2, temporal: 0.1 }
});
```

Each result is a `RAGEvidence` with:

- `id`, `title`, `content` — The retrieved text
- `score` and `scoreBreakdown` — Vector, lexical, entity, and temporal scores
- `citations` — Provenance metadata for attribution
- `confidence` — Normalized confidence score

### Packing evidence for LLM context

```typescript
const packed = packEvidenceForContext(results, {
  maxTokens: 180,
  includeCitations: true
});

// packed.items contains the evidence truncated to fit the token budget
// Each item has: id, title, content, score, citations
```

### Components

- **`createKnowledgeBaseManager()`** — Main orchestrator for ingest/remove/search.
- **`createHybridRetriever()`** — Combines vector similarity (40%), lexical matching (30%), entity overlap (20%), and temporal decay (10%).
- **`createQueryPlanner()`** — Expands queries with synonyms and entity detection.
- **`createDocumentIngestor()`** — Chunks documents into ~280-token segments.
- **`createIndexManager()`** — Tracks indexed documents.
- **`rerankResults()`** — Reorders evidence by weighted composite score.
- **`packEvidenceForContext()`** — Assembles citation-preserving context blocks under token budgets.

---

## Sync layer

### Overview

The sync layer provides local-first SQLite with optional Turso cloud replication:

```typescript
import { createTursoManager, createMemoryStateAdapter } from '@agentsy/memory';
```

### Turso manager

```typescript
const manager = createTursoManager({
  path: './.agentsy/memory.db',
  databaseUrl: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  syncIntervalMs: 60_000,
  mergePolicy: 'lastWriteWins',
  maxRetries: 3,
  mode: 'remote-shadow' // or 'local-only'
});
```

### Sync workflow

```typescript
// Serialize current memory state
const adapter = createMemoryStateAdapter({
  getState: async () => memoryState,
  applyState: async next => {
    memoryState = next;
  },
  getCursor: () => 'cursor-1'
});

// Sync to remote
const result = await manager.sync(await adapter.getSnapshot());
console.log(result.uploaded, result.downloaded, result.resolvedConflicts);
```

### Conflict resolution

- **`lastWriteWins`** — Automatic, uses timestamps.
- **`manual`** — Persists conflicts to a `ConflictStore` for operator review.

```typescript
import { createFileConflictStore, collectConflicts, resolveConflict } from '@agentsy/memory';

const conflictStore = createFileConflictStore({
  filePath: './.agentsy/memory-conflicts.json'
});

const conflicts = collectConflicts(localRecords, remoteRecords, { policy: 'lastWriteWins' });
for (const conflict of conflicts) {
  const resolution = resolveConflict(conflict, 'lastWriteWins');
}
```

### Backup and restore

```typescript
import { createBackupManager, createBackupManifest } from '@agentsy/memory';

const backup = createBackupManager({ path: './.agentsy/backups' });
const manifest = await backup.create('memory', memoryState);
const isValid = await verifyBackupManifest(manifest);
```

### Honker extensions

Honker is an optional SQLite extension that adds:

- **Pub-sub** — `pubsub_publish()`, `pubsub_subscribe()` SQL functions
- **Task queue** — `task_enqueue()`, `task_dequeue()` SQL functions
- **Scheduler** — `schedule_run()`, `schedule_cancel()` SQL functions
- **BLAKE3** — Content-addressed hashing for deduplication

```typescript
import { loadHonkerExtension } from '@agentsy/memory';

const result = await loadHonkerExtension({
  dbPath: './.agentsy/memory.db',
  extensionPath: './.agentsy/honker.dylib',
  blake3ExtensionPath: './.agentsy/blake3.dylib'
});

if (result.mode === 'native') {
  console.log('Honker loaded:', result.features);
} else {
  console.log('Honker not available, using in-memory fallback:', result.reason);
}
```

---

## Lifecycle hooks

For agents that want automatic memory management:

```typescript
import { onSessionStart, onSessionEnd, onToolCall, onResponse } from '@agentsy/memory/hooks';

// Session start
const start = await onSessionStart({ engine, userId: 'alice' });
console.log(start.warmMemories.length, 'warm memories loaded');

// After tool call
const toolResult = onToolCall({
  engine,
  toolName: 'write_file',
  toolInput: { path: 'src/app.ts' },
  toolOutput: 'File written'
});

// After response
const respResult = onResponse({
  engine,
  responseContent: 'Here is the answer...',
  responseTokens: 1200
});

// Session end
const end = await onSessionEnd({ engine, sessionEvents: pending });
console.log(end.consolidated, 'memories consolidated');
```

---

## MCP server

### Protocol

The MCP server uses a lightweight custom JSON-RPC 2.0 transport. It does not depend on the heavy `@modelcontextprotocol/sdk`. Supports:

- **stdio** — Reads from stdin, writes to stdout (for Claude Desktop, Cline, Zed)
- **HTTP** — POST `/message` for JSON-RPC, GET `/health` for health checks

### Available tools

| Tool             | Arguments                                      | Returns                   |
| ---------------- | ---------------------------------------------- | ------------------------- |
| `memory_ingest`  | `content`, `importance`, `kind`, `targetTier`  | Memory ID                 |
| `memory_recall`  | `query`, `minImportance`, `limit`, `crossTier` | Array of memories         |
| `memory_search`  | `query`, `limit`                               | Array of memories         |
| `memory_list`    | `tier`, `limit`                                | Array of memories in tier |
| `memory_capture` | `content`, `importance`                        | Memory ID                 |
| `memory_awaken`  | _(none)_                                       | Consolidation stats       |
| `memory_stats`   | _(none)_                                       | Tier utilization          |
| `memory_lint`    | _(none)_                                       | Health issues             |

### Starting programmatically

```typescript
import { createMemoryMCPServer } from '@agentsy/memory/mcp';
import { createMemoryEngine } from '@agentsy/memory';

const engine = createMemoryEngine();
const server = await createMemoryMCPServer(engine, {
  transport: 'stdio',
  logLevel: 'info'
});
await server.start();
```

---

## Configuration

```typescript
import { loadConfig, DEFAULT_TIER_CONFIGS } from '@agentsy/memory/config';

const config = loadConfig({
  db: {
    path: '.agentsy/memory.db',
    syncUrl: process.env.TURSO_DATABASE_URL,
    syncAuthToken: process.env.TURSO_AUTH_TOKEN,
    syncIntervalMs: 60_000
  },
  tiers: {
    working_memory: {
      ...DEFAULT_TIER_CONFIGS.working_memory,
      maxTokens: 2000,
      maxItems: 10
    }
  },
  budget: {
    budgets: { working_memory: 2000 },
    overprovisionFactor: 1.2
  },
  decay: {
    workingMemoryHalfLife: 30_000,
    shortTermHalfLife: 3_600_000
  },
  mcp: {
    transport: 'stdio',
    port: 4231,
    logLevel: 'info'
  },
  hooks: {
    onSessionStart: true,
    onSessionEnd: true,
    onToolCall: true,
    onResponse: true
  },
  logLevel: 'info'
});
```

### Environment variables

| Variable                            | Description               | Default              |
| ----------------------------------- | ------------------------- | -------------------- |
| `AGENTSY_MEMORY_DB`                 | SQLite database path      | `.agentsy/memory.db` |
| `AGENTSY_MEMORY_TRANSPORT`          | MCP transport             | `stdio`              |
| `AGENTSY_MEMORY_PORT`               | HTTP port                 | `4231`               |
| `AGENTSY_MEMORY_SYNC_URL`           | Turso sync URL            | —                    |
| `AGENTSY_MEMORY_SYNC_AUTH_TOKEN`    | Turso auth token          | —                    |
| `AGENTSY_MEMORY_SYNC_INTERVAL_MS`   | Sync interval             | `60000`              |
| `AGENTSY_MEMORY_LOG_LEVEL`          | Log level                 | `info`               |
| `AGENTSY_MEMORY_HOOK_SESSION_START` | Enable session-start hook | `true`               |
| `AGENTSY_MEMORY_HOOK_SESSION_END`   | Enable session-end hook   | `true`               |
| `AGENTSY_MEMORY_HOOK_TOOL_CALL`     | Enable tool-call hook     | `true`               |
| `AGENTSY_MEMORY_HOOK_RESPONSE`      | Enable response hook      | `true`               |

---

## CLI reference

| Command                        | Description                  | Flags                                                                                       |
| ------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------- |
| `agentsy-memory init`          | Initialize engine and config | `--transport`, `--port`, `--skip-mcp`, `--skip-db`, `--force`                               |
| `agentsy-memory mcp`           | Start MCP server             | `--transport`, `--port`, `--log-level`                                                      |
| `agentsy-memory daemon:start`  | Start background daemon      | `--transport`, `--port`, `--log-level`, `--no-restart`, `--max-restarts`, `--restart-delay` |
| `agentsy-memory daemon:stop`   | Stop daemon                  | —                                                                                           |
| `agentsy-memory daemon:status` | Check daemon status          | —                                                                                           |

---

## Subpath exports

```typescript
import { createMemoryEngine } from '@agentsy/memory';
import { createMemoryEngine } from '@agentsy/memory/cognitive';
import { initMemory } from '@agentsy/memory/init';
import { loadConfig } from '@agentsy/memory/config';
import { onSessionStart, onToolCall, onResponse, onSessionEnd } from '@agentsy/memory/hooks';
import { createMemoryMCPServer } from '@agentsy/memory/mcp';
import { runInitMain, runMcpServerMain } from '@agentsy/memory/cli';
import Init from '@agentsy/memory/commands/init';
import Mcp from '@agentsy/memory/commands/mcp';
import DaemonStart from '@agentsy/memory/commands/daemon/start';
import DaemonStop from '@agentsy/memory/commands/daemon/stop';
import DaemonStatus from '@agentsy/memory/commands/daemon/status';
```

---

## Testing

```bash
cd packages/memory
pnpm check-types  # TypeScript type checking
pnpm test           # 492+ unit tests
pnpm coverage       # Coverage report
pnpm lint           # oxlint
pnpm format         # oxfmt
```

---

## Key design decisions

### Why tiers?

Human memory is not a flat store. Separating sensory, working, short-term, and long-term memory allows the system to:

- Keep fast-access recent context small and hot
- Automatically discard irrelevant noise
- Promote important information for long-term retention
- Enforce token budgets per layer to prevent unbounded growth

### Why SQLite?

SQLite provides:

- Zero-config local database (single file)
- Full SQL query capabilities
- ACID transactions
- Small footprint (~1MB)
- Optional extensions (Honker for pub-sub/task queue)
- Turso sync for cloud replication without changing the local engine

### Why local embeddings?

The `createLocalEmbeddingEngine()` uses a simple hash-based approach (64 dimensions) that requires no external model or API key. This keeps the system fully local-first and privacy-oriented. For production use with higher-quality embeddings, swap in a model-based engine via the `embeddingEngine` dependency injection.

### Why custom MCP protocol?

The `@modelcontextprotocol/sdk` depends on Zod v4, which is heavy. The custom JSON-RPC 2.0 transport in `@agentsy/memory` is ~200 lines, has zero heavy dependencies, and implements the same MCP tool surface.

---

## Known limitations

1. **In-memory operation** — The cognitive tier engine, wiki, and RAG layers currently use in-memory Maps. SQLite persistence is the intended backend and will be added in a future release.
2. **No MCP tools for wiki/RAG** — The MCP server only exposes cognitive memory tools (`memory_ingest`, `memory_recall`, etc.). Wiki and RAG operations must be used programmatically or through the CLI.
3. **Local embeddings are simple** — The default 64-dim hash-based embeddings are lightweight but not as semantically rich as model-based embeddings (e.g., OpenAI, Cohere).
4. **No built-in web crawler** — Web ingestion via `createSourceConnectors()` requires explicit host allowlisting and manual fetch logic.

---

## See also

- [`docs/examples/memory-rag-local-first.md`](../examples/memory-rag-local-first.md) — RAG + runtime injection example
- [`docs/developers/`](../developers/) — Developer guides
- [Monorepo AGENTS.md](../../AGENTS.md) — Monorepo-wide agent instructions
- [`plan/PHASE-*-COMPLETION.md`](../../plan/) — Phase completion evidence
