# @agentsy/tools — Implementation Plan

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

## Package Naming Snapshot (migrated from `plan/PACKAGE-NAMING-MAP.md`)

- Tooling layer package remains `@agentsy/tools`.
- Any old `fileops-mcp` / `websearch-mcp` plan references are treated as stale standalone targets; capabilities are folded into tools + mcp integration.
- MCP remains a transport/interoperability layer, while tool implementations stay in `@agentsy/tools`.
