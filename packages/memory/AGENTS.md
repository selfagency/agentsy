# Agent Instructions — Using @agentsy/memory

These instructions are for agents that interact with `@agentsy/memory` as an **external memory service** via MCP tools or the command line. You do not import JavaScript modules or write code. You call tools or run commands.

## Should I use memory?

**Yes** before you respond if any of the following are true:

- The user refers to something said earlier in the conversation or a prior session.
- You need to maintain per-user preferences, project state, or persona traits.
- You just performed a tool call whose output should be remembered (file writes, searches with key findings, API results).
- You are generating a substantial response (>500 tokens) that contains novel reasoning or decisions.
- You are about to answer a question and want to check if relevant prior context exists.
- You learned something that should update a wiki topic (e.g., "CSS Grid best practices").

**No** if:

- The task is a single-turn question with no state to persist.
- You are repeating information already in the immediate context window.

---

## How you interact with memory

You have two interfaces. Use whichever is available in your environment.

### A. MCP tools (preferred)

If your host has connected the `agentsy-memory` MCP server, you can call these tools directly:

| Tool             | Purpose                               |
| ---------------- | ------------------------------------- |
| `memory_ingest`  | Store a memory                        |
| `memory_recall`  | Retrieve memories by query or filters |
| `memory_search`  | Search by content substring           |
| `memory_list`    | List all memories in a specific tier  |
| `memory_capture` | Capture raw content as a memory       |
| `memory_awaken`  | Trigger consolidation and decay cycle |
| `memory_stats`   | Check tier utilization and budget     |
| `memory_lint`    | Run health check                      |

### B. Command line (fallback)

If MCP tools are unavailable but you have shell access:

```bash
# Start the MCP server (stdio mode)
agentsy-memory mcp

# Start the MCP server (HTTP mode)
agentsy-memory mcp --transport http --port 4231

# Initialize configuration
agentsy-memory init

# Daemon management
agentsy-memory daemon:start
agentsy-memory daemon:status
agentsy-memory daemon:stop
```

The CLI starts a local MCP server. Tools are then invoked through JSON-RPC over stdio or HTTP.

---

## 1. Session start workflow

Before you process the user's first message in a session, do this **every time**:

### Step 1: Trigger consolidation

**MCP:**

```json
{ "tool": "memory_awaken", "arguments": {} }
```

**Why:** This processes decay from idle time, promotes important memories, and discards stale ones.

### Step 2: Retrieve warm memories

**MCP:**

```json
{
  "tool": "memory_recall",
  "arguments": {
    "crossTier": true,
    "minImportance": 0.5,
    "limit": 10
  }
}
```

**Why:** Loads the most relevant recent memories from all tiers. Summarize each returned item in 1–2 lines and incorporate it into your reasoning.

### Step 3: Check capacity

**MCP:**

```json
{ "tool": "memory_stats", "arguments": {} }
```

**Why:** If budget utilization is >90%, plan to trigger `memory_awaken` after the first few turns.

---

## 2. During a turn: what to remember

### 2.1 Before you respond

If the user asked about a specific topic, search for relevant prior context:

**MCP:**

```json
{
  "tool": "memory_recall",
  "arguments": {
    "query": "<user topic>",
    "crossTier": true,
    "limit": 5
  }
}
```

Incorporate the returned memories into your answer. Cite the memory ID if available.

### 2.2 After each tool call

You MUST ingest the result of any tool call that changes state or produces significant information.

**MCP:**

```json
{
  "tool": "memory_ingest",
  "arguments": {
    "content": "[tool:<tool_name>] <brief summary of what happened>",
    "importance": <see heuristic below>,
    "kind": "episodic",
    "writeHeap": "event"
  }
}
```

**Importance heuristic by tool type:**

| Tool type               | Importance | Examples                                   |
| ----------------------- | ---------- | ------------------------------------------ |
| Write / create / update | 0.7        | `write_file`, `edit_file`, `create_branch` |
| Delete                  | 0.6        | `delete_file`, `remove_branch`             |
| Memory-related          | 0.5        | `memory_ingest`, `memory_recall`           |
| Search                  | 0.3        | `grep`, `web_search`, `search_code`        |
| Read / get              | 0.3        | `read_file`, `get_commit`                  |
| List                    | 0.2        | `list_directory`, `list_issues`            |
| Default / unknown       | 0.4        | Anything else                              |

