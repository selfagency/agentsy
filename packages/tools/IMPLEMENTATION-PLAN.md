---
goal: @agentsy/tools production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: tools-maintainers
status: In progress
tags: [feature, architecture, tools, schemas, execution]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/tools` as the canonical tool definition and handler package.

## 1. Requirements & Constraints

- **REQ-TOOLS-001**: Tool definitions expose strong schemas, validation, and typed results.
- **REQ-TOOLS-002**: Tool lifecycle emits deterministic start/progress/success/error states.
- **REQ-TOOLS-003**: High-impact tool classes are approval-gated via runtime policy integration.
- **REQ-TOOLS-004**: Tool registry supports discoverability and capability metadata.
- **SEC-TOOLS-001**: Shell/file/network tools enforce allowlist/sandbox policy constraints.
- **SEC-TOOLS-002**: Untrusted tool output is sanitized before downstream rendering.
- **CON-TOOLS-001**: Orchestration strategy remains in orchestrator/runtime layers.
- **CON-TOOLS-002**: UI layout concerns remain outside tools package.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-TOOLS-001: Contract stabilization.

| Task           | Description                                                       | Completed | Date |
| -------------- | ----------------------------------------------------------------- | --------- | ---- |
| TASK-TOOLS-001 | Stabilize tool definition, schema, and lifecycle event contracts. |           |      |
| TASK-TOOLS-002 | Add typed tests for validation and result envelope invariants.    |           |      |
| TASK-TOOLS-003 | Document ownership boundaries with runtime/plugins/orchestrator.  |           |      |

### Implementation Phase 2

- GOAL-TOOLS-002: Core tool library completion.

| Task           | Description                                                                      | Completed | Date |
| -------------- | -------------------------------------------------------------------------------- | --------- | ---- |
| TASK-TOOLS-004 | Implement baseline tool sets (repl/file/shell/web/mcp bridge) with policy hooks. |           |      |
| TASK-TOOLS-005 | Implement deterministic error and retry behavior for tool handlers.              |           |      |
| TASK-TOOLS-006 | Implement capability metadata and registry interfaces.                           |           |      |

### Implementation Phase 3

- GOAL-TOOLS-003: Runtime integration and quality validation.

| Task           | Description                                                                | Completed | Date |
| -------------- | -------------------------------------------------------------------------- | --------- | ---- |
| TASK-TOOLS-007 | Integrate runtime approval and guardrail pathways for high-impact actions. |           |      |
| TASK-TOOLS-008 | Add integration tests for approve/reject/refusal flows and audit events.   |           |      |
| TASK-TOOLS-009 | Emit observability lifecycle traces for tool execution.                    |           |      |

### Implementation Phase 4

- GOAL-TOOLS-004: Hardening and release gates.

| Task           | Description                                                       | Completed | Date |
| -------------- | ----------------------------------------------------------------- | --------- | ---- |
| TASK-TOOLS-010 | Add regression/performance suites for tool execution reliability. |           |      |
| TASK-TOOLS-011 | Align docs/examples and operator safety guidance.                 |           |      |
| TASK-TOOLS-012 | Pass package and monorepo release gates.                          |           |      |

## 3. Acceptance Criteria

- **ACC-TOOLS-001**: Tool contracts and safety behaviors are deterministic and test-validated.
- **ACC-TOOLS-002**: Runtime/guardrail integration passes end-to-end tests.
- **ACC-TOOLS-003**: Release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `docs/packages/tools.md`
- `packages/tools/README.md`
- `packages/tools/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/tools — Implementation Plan

## Purpose

Concrete tool implementations for use with `@agentsy` agents. Provides ready-to-use tool definitions compatible with the `@agentsy/core` tool-call system, starting with a REPL tool and expanding to cover file operations, web fetch, shell execution, and MCP bridging.

## Architecture

Tools are plain objects conforming to `ToolDefinition` from `@agentsy/types`. Agents register tools via `@agentsy/orchestrator` or directly in `@agentsy/core` processor configuration.

```text
ToolDefinition[]  →  @agentsy/core processor  →  tool_call events  →  handler(params) → result
```

## Current Source Layout

```text
packages/tools/src/
  index.ts               — barrel export
  index.test.ts          — unit tests
  tools/
    repl/
      index.ts           — REPL tool (placeholder)
```

## Tool Design Contract

Each tool module should export:

```ts
export interface ToolDefinition<TParams = unknown, TResult = unknown> {
  name: string;
  description: string;
  parameters: JSONSchema; // JSON Schema for params validation
  handler: (params: TParams) => Promise<TResult>;
}
```

## Planned Tools

### REPL (`tools/repl/`)

