# @agentsy/memory

Cognitive memory engine for AI agents with tiered memory (sensory → working → short-term → long-term), a synthesized wiki pipeline, and RAG retrieval — all backed by a local SQLite database with optional remote sync via Turso.

## What it does

`@agentsy/memory` gives agents human-like memory. Events enter at a fast sensory buffer, flow through working memory, and consolidate into long-term storage. Alongside this, a wiki pipeline captures raw knowledge, synthesizes it into navigable pages with entity extraction, and indexes it for hybrid (semantic + lexical + temporal) retrieval. The entire system is designed to run on a local SQLite database, with optional Turso sync for cross-device or team replication.

**Key components:**

- **Cognitive tier engine** — 5-tier memory with token budgets, decay, and promotion/demotion. Now backed by SQLite with optional AgentFS schema.
- **Wiki pipeline** — Raw capture → content processing → versioned pages → vector embeddings.
- **RAG knowledge base** — Document ingestion, hybrid retrieval, evidence packing, citation-preserving context assembly.
- **Sync layer** — Local SQLite with optional Turso bidirectional sync via `@tursodatabase/sync`, conflict resolution, and backups.
- **MCP server** — Exposes memory, wiki, and knowledge base tools to any Model Context Protocol consumer (Claude Desktop, Cline, Zed, etc.).
- **Lifecycle hooks** — Session start/end, tool-call capture, response capture for automatic memory management.
- **AgentFS schema** — Native SQLite tables (`kv_store`, `fs_*`, `tool_calls`) for agent filesystem operations and audit trails.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  Agent Environment (events, user input, tool output, responses)  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────┐     ┌─────────────────────────┐
│  Tier 1: Sensory Buffer      │     │  Raw Capture Pipeline   │
│  100–200 tokens, 1–5s TTL    │     │  (documents, web, chat) │
└────────────┬─────────────────┘     └──────────┬──────────────┘
             │                                   │
             ▼                                   ▼
┌──────────────────────────────┐     ┌─────────────────────────┐
│  Tier 2: Sensory Register    │     │  ContentProcessor       │
│  3–4 items, 0.5–2s TTL       │     │  (normalize, extract) │
└────────────┬─────────────────┘     └──────────┬──────────────┘
             │                                   │
             ▼                                   ▼
┌──────────────────────────────┐     ┌─────────────────────────┐
│  Tier 3: Working Memory      │     │  WikiManager            │
│  4–7 chunks, 18–30s TTL      │     │  (pages, versions,     │
└────────────┬─────────────────┘     │   entities, backlinks)  │
             │                        └──────────┬──────────────┘
             ▼                                   │
┌──────────────────────────────┐                 ▼
│  Tier 4: Short-Term Memory   │     ┌─────────────────────────┐
│  6–12 projections, minutes   │     │  LocalEmbeddingEngine   │
└────────────┬─────────────────┘     │  (64-dim vectors)       │
             │                        └──────────┬──────────────┘
             ▼                                   │
┌──────────────────────────────┐                 ▼
│  Tier 5: Long-Term Memory    │     ┌─────────────────────────┐
│  EVENT | QUERY | DOC | REF   │     │  HybridRetriever        │
│  (semantic, episodic,        │     │  (vector+lexical+temp)  │
│   procedural, sensory)       │     └──────────┬──────────────┘
└──────────────────────────────┘                │
                                                  ▼
                                        ┌─────────────────────────┐
                                        │  KnowledgeBaseManager   │
                                        │  (ingest, search, pack) │
                                        └─────────────────────────┘
                                                  │
             ┌────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Local SQLite Backend (.agentsy/memory.db)                       │
