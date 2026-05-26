---
name: memory
description: >
  Persistent cognitive memory for AI agents. Ingest events, recall context,
  manage tier lifecycle (awaken/sleep), enforce token budgets, and query
  knowledge graphs. Use when the agent needs to remember across sessions,
  reduce context window waste, or maintain per-user persona profiles.
---

# @agentsy/memory — Agent Skill

## Quick Start

### Programmatic

```typescript
import { createMemoryEngine } from "@agentsy/memory";

const engine = createMemoryEngine();

// Ingest a memory
const id = engine.ingest("User prefers dark mode", { importance: 0.8, kind: "semantic" });

// Recall memories
const results = engine.recall({ minImportance: 0.5, crossTier: true });

// Run consolidation & decay
await engine.awaken();

// Get stats
const stats = engine.stats();
```

### MCP Server (CLI)

```bash
# Start as stdio MCP server (default)
npx @agentsy/memory mcp

# Start as HTTP server
npx @agentsy/memory mcp --transport http --port 4231

# Initialize memory engine
npx @agentsy/memory init
```

### MCP Server (Programmatic)

```typescript
import { createMemoryMCPServer } from "@agentsy/memory/mcp";
import { createMemoryEngine } from "@agentsy/memory";

const engine = createMemoryEngine();
const server = await createMemoryMCPServer(engine, { transport: "stdio" });
await server.start();
```

## Tier Model

The memory engine implements a 5-tier cognitive architecture inspired by human memory:

| Tier              | Level | Max Tokens | Max Items | TTL | Consolidation Threshold |
| ----------------- | ----- | ---------- | --------- | --- | ----------------------- |
| Sensory Buffer    | 1     | 200        | 50        | 5s  | 0.6                     |
| Sensory Register  | 2     | 400        | 4         | 2s  | 0.5                     |
| Working Memory    | 3     | 1,000      | 7         | 30s | 0.4                     |
| Short-Term Memory | 4     | 2,000      | 12        | 1h  | 0.3                     |
| Long-Term Memory  | 5     | ∞          | ∞         | ∞   | 0.0                     |

Memories flow upward through the tiers via promotion (when they exceed importance thresholds) and downward via decay/demotion (when they age or lose relevance).

## Tool Reference

### `memory_ingest`

Ingest a memory event into the cognitive tier engine.

```json
{
  "content": "User prefers dark mode",
  "importance": 0.8,
  "kind": "semantic",
  "targetTier": "sensory_buffer"
}
```

### `memory_recall`

Recall memories matching a query across cognitive tiers.

```json
{
  "query": "dark mode",
  "minImportance": 0.3,
  "limit": 10,
  "crossTier": true
}
```

### `memory_awaken`

Trigger consolidation and decay cycle. Processes pending events, promotes important memories, demotes stale ones.

### `memory_stats`

Get tier utilization and budget statistics.

### `memory_lint`

Check memory health. Reports issues like empty tiers, budget exhaustion, or near-capacity tiers.

### `memory_list`

List memories in a specific tier.

```json
{ "tier": "working_memory", "limit": 10 }
```

### `memory_search`

Search memories by content substring (alias for `memory_recall`).

### `memory_capture`

Capture raw content as a memory (alias for `memory_ingest`).

## Token Budget Strategy

Each tier has a maximum token budget. The `TokenBudget` tracker enforces quotas:

- **Allocate** — reserves tokens for a memory write
- **Release** — frees tokens when a memory is demoted or discarded
- **Reclaim** — automatically frees tokens from lowest-importance items when a tier is full

When a write fails due to budget exhaustion, the content is queued as a pending event for the next `awaken()` cycle.

## Session Lifecycle

### On Session Start

```typescript
import { onSessionStart } from "@agentsy/memory/hooks";

const { warmMemories, tierCapacity, budgetAvailable, awakenResult } = await onSessionStart({
  engine,
  pendingEvents,
});
```

This runs `awaken()` to process idle-time decay and returns pre-loaded hot memories for immediate context injection.