If the tool result changes critical state (modifies a file, deploys code), use the **high end** of the range. If it is a read-only lookup, use the **low end**.

### 2.3 After generating your response

If your response is substantive (>300 tokens, contains novel reasoning, or makes a decision), ingest it:

**MCP:**

```json
{
  "tool": "memory_ingest",
  "arguments": {
    "content": "<first 500 chars of your response, or a 1–2 sentence summary>",
    "importance": <0.3 for short, 0.5 for medium, 0.6 for long>,
    "kind": "episodic",
    "writeHeap": "event"
  }
}
```

### 2.4 When the user states a preference or fact

If the user says something like "I prefer X" or "My project uses Y", store it directly in long-term memory with high importance:

**MCP:**

```json
{
  "tool": "memory_ingest",
  "arguments": {
    "content": "User preference: <fact>",
    "importance": 0.85,
    "kind": "semantic",
    "targetTier": "long_term_memory",
    "writeHeap": "doc"
  }
}
```

### 2.5 When you discover procedural knowledge

If you learn "how to do X" in this project (build commands, patterns, gotchas), store it:

**MCP:**

```json
{
  "tool": "memory_ingest",
  "arguments": {
    "content": "Procedure: <description>",
    "importance": 0.6,
    "kind": "procedural",
    "targetTier": "short_term_memory",
    "writeHeap": "doc"
  }
}
```

---

## 3. Tier-aware ingestion strategy

You do not need to understand the full tier system, but you should set `targetTier` correctly when you know the memory type:

| What you are storing                 | `targetTier`        | `kind`       | `writeHeap` | `importance` |
| ------------------------------------ | ------------------- | ------------ | ----------- | ------------ |
| Raw tool output, transient event     | _(default)_         | `episodic`   | `event`     | 0.3–0.5      |
| User query or intent                 | `working_memory`    | `episodic`   | `query`     | 0.4–0.6      |
| Your substantive response            | `working_memory`    | `episodic`   | `event`     | 0.3–0.7      |
| Explicit user preference / fact      | `long_term_memory`  | `semantic`   | `doc`       | 0.7–0.9      |
| Procedural knowledge ("how I did X") | `short_term_memory` | `procedural` | `doc`       | 0.5–0.7      |
| Cross-reference / link               | `long_term_memory`  | `semantic`   | `ref`       | 0.4–0.6      |

If unsure, omit `targetTier` and let the engine default to `sensory_buffer`. It will be promoted automatically.

---

## 4. Retrieval patterns

### 4.1 Context injection before answering

**MCP:**

```json
{
  "tool": "memory_recall",
  "arguments": {
    "query": "<user topic>",
    "crossTier": true,
    "minImportance": 0.4,
    "limit": 5
  }
}
```

Inject the results into your reasoning context. If a result is highly relevant, quote it or summarize it.

### 4.2 Deep recall for summaries

If the user asks "What do you know about X?" or "Summarize what we have done":

**MCP:**

```json
{
  "tool": "memory_recall",
  "arguments": {
    "tiers": ["short_term_memory", "long_term_memory"],
    "kind": "semantic",
    "minImportance": 0.6,
    "limit": 20
  }
}
```

### 4.3 Search by substring

If you know a keyword but are unsure of the tier:

**MCP:**

```json
{
  "tool": "memory_search",
  "arguments": {
    "query": "<keyword>",
    "limit": 10
  }
}
```

### 4.4 List a specific tier

If you want to see what is currently active in working memory:

**MCP:**

```json
{
  "tool": "memory_list",
  "arguments": {
    "tier": "working_memory",
    "limit": 10
  }
}
```

**Valid tiers:** `sensory_buffer`, `sensory_register`, `working_memory`, `short_term_memory`, `long_term_memory`

---

## 5. Consolidation workflow (`memory_awaken`)

Trigger `memory_awaken` in these situations:

1. **At session start** (always).
2. **When `memory_stats` reports >90% budget utilization**.
3. **After a burst of tool calls** (e.g., 10+ ingestions in rapid succession).
4. **At session end** (always).
5. **Periodically during long sessions** every 20–30 turns.

**MCP:**