│  — Memory tiers, wiki pages, vector embeddings, sync state     │
│  — Honker extensions (optional): pub-sub, task queue,         │
│    scheduler primitives on SQLite                              │
└────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Turso Sync (optional)                                         │
│  — Bidirectional replication to Turso Cloud                    │
│  — Conflict resolution, backups, rollback                    │
└─────────────────────────────────────────────────────────────────┘
```

**Current state:** The cognitive tier engine, wiki, and RAG layers are fully implemented but currently operate in-memory. SQLite persistence is the intended backend. The sync layer works today for snapshot-based replication.

---

## Framework ownership boundary

`@agentsy/memory` ships a real operator-facing surface (CLI, daemon, MCP server), so package-local operational documentation is appropriate here. Framework-wide `setup` and `doctor` UX still belongs to `@agentsy/cli`, which consumes structured diagnostics and setup hints from this package.

---

## Installation

### From the repo (development)

```bash
git clone https://github.com/selfagency/agentsy.git
cd agentsy
pnpm install
cd packages/memory
pnpm build
```

### From npm

```bash
npm install @agentsy/memory
# or
pnpm add @agentsy/memory
```

### CLI binary

```bash
# Local
pnpm exec agentsy-memory --help

# Global
npm install -g @agentsy/memory
agentsy-memory --help
```

---

## Quick start

### As an MCP server (for Claude Desktop, Cline, Zed)

```bash
# Stdio mode
agentsy-memory mcp

# HTTP mode
agentsy-memory mcp --transport http --port 4231
```

Then connect your client:

**Claude Desktop** (`claude_desktop_config.json`):

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

**Zed** (`settings.json`):

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

### Programmatic API

```typescript
import { initMemory } from "@agentsy/memory/init";

const { engine, wiki, knowledgeBase, server } = await initMemory({
  config: { mcp: { transport: "stdio" } },
});

const id = engine.ingest("User prefers dark mode", {
  importance: 0.8,
  kind: "semantic",
});

const results = engine.recall({ query: "dark mode", crossTier: true });

// Unified search across tiers, wiki, and knowledge base
import { queryUnified } from "@agentsy/memory";
const unified = await queryUnified(engine, wiki, knowledgeBase, {
  query: "dark mode",
  scope: "unified",
});

await engine.awaken();
await server.start();
```

### Daemon mode (background server)

```bash
# Start with auto-restart
agentsy-memory daemon:start

# Check status
agentsy-memory daemon:status