### On Session End

```typescript
import { onSessionEnd } from "@agentsy/memory/hooks";

const { consolidated, persisted, durationMs } = await onSessionEnd({ engine, sessionEvents });
```

Ingests remaining session events and runs a final consolidation pass.

### On Tool Call

```typescript
import { onToolCall } from "@agentsy/memory/hooks";

const { memoryId, importance } = onToolCall({
  engine,
  toolName: "file_write",
  toolInput: { path: "/tmp/out.txt" },
  toolOutput: "written successfully",
});
```

Automatically captures tool call results as episodic memories with heuristic importance scoring.

### On Response

```typescript
import { onResponse } from "@agentsy/memory/hooks";

const { memoryId, importance } = onResponse({
  engine,
  responseContent: "Here is my answer...",
  responseTokens: 1500,
  modelFamily: "gpt-4",
});
```

Captures agent responses as episodic memories with length-based importance scoring.

## Persona Memory & Knowledge Graph

### Persona Store

```typescript
import { createPersonaStore } from "@agentsy/memory/cognitive";

const store = createPersonaStore({ store: kvStore });
await store.mergeAttribute("user:alice", "preferred_theme", "dark", 0.9, ["session-42"]);
```

### Knowledge Graph

```typescript
import { createKnowledgeGraph } from "@agentsy/memory/cognitive";

const graph = createKnowledgeGraph();
graph.addNode("react", { type: "technology", category: "frontend" });
graph.addEdge("react", "typescript", "uses", { weight: 0.9 });
const subgraph = graph.query("react");
```

## Learning Loop

The engine includes a 5-step learning cycle that runs during `awaken()` when enabled:

1. **Observe** — Extract observations from memories (factual, emotional, procedural, corrective, relational)
2. **Dialectic** — Detect contradictions and resolve them via 4 representation views
3. **Consolidate** — Apply multi-specialist strategies (deduction, induction, surprisal, temporal)
4. **Solidify** — Evaluate consolidation results and promote/demote/merge/archive
5. **Canary** — Monitor LTM for staleness, degradation, and contradictions

## Error Handling

- **Tier overflow**: Items that don't fit are queued as pending events for the next awaken cycle
- **Budget exhaustion**: `memory_lint` reports near-capacity tiers
- **Decay**: Items below minimum importance are automatically demoted or discarded
- **Graceful degradation**: Malformed content is skipped with warnings, not thrown exceptions

## CLI Commands

| Command                                           | Description                         |
| ------------------------------------------------- | ----------------------------------- |
| `agentsy-memory init`                             | Initialize memory engine and config |
| `agentsy-memory-mcp`                              | Start MCP server (stdio mode)       |
| `agentsy-memory-mcp --transport http --port 4231` | Start MCP server (HTTP mode)        |

## Environment Variables

| Variable                            | Default              | Description               |
| ----------------------------------- | -------------------- | ------------------------- |
| `AGENTSY_MEMORY_DB`                 | `.agentsy/memory.db` | Database path             |
| `AGENTSY_MEMORY_TRANSPORT`          | `stdio`              | MCP transport mode        |
| `AGENTSY_MEMORY_PORT`               | `4231`               | HTTP port                 |
| `AGENTSY_MEMORY_SYNC_URL`           | —                    | Turso sync URL            |
| `AGENTSY_MEMORY_SYNC_AUTH_TOKEN`    | —                    | Turso auth token          |
| `AGENTSY_MEMORY_LOG_LEVEL`          | `info`               | Log level                 |
| `AGENTSY_MEMORY_HOOK_SESSION_START` | `true`               | Enable session start hook |
| `AGENTSY_MEMORY_HOOK_SESSION_END`   | `true`               | Enable session end hook   |
| `AGENTSY_MEMORY_HOOK_TOOL_CALL`     | `true`               | Enable tool call hook     |
| `AGENTSY_MEMORY_HOOK_RESPONSE`      | `true`               | Enable response hook      |