```json
{ "tool": "memory_awaken", "arguments": {} }
```

**What it does:**

- Applies time decay to all memories. Stale items are discarded.
- Promotes important memories from lower tiers to higher tiers.
- Processes events that previously failed due to budget exhaustion.
- Optionally runs a learning cycle (if enabled by the host).

**After awaken, always re-check stats:**

```json
{ "tool": "memory_stats", "arguments": {} }
```

If the result shows `budgetUtilization` still near 1.0, the host may need to evict items or expand budgets.

---

## 6. Health checks

Run `memory_lint` whenever the memory system behaves unexpectedly or before starting a critical task:

**MCP:**

```json
{ "tool": "memory_lint", "arguments": {} }
```

Possible issues and what they mean:

| Issue                    | Meaning                         | Action                                                      |
| ------------------------ | ------------------------------- | ----------------------------------------------------------- |
| "No memories"            | The engine is empty             | Normal for fresh sessions                                   |
| "Budget exhausted"       | Token budget is fully allocated | Trigger `memory_awaken` immediately                         |
| "`<tier>` near capacity" | A specific tier is full         | Trigger `memory_awaken`; if persists, reduce ingestion rate |

---

## 7. One-turn workflow (checklist)

For a typical user turn with tool usage, follow this exact order:

1. **Recall** relevant memories for the user's query (`memory_recall` or `memory_search`).
2. **Ingest** the user's message as a query (`memory_ingest`, `kind: episodic`, `writeHeap: query`) if substantive.
3. **Execute** your tools.
4. **Ingest** each tool result with heuristic importance (`memory_ingest`).
5. **Generate** your response.
6. **Ingest** your response if substantive (`memory_ingest`).
7. **If stats show budget >90% or turn count divisible by 20**, call `memory_awaken`.

---

## 8. Session end workflow

Before you shut down or the session ends:

1. **Ingest any remaining events** that have not yet been captured.
2. **Trigger consolidation:**

   ```json
   { "tool": "memory_awaken", "arguments": {} }
   ```

3. **Log the final state:**

   ```json
   { "tool": "memory_stats", "arguments": {} }
   ```

   Report total items and budget utilization if the host asks for a summary.

---

## 9. Using the CLI directly

If MCP tools are unavailable but you have shell access, you can still interact with memory via the CLI. The CLI starts an MCP server locally; tools are then invoked through JSON-RPC over stdio or HTTP.

### Start the server

```bash
# Stdio mode (default)
agentsy-memory mcp

# HTTP mode
agentsy-memory mcp --transport http --port 4231
```

### Initialize the engine

```bash
agentsy-memory init
# or with options
agentsy-memory init --transport http --port 4231 --skip-mcp
```

### Daemon management (background server)

```bash
# Start daemon with auto-restart
agentsy-memory daemon:start

# Check if running
agentsy-memory daemon:status

# Stop
agentsy-memory daemon:stop
```

### Environment variables

When using the CLI, respect these environment variables if they are set:

| Variable                         | Description      | Default              |
| -------------------------------- | ---------------- | -------------------- |
| `AGENTSY_MEMORY_DB`              | Database path    | `.agentsy/memory.db` |
| `AGENTSY_MEMORY_TRANSPORT`       | MCP transport    | `stdio`              |
| `AGENTSY_MEMORY_PORT`            | HTTP port        | `4231`               |
| `AGENTSY_MEMORY_SYNC_URL`        | Turso sync URL   | _(optional)_         |
| `AGENTSY_MEMORY_SYNC_AUTH_TOKEN` | Turso auth token | _(optional)_         |
| `AGENTSY_MEMORY_LOG_LEVEL`       | Log verbosity    | `info`               |

---

## 10. Safety rules

- **Do not ingest secrets.** If tool output contains API keys, tokens, or passwords, redact them before calling `memory_ingest`.
- **Do not ingest empty content.** Always provide meaningful summaries.
- **Do not assume memories persist forever.** Long-term memories can still decay if importance erodes.
- **If `memory_ingest` returns an error**, the event may be queued automatically. Do not spam retries. Continue your turn and rely on the next `memory_awaken` cycle.
- **If the memory service is unavailable**, fall back to the context window. Do not halt your task.
- **When in doubt, store it.** It is better to ingest a low-importance memory than to lose context.