# Stop
agentsy-memory daemon:stop
```

---

## CLI reference

| Command                                           | Description                  |
| ------------------------------------------------- | ---------------------------- |
| `agentsy-memory init`                             | Initialize engine and config |
| `agentsy-memory mcp`                              | Start MCP server (stdio)     |
| `agentsy-memory mcp --transport http --port 4231` | Start MCP server (HTTP)      |
| `agentsy-memory daemon:start`                     | Start background daemon      |
| `agentsy-memory daemon:stop`                      | Stop daemon                  |
| `agentsy-memory daemon:status`                    | Check daemon status          |

**Environment variables:**

| Variable                         | Default              | Description                   |
| -------------------------------- | -------------------- | ----------------------------- |
| `AGENTSY_MEMORY_DB`              | `.agentsy/memory.db` | SQLite database path          |
| `AGENTSY_MEMORY_TRANSPORT`       | `stdio`              | MCP transport mode            |
| `AGENTSY_MEMORY_PORT`            | `4231`               | HTTP port                     |
| `AGENTSY_MEMORY_SYNC_URL`        | —                    | Turso sync URL                |
| `AGENTSY_MEMORY_SYNC_AUTH_TOKEN` | —                    | Turso auth token              |
| `AGENTSY_MEMORY_LOG_LEVEL`       | `info`               | `debug`/`info`/`warn`/`error` |

---

## MCP tools exposed

When connected via MCP, these tools are available:

| Tool               | What it does                                           |
| ------------------ | ------------------------------------------------------ |
| `memory_ingest`    | Store a memory (content, importance, kind, tier)       |
| `memory_recall`    | Retrieve memories by query across tiers, wiki, and RAG |
| `memory_search`    | Search memories by content substring                   |
| `memory_list`      | List memories in a specific tier                       |
| `memory_capture`   | Capture raw content as a memory                        |
| `memory_awaken`    | Trigger consolidation and decay cycle                  |
| `memory_stats`     | Show tier utilization and budget                       |
| `memory_lint`      | Health check                                           |
| `wiki_upsert_page` | Create or update a wiki page                           |
| `wiki_search`      | Search wiki pages by full text                         |
| `kb_ingest`        | Ingest a document into the knowledge base              |
| `kb_search`        | Search the knowledge base for evidence                 |

**Unified query:** `memory_recall` with `"scope": "unified"` searches cognitive tiers, wiki pages, and the knowledge base simultaneously.

---

## Subpath exports

Import only what you need:

```typescript
import { createMemoryEngine } from "@agentsy/memory";
import { initMemory } from "@agentsy/memory/init";
import { loadConfig } from "@agentsy/memory/config";
import { onSessionStart, onToolCall, onResponse, onSessionEnd } from "@agentsy/memory/hooks";
import { createMemoryMCPServer } from "@agentsy/memory/mcp";
import { createWikiManager } from "@agentsy/memory";
import { createKnowledgeBaseManager, createRAGConfig } from "@agentsy/memory";
import { createTursoManager } from "@agentsy/memory";
import { queryUnified } from "@agentsy/memory";
```

---

## How it works

### Memory tiers

| Tier              | Capacity               | TTL        | Role                    |
| ----------------- | ---------------------- | ---------- | ----------------------- |
| Sensory Buffer    | 200 tokens, 50 items   | 5s         | First capture of events |
| Sensory Register  | 400 tokens, 4 items    | 2s         | Multi-modal aggregation |
| Working Memory    | 1,000 tokens, 7 items  | 30s        | Active "here and now"   |
| Short-Term Memory | 2,000 tokens, 12 items | 1 hour     | Recent context          |
| Long-Term Memory  | Unbounded              | Indefinite | Permanent knowledge     |

Items flow upward via promotion (importance × recency × access count) and downward via decay. Each tier has a token budget enforced by the engine.

### Importance scoring

Computed from recency (30%), frequency (20%), content type (50%), and configurable reliability/relational boosts. Ranges 0–1.

### Decay and consolidation

`memory_awaken` (or `engine.awaken()`) applies half-life decay per tier. Items below `minimumImportance` are discarded. Full tiers promote a fraction of their content upward. This runs:

1. Decay pass
2. Consolidation (compression → synthesis → summarization)
3. Pending event ingestion
4. Optional learning cycle

### Wiki and RAG

The wiki pipeline (`createWikiManager()`) turns raw captures into versioned, linked pages with entity extraction and local embeddings. The RAG knowledge base (`createKnowledgeBaseManager()`) ingests documents from files, web sources, or wiki pages, chunks them, and indexes them for hybrid search. Evidence is packed under token budgets with citation metadata for LLM context injection.

### Sync

Turso sync replicates the local SQLite database to Turso Cloud. Supports `lastWriteWins` and manual conflict resolution. The sync layer handles snapshots, checksum validation, retry/backoff, and backup/restore.

---

## Testing

```bash
cd packages/memory
pnpm check-types  # TypeScript check
pnpm test         # 492+ unit tests
pnpm coverage     # Coverage report
pnpm lint         # Biome
pnpm format       # Biome
```

---

## Status

- Phase 1 (cognitive tiers, wiki, retrieval): ✅ Complete
- Phase 2 (sync, backup, conflict resolution): ✅ Complete
- Phase 3 (RAG, hybrid search, evidence packing): ✅ Complete
- Phase 4 (agentFS, content-addressing): ✅ Complete
- Phase 5 (persona memory, knowledge graph): ✅ Complete
- Phase 6 (learning loop): ✅ Complete
- Phase 7 (MCP server, daemon, hooks, CLI): ✅ Complete
- Phase 8 (AgentFS schema migration, storage adapters): ✅ Complete
- Phase 9 (wiki-validated learning, auto-wiki-updates): ✅ Complete
- Phase 10 (documentation, testing): ✅ Complete

---

## License

GPL-3.0-or-later