JavaScript/TypeScript in-process REPL via `vm.runInNewContext` (Node.js built-in sandbox). Allows agents to evaluate expressions and run short code snippets.

**Interface:**

```ts
repltool.name = 'repl'
repltool.parameters = { code: string; timeout?: number }
repltool.handler = async ({ code, timeout }) => { stdout, stderr, result }
```

**Security:**

- Run in Node.js `vm` sandbox with `timeout` enforcement
- No access to filesystem or network from sandbox
- Sandbox whitelists: `Math`, `JSON`, `console` (captured)
- Reject `require()` / `import()` attempts

### File Operations (`tools/fileops/`)

Consolidates planned `@agentsy/fileops-mcp` capability as a local tool (not MCP server).

- `read_file(path, encoding?)` — read file contents
- `write_file(path, content, mode?)` — write/append file
- `list_dir(path)` — list directory entries
- `delete_file(path)` — delete a file or empty dir
- `move_file(from, to)` — rename/move

**Security:** Enforce a configurable `rootDir` sandbox; reject paths that escape via `path.resolve` + prefix check.

### Shell (`tools/shell/`)

Spawn subprocess commands via `execa` or Node `child_process.spawn`.

- `shell(command, args[], options?)` → `{ stdout, stderr, exitCode }`
- Timeout enforced; configurable allow-list of executables
- **Security:** reject shell metacharacter injection; use argument arrays, never string interpolation

### Web Fetch (`tools/fetch/`)

Fetch a URL and return text/HTML/JSON.

- `fetch_url(url, options?)` → `{ status, body, headers }`
- Respects `Content-Type`; truncates large responses
- **Security:** reject private/loopback IP ranges (SSRF protection), enforce allow-list or block-list of domains

### Search (`tools/search/`)

Web search integration (e.g., via Exa, Brave, or DuckDuckGo APIs).

- `web_search(query, numResults?)` → `SearchResult[]`
- Provider configured via `AGENTSY_SEARCH_PROVIDER` env + key

### Browser Automation (`tools/browser-automation/`)

Optional browser automation adapter based on the Stagehand pattern for reliable, production-grade web interactions.

- `browser_automation_act(action, context?)` — deterministic code-first interaction
- `browser_automation_agent(task, options?)` — AI-guided multi-step automation
- `browser_automation_extract(selector, schema?)` — structured extraction from a live page

**Integration notes:**

- Expose as `@agentsy/tools/browser-automation` so it can stay optional and isolated from the core tool surface.
- Preserve a preview-before-execution flow where the caller can inspect the planned action before mutation.
- Cache successful interaction sequences when safe to reduce repeated navigation cost.

**Security:**

- Keep browser permissions explicit and scoped per session.
- Treat page content as untrusted input.
- Prefer deterministic `act()`-style operations for destructive mutations; use AI guidance only when necessary.

### Code Review (`tools/code-review/`)

Browser-assisted review workflow inspired by Crit for round-diff tracking, persistent review state, and PR feedback loops.

- `code_review_open(prUrl, options?)` — open or attach to a review session
- `code_review_diff(target, base?)` — inspect changed files and round diffs
- `code_review_summarize(sessionId)` — produce a review summary for follow-up

**Integration notes:**

- Keep this as `@agentsy/tools/code-review` and let orchestrator agents call it as a capability, not as a hard dependency.
- Capture review rounds and agent feedback so the evaluator-optimizer loop can compare iterations.
- Favor browser automation for human-in-the-loop review coordination, not for core code execution.

### MCP Bridge (`tools/mcp/`)

Expose MCP server tools as native `ToolDefinition` objects.

- `createMCPBridgeTools(transport)` → `ToolDefinition[]`
- Dynamically discovers tools from a connected MCP server
- Delegates `handler` calls to MCP `tools/call`

## Implementation Status

| Tool         | Status                                   |
| ------------ | ---------------------------------------- |
| `repl`       | ❌ Placeholder only                      |
| `fileops`    | ❌ Not started                           |
| `shell`      | ❌ Not started                           |
| `fetch`      | ❌ Not started                           |
| `search`     | ❌ Not started                           |
| `mcp` bridge | ❌ Not started (lives in `@agentsy/mcp`) |

## Dependencies

- `@agentsy/types` — `ToolDefinition`, `JsonObject`, `JsonSchema`
- Node.js builtins: `vm`, `child_process`, `path`, `fs/promises`
- Optional: `execa` for shell tool

## Testing

Each tool should have a dedicated test file:

- `tools/repl/repl.test.ts` — sandbox evaluation, timeout enforcement, output capture
- `tools/fileops/fileops.test.ts` — read/write/list/delete, path escape rejection
- `tools/shell/shell.test.ts` — command execution, timeout, injection rejection
- `tools/fetch/fetch.test.ts` — URL fetch, SSRF guard, truncation

## Export Surface

```ts
// packages/tools/src/index.ts
export * from './tools/repl/index.js';
export * from './tools/fileops/index.js'; // future
export * from './tools/shell/index.js'; // future
export * from './tools/fetch/index.js'; // future
export * from './tools/search/index.js'; // future
```

## Security Notes

- All tools that touch the filesystem, network, or shell must enforce explicit sandboxing
- SSRF: validate fetch URLs against RFC 1918 / loopback ranges
- Path traversal: `path.resolve(rootDir, userPath).startsWith(rootDir)` guard
- Shell injection: use argument arrays; never interpolate user input into command strings
- REPL: `vm.runInNewContext` with `timeout`, no module access

---

## File Operations Toolset (migrated from `plan/agentsy-fileops-mcp.md`)

Instead of creating deprecated `@agentsy/fileops-mcp`, the same capabilities should be implemented in `@agentsy/tools` as native tool modules, then optionally surfaced through `@agentsy/mcp` bridge/export.

### Capability Map

| Backend   | Purpose                | Planned Tool Names                                                                               |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `fd`      | Fast file search       | `fileops_search`, `fileops_find`                                                                 |
| `fzf`     | Fuzzy filtering        | `fileops_fuzzy_filter`                                                                           |
| `charon`  | Safe delete / restore  | `fileops_trash`, `fileops_restore`, `fileops_trash_list`                                         |
| `sd`      | Find/replace           | `fileops_replace`                                                                                |
| `eza`     | Directory listing/tree | `fileops_list`, `fileops_tree`                                                                   |
| Node `fs` | File IO                | `fileops_read_file`, `fileops_write_file`, `fileops_create_file`, `fileops_copy`, `fileops_move` |

### Proposed Internal Layout (inside `packages/tools/src/`)

```text
src/
  adapter/
    executor.ts
    fd.ts
    fzf.ts
    charon.ts
    sd.ts
    eza.ts
  bin/
    manager.ts
    platforms.ts
    checksum.ts
  schemas/
    index.ts
  services/
    search.service.ts
    listing.service.ts
    replace.service.ts
    trash.service.ts
    fileio.service.ts
    binary.service.ts
  tools/
    search.tools.ts
    listing.tools.ts
    replace.tools.ts
    trash.tools.ts
    fileio.tools.ts
    render.ts
  resources/
    fs.resources.ts
  utils/
    path-validator.ts
    error-response.ts
```

### Binary Manager Notes

- `ensureBinary(toolName)` checks PATH first, then optionally auto-downloads pinned versions.
- Pin versions and SHA256 checksums in constants for reproducibility.
- Supported targets: macOS (arm64/x64), Linux (arm64/x64/musl), Windows (x64).
- `fileops_AUTO_INSTALL_BINS=false` disables auto-download.

### Security & Safety

- Path traversal prevention: normalize → resolve symlinks → enforce allowed roots.
- Default allowed root: CWD (unless configured via allow-paths).
- `fileops_replace` defaults to preview/dry-run; explicit opt-in required for mutation.
- `charon`-based trash-first delete to avoid irreversible loss.
- Executor always uses argument arrays; no shell interpolation.

### Tool Semantics

- `fileops_read_file` supports line ranges and encoding detection.
- `fileops_write_file` should use atomic write (temp file + rename).
- `fileops_move` should be atomic on same FS and fallback to copy+delete cross-device.
- `fileops_tree` supports depth controls and optional git-aware listing.

### Testing & Verification

- Unit: command builders, schema validation, path validator, binary manager behavior.
- Integration: end-to-end tool execution (when binaries available), pagination, error mapping.
- Security: traversal attacks (`../../etc/passwd` patterns), symlink escape rejection.
- MCP compatibility checks via inspector when exposed through MCP bridge.

### Decisions Preserved

- Keep Git/SSH operations out of this scope (`git-mcp` handles them).
- No file watching/subscriptions in this package (request-response tools only).
- Native Node `fs` is preferred for read/write operations; CLI tools are used where they outperform (`fd`, `eza`, `sd`, `charon`, `fzf`).

---

## Ecosystem Integration Analysis (2026-05-14)

### CRITICAL: Filesystem Strategy Update

**PRIMARY: AgentFS for Agent Operations**

- **Rationale:** AgentFS is designed specifically for agents with three interfaces (filesystem, KV store, toolcall audit trails)
- **Benefits:** Turso-native compatibility, agent-specific snapshots, time-travel, state reproduction, built-in coordination with honker
- **Implementation:** Replace sandboxes with AgentFS SDK integration
- **Expected Benefits:** Single API for 12+ resource types, 30-40% integration cost reduction, 3-5x faster workflow development

**CONDITIONAL: Mirage for External Resources**

- **Rationale:** Use mirage ONLY for external resource access becomes critical
- **Use Case:** Multi-resource unification (S3, GitHub, Notion, Linear, Slack, etc.)
- **Integration Pattern:** Add as alternative backend when AgentFS internal resources insufficient
- **Implementation:** Optional mirage adapter only if external resource access needed
- **Fallback:** Use AgentFS + Turso when multi-resource access isn't needed

### Maki Tool Efficiency Integration

- **Rationale:** Token-efficient tooling with tree-sitter integration (59 token cost vs 224 token reads)
- **Expected Benefits:** 70%+ token savings on code operations, AST-based permission inference for security
- **Implementation:**
  - Integrate tree-sitter tools for efficient code analysis
  - Implement Monty interpreter for data pipelining
  - Add bash parsing for permission inference
- **Expected Savings:** 224 → 59 token code reads (70%+ savings)

### Tool Coordination with Honker

- **Rationale:** Cross-process coordination for tool events and background workflows
- **Integration Pattern:** honker pub/sub for memory updates, task queues for background tasks
- **Expected Benefits:** 1-5ms coordination latency vs polling, atomic queue operations prevent lost tasks

### Enhanced Tool Architecture

```typescript
// Enhanced tool architecture with AgentFS integration
interface EnhancedToolsArchitecture {
  // Existing tools
  existing: ['repl', 'fileops', 'shell', 'fetch', 'search'];

  // NEW: AgentFS PRIMARY for agent operations
  agentFilesystem: {
    sdk: 'AgentFS TypeScript SDK',
    interfaces: ['Filesystem', 'Key-Value', 'Toolcall audit trails'],
    features: ['Snapshotting', 'Time-travel', 'State reproduction'],
    coordination: 'honker pub/sub for tool events',
    storage: 'Turso-native SQLite-based'
  };

  // CONDITIONAL: mirage for external resources
  externalResources: {
    backends: ['S3', 'GitHub', 'Notion', 'Linear', 'Slack'] (if needed),
    useCase: 'Multi-resource integration only if critically needed',
    fallback: 'AgentFS + Turso for internal operations'
  };

  // Token-efficient tools
  efficientTools: {
    treeSitter: 'Maki 59 token cost vs 224 token reads (70%+ savings)',
    permissions: 'AST-based permission inference for security',
    interpreter: 'Monty data pipelining'
  };
}
```

### Integration Timeline

**Phase 1: AgentFS Integration (Weeks 1-4)**

- Week 1-2: Replace sandbox with AgentFS SDK integration
- Week 3-4: Implement KV store and audit trail interfaces

**Phase 2: Tool Efficiency (Weeks 5-8)**

- Week 5-6: Integrate Maki tree-sitter tools for code analysis
- Week 7-8: Implement permission inference via AST parsing

**Phase 3: External Resources (Weeks 9-12)**

- Week 9-10: Conditional mirage adapter evaluation
- Week 11-12: Implement only if external resource access needed

**Phase 4: Tool Coordination (Weeks 13-16)**

- Week 13-14: honker pub/sub integration for tool events
- Week 15-16: Task queue integration for background workflows

### Expected Combined Benefits

1. **Cost Efficiency:**
   - **Tool tokens:** 70%+ savings via Maki tree-sitter efficiency
   - **Integration:** 30-40% integration cost reduction via AgentFS unified API
   - **Coordination:** 90% infrastructure savings via honker vs custom broker

2. **Performance:**
   - **Latency:** 1-5ms tool coordination vs current polling
   - **Speed:** 3-5x faster tool workflow development
   - **Reliability:** Atomic operations prevent lost tool tasks/corrupted workflows

3. **Developer Experience:**
   - **Simplicity:** 50% tool integration complexity reduction
   - **Productivity:** 3-5x faster multi-resource agent workflows
   - **Flexibility:** Add new resources/backends without changing agent code

4. **Security & Privacy:**
   - **Local-First:** Tool operation local-first where possible
   - **Safe Execution:** Copy-on-write filesystem isolation with AgentFS
   - **Consistent:** Unified permission model across all tool types
   - **AST-Based:** Permission inference via tree-sitter for security

---

## Package Naming Snapshot (migrated from `plan/PACKAGE-NAMING-MAP.md`)

- Tooling layer package remains `@agentsy/tools`.
- Any old `fileops-mcp` / `websearch-mcp` plan references are treated as stale standalone targets; capabilities are folded into tools + mcp integration.
- MCP remains a transport/interoperability layer, while tool implementations stay in `@agentsy/tools`.
