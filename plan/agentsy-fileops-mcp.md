# Plan: @agentsy/fileops-mcp — CLI-Powered File Operations MCP Server

## TL;DR

Build a new TypeScript MCP server (`@agentsy/fileops-mcp`) that wraps five powerful CLI tools (`fd`, `fzf`, `charon`, `sd`, `eza`) to provide fast, safe file operations. The server auto-downloads binaries for the current platform if not found in PATH. Architecture mirrors git-mcp's layered pattern (tools → services → adapter → CLI backend). Compliant with MCP spec 2025-06-18.

---

## CLI Tool → Capability Mapping

| CLI Tool     | Purpose                                  | MCP Tool Prefix                                                                                  |
| ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `fd`         | Fast file search (replaces `find`)       | `fileops_search`, `fileops_find`                                                                 |
| `fzf`        | Fuzzy matching / filtering               | `fileops_fuzzy_filter`                                                                           |
| `charon`     | Safe delete with trash/restore           | `fileops_trash`, `fileops_restore`, `fileops_trash_list`                                         |
| `sd`         | Find & replace in files (replaces `sed`) | `fileops_replace`                                                                                |
| `eza`        | Rich directory listing (replaces `ls`)   | `fileops_list`, `fileops_tree`                                                                   |
| Node.js `fs` | File content read/write/create           | `fileops_read_file`, `fileops_write_file`, `fileops_create_file`, `fileops_copy`, `fileops_move` |

---

## Phase 1: Project Scaffolding & Core Infrastructure

### Step 1: Initialize project structure

- **New package**: `@agentsy/fileops-mcp` (following `{service}-mcp-server` convention)
- **Package manager**: pnpm (consistent with git-mcp)
- **Build**: tsup (consistent with git-mcp)
- **Dev runner**: tsx
- **Linting**: oxlint + oxfmt (consistent with git-mcp)
- **TypeScript**: strict mode, ES2022 target, Node16 module resolution

**File structure**:

```text
agentsy/packages/fileops-mcp/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── .oxfmt.json
├── .oxlint.json
├── README.md
├── src/
│   ├── index.ts              # McpServer init, transport selection, tool registration
│   ├── config.ts             # Allowed paths, binary config, feature flags
│   ├── constants.ts          # SERVER_NAME, VERSION, CHARACTER_LIMIT, ERROR_TEMPLATES
│   ├── types.ts              # Domain types, error kinds, discriminated unions
│   ├── bin/
│   │   ├── manager.ts        # Binary download/verify/install orchestrator
│   │   ├── platforms.ts      # Platform detection (os/arch → binary name)
│   │   └── checksum.ts       # SHA256 verification for downloaded binaries
│   ├── adapter/
│   │   ├── executor.ts       # Generic CLI executor (spawn, timeout, stdout/stderr capture)
│   │   ├── fd.ts             # fd command builder + output parser
│   │   ├── fzf.ts            # fzf command builder + output parser
│   │   ├── charon.ts         # charon command builder + output parser
│   │   ├── sd.ts             # sd command builder + output parser
│   │   └── eza.ts            # eza command builder + output parser
│   ├── schemas/
│   │   └── index.ts          # Shared Zod schemas (BasePathSchema, ResponseFormatSchema, PaginationSchema, etc.)
│   ├── services/
│   │   ├── search.service.ts      # fd + fzf operations
│   │   ├── listing.service.ts     # eza directory listing + tree
│   │   ├── replace.service.ts     # sd find/replace operations
│   │   ├── trash.service.ts       # charon trash/restore operations
│   │   ├── fileio.service.ts      # Native Node.js fs read/write/copy/move
│   │   └── binary.service.ts      # Binary availability check + auto-install
│   ├── tools/
│   │   ├── search.tools.ts        # fileops_search, fileops_find
│   │   ├── listing.tools.ts       # fileops_list, fileops_tree
│   │   ├── replace.tools.ts       # fileops_replace
│   │   ├── trash.tools.ts         # fileops_trash, fileops_restore, fileops_trash_list
│   │   ├── fuzzy.tools.ts         # fileops_fuzzy_filter
│   │   ├── fileio.tools.ts        # fileops_read_file, fileops_write_file, fileops_create_file, fileops_copy, fileops_move
│   │   └── render.ts              # Dual-output formatting (markdown/JSON)
│   ├── resources/
│   │   └── fs.resources.ts        # file:// URI resources for read-only data
│   └── utils/
│       ├── error-response.ts      # Standardized error classification + formatting
│       └── path-validator.ts      # Path traversal prevention, symlink resolution
└── test/
    ├── unit/
    └── integration/
```

## depends on nothing

### Step 2: Package configuration files

- `package.json` with `{ "name": "@agentsy/fileops-mcp", "type": "module", "bin": { "@agentsy/fileops-mcp": "dist/index.js" } }`
- Dependencies: `@modelcontextprotocol/sdk`, `zod`, `jschardet`
- Dev dependencies: `tsx`, `tsup`, `typescript`, `oxlint`, `@oxfmt/node-api`, `vitest`
- `tsconfig.json`: strict, ES2022, Node16 module resolution
- `tsup.config.ts`: Node-friendly, CJS+ESM dual, source maps, externalize runtime deps

## parallel with Step 1

---

## Phase 2: Binary Manager & CLI Adapter

### Step 3: Binary manager (`src/bin/`)

- **`platforms.ts`**: Detect `process.platform` + `process.arch` → map to GitHub release asset name for each tool
- **`checksum.ts`**: Download and verify SHA256 checksums from release artifacts
- **`manager.ts`**:
  - `ensureBinary(toolName: ToolName): Promise<string>` — returns absolute path to binary
  - Checks PATH first (`which`/`where`)
  - If not found, downloads from GitHub releases to `~/.fs-mcp/bin/{tool}-{version}`
  - Verifies checksum after download
  - Caches resolved path for session lifetime
  - Throws actionable error if download fails (with manual install instructions per platform)

**Version pinning** (in `src/constants.ts`):

```typescript
export const BINARIES = {
  fd: { version: '10.2.0', checksum: 'sha256-...' },
  fzf: { version: '0.61.0', checksum: 'sha256-...' },
  charon: { version: '1.0.0', checksum: 'sha256-...' },
  sd: { version: '1.0.0', checksum: 'sha256-...' },
  eza: { version: '0.21.0', checksum: 'sha256-...' },
} as const;
```

- Exact versions pinned in constants for reproducible behavior
- Override per-tool via `fileops_{TOOL}_VERSION` env vars (e.g., `fileops_FD_VERSION=10.1.0`)
- Checksums embedded for each platform+version combo; downloaded binary MUST match

**Supported platforms**: macOS (arm64, x64), Linux (arm64, x64, musl), Windows (x64)

**Binary sources**:

| Tool     | GitHub Release URL Pattern                                                            |
| -------- | ------------------------------------------------------------------------------------- |
| `fd`     | `https://github.com/sharkdp/fd/releases/download/v{ver}/fd-v{ver}-{platform}.{ext}`   |
| `fzf`    | `https://github.com/junegunn/fzf/releases/download/v{ver}/fzf-{ver}-{platform}.{ext}` |
| `charon` | `https://github.com/tbidne/charon/releases/download/v{ver}/charon-{platform}.{ext}`   |
| `sd`     | `https://github.com/chmln/sd/releases/download/v{ver}/sd-v{ver}-{platform}.{ext}`     |
| `eza`    | `https://github.com/eza-community/eza/releases/download/v{ver}/eza_{platform}.{ext}`  |

## depends on Steps 1-2

### Step 4: CLI executor adapter (`src/adapter/executor.ts`)

- Generic `executeCommand(toolName: ToolName, args: string[], options?: ExecOptions): Promise<ExecResult>`
- Spawns child process with argument array (never shell interpolation — security)
- Configurable timeout (default 30s for operations, 120s for large searches)
- Captures stdout, stderr, exit code
- Parses stdout based on expected output format
- Normalizes errors into domain error types
- Rate-limit concurrent invocations (max 6 parallel, matching git-mcp)

## depends on Step 3

### Step 5: Tool-specific adapter modules (`src/adapter/{tool}.ts`)

Each module provides:

- **Command builder**: Type-safe functions that build argument arrays
- **Output parser**: Parse tool-specific output into domain types
- **Error classifier**: Map tool-specific exit codes/stderr to error kinds

**`fd.ts`**:

- `buildFdArgs(query, options)` → args array
- Flags: `--type f/d/l`, `--extension`, `--hidden`, `--follow`, `--exclude`, `--max-depth`, `--size`, `--changed-within`, `--owner`, `--absolute-path`, `--color never`
- Output: newline-delimited paths → `string[]`
- JSON output via `fd --format '{'path':'{}'}'` → parsed array

**`fzf.ts`**:

- `buildFzfArgs(input, options)` → args array
- Flags: `--filter` (non-interactive mode), `--exact`, `--no-sort`, `--tiebreak`, `--limit`
- Output: filtered/matched lines from stdin
- **Key**: fzf runs in non-interactive `--filter` mode only (no TUI in MCP context)

**`charon.ts`**:

- Subcommands: `delete`, `restore`, `list`, `empty`, `perm-delete`, `metadata`
- Flags: `--format tabular/json`, `--sort`, `--prompt`, `--force`
- Output: structured trash entries with metadata (original path, deletion date, size)

**`sd.ts`**:

- Flags: `-p` (preview/dry-run), `-F` (fixed strings), `-s` (string mode)
- Multi-file: accepts file paths as trailing args
- Preview mode returns diff without modifying files

**`eza.ts`**:

- Flags: `--long`, `--tree`, `--level`, `--all`, `--sort`, `--ignore-glob`, `--git`, `--hyperlink`, `--color always/never`, `--json`
- JSON output mode for structured data (`--json`)
- Tree depth control (`--level N`)
- Git status integration (`--git`)

## depends on Step 4

---

## Phase 3: Services Layer

### Step 6: Domain services (`src/services/`)

Each service encapsulates business logic, unaware of MCP transport:

**`search.service.ts`** (fd + fzf):

- `searchFiles(basePath, query, options)` → `SearchResult[]`
- `findByExtension(basePath, extensions, options)` → `string[]`
- `findByType(basePath, type, options)` → `string[]`
- `fuzzyFilter(items, query, options)` → `string[]`
- `findByContent(basePath, pattern, options)` → `ContentMatch[]` (uses fd + grep under the hood)

**`listing.service.ts`** (eza):

- `listDirectory(path, options)` → `DirectoryEntry[]`
- `directoryTree(path, options)` → `TreeNode`
- `listWithGitStatus(path, options)` → `GitAwareEntry[]`

**`replace.service.ts`** (sd):

- `replaceInFile(filePath, find, replace, options)` → `ReplaceResult`
- `replaceInFiles(filePaths, find, replace, options)` → `AggregateReplaceResult`
- `previewReplace(filePath, find, replace, options)` → `PreviewResult` (dry-run)
- `batchReplace(operations)` → `BatchResult` (fd + sd pipeline)

**`trash.service.ts`** (charon):

- `trashFiles(paths, options)` → `TrashResult`
- `restoreFromTrash(pattern, options)` → `RestoreResult`
- `listTrash(options)` → `TrashEntry[]`
- `emptyTrash()` → `EmptyResult`
- `permanentDelete(pattern, options)` → `DeleteResult`
- `getTrashMetadata()` → `TrashMetadata`

**`fileio.service.ts`** (native Node.js `fs` — no CLI backend needed):

- `readFile(path, options)` → `FileContent` (with line range support: `offset` + `limit`)
- `writeFile(path, content, options)` → `WriteResult` (create or overwrite)
- `createFile(path, content?)` → `CreateResult` (fails if exists unless `overwrite: true`)
- `appendFile(path, content)` → `AppendResult`
- `copyFile(src, dest, options)` → `CopyResult`
- `moveFile(src, dest, options)` → `MoveResult`
- `getFileInfo(path)` → `FileInfo` (stat: size, modified, permissions, type, encoding detection)
- Line-level operations: `readLines(path, startLine, endLine)`, `editLines(path, edits)`
- Encoding detection via `jschardet` or BOM sniffing for non-UTF-8 files
- Binary file support: base64 encode/decode for images, etc.

**`binary.service.ts`**:

- `ensureAllBinaries()` → `BinaryStatus[]`
- `checkBinary(name)` → `BinaryStatus`
- `getBinaryPath(name)` → `string`

## depends on Steps 3-5

---

## Phase 4: Schemas & Types

### Step 7: Shared schemas (`src/schemas/index.ts`)

```typescript
// Shared reusable schemas (mirroring git-mcp pattern)
BasePathSchema; // z.string().min(1).describe(...)
ResponseFormatSchema; // z.enum(['markdown', 'json']).default('markdown')
PaginationSchema; // { limit, offset }
FilePatternSchema; // z.string().describe("glob or regex pattern")
MaxDepthSchema; // z.number().int().min(1).max(50).optional()
IncludeHiddenSchema; // z.boolean().default(false)
FollowSymlinksSchema; // z.boolean().default(false)
ExcludePatternsSchema; // z.array(z.string()).optional()
DryRunSchema; // z.boolean().default(false)
EncodingSchema; // z.enum(['utf-8', 'ascii', 'utf-16le', 'base64', 'binary']).default('utf-8')
LineRangeSchema; // z.object({ start_line: z.number().int().min(1), end_line: z.number().int().min(1).optional() }).optional()
OverwriteSchema; // z.boolean().default(false)
CreateDirsSchema; // z.boolean().default(false)
```

### Step 8: Domain types (`src/types.ts`)

```typescript
// Error classification
FsErrorKind = 'not_found' | 'permission' | 'path_traversal' | 'binary_missing' | 'timeout' | 'tool_error' | 'invalid_input' | 'unknown'
FsError = { readonly kind: FsErrorKind; readonly message: string; readonly toolName?: string }

// Domain types
SearchResult = { readonly path: string; readonly type: 'file' | 'directory' | 'symlink'; readonly size?: number }
DirectoryEntry = { readonly name: string; readonly type: 'file' | 'directory' | 'symlink'; readonly size: number; readonly modified: string; readonly permissions?: string; readonly owner?: string; readonly gitStatus?: string }
TreeNode = { readonly name: string; readonly type: 'file' | 'directory'; readonly children?: TreeNode[] }
ReplaceResult = { readonly file: string; readonly replacements: number; readonly preview?: string }
TrashEntry = { readonly index: number; readonly originalPath: string; readonly deletedAt: string; readonly size: number }
FileContent = { readonly path: string; readonly content: string; readonly encoding: string; readonly lines: number; readonly totalBytes: number }
FileInfo = { readonly path: string; readonly type: 'file' | 'directory' | 'symlink'; readonly size: number; readonly modified: string; readonly created: string; readonly permissions: string; readonly owner?: string; readonly encoding?: string; readonly mimeType?: string }
WriteResult = { readonly path: string; readonly bytesWritten: number; readonly created: boolean }
EditLine = { readonly line: number; readonly oldContent: string; readonly newContent: string }
// ... etc
```

## parallel with Phase 3, depends on Phase 1

---

## Phase 5: Tool Registration

### Step 9: Register tools — Search tools (`src/tools/search.tools.ts`)

**`fileops_search`** — Fast file search using fd

- Input: `{ base_path, pattern, type?, extensions?, hidden?, follow_symlinks?, max_depth?, exclude?, size?, changed_within?, limit?, offset?, response_format }`
- Output: `{ total, count, offset, results: [{path, type, size?}], has_more, next_offset }`
- Annotations: `readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false`

**`fileops_fuzzy_filter`** — Filter a list using fzf fuzzy matching

- Input: `{ items: string[], query, exact?, limit?, case_sensitive? }`
- Output: `{ matches: string[], count: number }`
- Annotations: `readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false`

## depends on Phases 3-4

### Step 10: Register tools — Listing tools (`src/tools/listing.tools.ts`)

**`fileops_list`** — Rich directory listing using eza

- Input: `{ path, all?, long?, sort?, git?, ignore_glob?, response_format }`
- Output: `{ entries: DirectoryEntry[], count: number }` or markdown table
- Annotations: `readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false`

**`fileops_tree`** — Directory tree view using eza

- Input: `{ path, depth?, all?, follow_symlinks?, ignore_glob?, response_format }`
- Output: `{ tree: TreeNode }` or ASCII tree
- Annotations: `readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false`

## parallel with Step 9

### Step 11: Register tools — Replace tools (`src/tools/replace.tools.ts`)

**`fileops_replace`** — Find and replace in files using sd

- Input: `{ paths, find, replace, fixed_strings?, preview?, response_format }`
- Output: `{ results: ReplaceResult[], total_replacements: number }` or diff preview
- Annotations: `readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false`
- Safety: Default to `preview: true` — requires explicit `preview: false` to apply changes

## parallel with Steps 9-10

### Step 12: Register tools — Trash tools (`src/tools/trash.tools.ts`)

**`fileops_trash`** — Move files to trash (safe delete) using charon

- Input: `{ paths, prompt?, response_format }`
- Output: `{ results: [{path, status, trash_index?}], count: number }`
- Annotations: `readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false`

**`fileops_restore`** — Restore files from trash using charon

- Input: `{ pattern?, indices?, force?, response_format }`
- Output: `{ restored: [{path, original_path?}], count: number }`
- Annotations: `readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false`

**`fileops_trash_list`** — List trash contents using charon

- Input: `{ sort?, format?, limit?, offset?, response_format }`
- Output: `{ entries: TrashEntry[], total: number, has_more: boolean }`
- Annotations: `readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false`

## parallel with Steps 9-11

### Step 12.5: Register tools — File I/O tools (`src/tools/fileio.tools.ts`)

**`fileops_read_file`** — Read file content with optional line range

- Input: `{ path, start_line?, end_line?, encoding?, response_format }`
- Output: `{ path, content, encoding, lines, total_bytes }` or raw text
- Annotations: `readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false`
- Supports line ranges (1-indexed) for large files — avoids loading entire file into memory
- Detects encoding automatically; supports specifying encoding for non-UTF-8 files
- Returns base64 for binary files (images, etc.) with `mimeType` in metadata

**`fileops_write_file`** — Write or overwrite file content

- Input: `{ path, content, encoding?, create_dirs?, response_format }`
- Output: `{ path, bytes_written, created }`
- Annotations: `readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false`
- Creates parent directories if `create_dirs: true`
- Atomic write via temp file + rename (prevents corruption on crash)

**`fileops_create_file`** — Create a new empty file (or with initial content)

- Input: `{ path, content?, overwrite?, response_format }`
- Output: `{ path, created }`
- Annotations: `readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false`
- Fails if file exists unless `overwrite: true`

**`fileops_copy`** — Copy file or directory

- Input: `{ source, destination, recursive?, overwrite?, response_format }`
- Output: `{ source, destination, bytes_copied, type }`
- Annotations: `readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false`

**`fileops_move`** — Move/rename file or directory

- Input: `{ source, destination, overwrite?, response_format }`
- Output: `{ source, destination, type }`
- Annotations: `readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false`
- Atomic on same filesystem; falls back to copy+delete cross-device

## parallel with Steps 9-12

### Step 13: Resources (`src/resources/fs.resources.ts`)

- `fs+file:///{path}` — Read-only file content (text-based files)
- `fs+dir:///{path}` — Directory listing as JSON
- `fs+trash://` — Current trash contents

Resources use URI templates, consistent with git-mcp's `git+repo://` pattern.

### Step 14: Config (`src/config.ts`)

- CLI arg parser for `--allow-path` (repeatable, restricts operations to listed directories)
- Env vars: `fileops_ALLOW_PATHS` (colon-separated), `fileops_AUTO_INSTALL_BINS` (default: true), `fileops_BIN_DIR` (custom binary location)
- `fileops_CHARACTER_LIMIT` (default: 25000)
- `resolveBasePath()` — validates path is within allowed roots
- Path validation: normalize, resolve symlinks, verify within allowed roots

### Step 15: Entry point (`src/index.ts`)

- McpServer initialization with `name: '@agentsy/fileops-mcp'`
- On startup: call `ensureAllBinaries()` to verify/download tools
- Register all tool groups + resources
- Transport: stdio (default) or streamable HTTP (via `TRANSPORT=http`)
- Graceful error handling for missing binaries with actionable messages

## depends on Phases 5

---

## Phase 7: Security & Validation

### Step 16: Path validation (`src/utils/path-validator.ts`)

- **Path traversal prevention**: All paths resolved against allowed roots, reject `..`, reject symlinks escaping allowed roots
- **Allowed roots**: Configured via `--allow-path` or `fileops_ALLOW_PATHS`; defaults to CWD if none specified
- **Validation flow**: normalize → resolve → check prefix against allowed roots → check not escaping via symlink
- Consistent with git-mcp's `validatePathArgument` pattern

### Step 17: Error handling (`src/utils/error-response.ts`)

- Error classification mirroring git-mcp's `GitErrorKind` → `FsErrorKind`
- `buildToolErrorResponse(error, context)` → Standard error response
- Actionable error messages with next steps (e.g., "Binary 'fd' not found. Install with: brew install fd, or set fileops_AUTO_INSTALL_BINS=true")
- Never leak absolute system paths or env var values in errors

## parallel with Phases 2-3

---

## Phase 8: Testing & Evaluation

### Step 18: Unit tests

- Test each adapter's command builder (verify argument arrays)
- Test each service with mocked executor
- Test path validator with traversal attempts
- Test binary manager with mocked downloads
- Test render utilities

### Step 19: Integration tests

- End-to-end tool execution against real CLI tools (skip if binaries unavailable)
- Path validation edge cases
- Error classification from real tool output
- Pagination behavior with large result sets

### Step 20: MCP compliance evaluation

- Create 10 evaluation questions per MCP builder skill evaluation guide
- Test with MCP Inspector (`npx @modelcontextprotocol/inspector`)
- Verify tool annotations, schemas, error formats against spec 2025-06-18

## depends on all prior phases

---

## Relevant files (from git-mcp as reference patterns)

- `src/index.ts` — McpServer init, transport selection, tool registration flow
- `src/config.ts` — CLI arg parser, env var handling, resolveRepoPath pattern
- `src/constants.ts` — `as const` constants, CHARACTER_LIMIT, ERROR_TEMPLATES
- `src/types.ts` — Discriminated union error kinds, readonly domain interfaces
- `src/schemas/index.ts` — Reusable Zod schemas with `.describe()` and `.default()`
- `src/tools/branch.tools.ts` — Full tool registration example with annotations + structuredContent
- `src/tools/render.ts` — Dual markdown/JSON output formatting
- `src/services/branch.service.ts` — Service layer pattern (pure logic, no MCP knowledge)
- `src/git/client.ts` — Adapter pattern: getGit(), validatePathArgument(), toGitError()
- `src/utils/error-response.ts` — Standardized error classification and formatting
- `src/resources/git.resources.ts` — URI template resources

## Verification

1. `pnpm build` compiles without errors
2. `oxlint` passes with zero warnings
3. `pnpm test` passes all unit + integration tests
4. `npx @modelcontextprotocol/inspector` connects and lists all tools correctly
5. Tool annotations accurately reflect read-only vs destructive nature
6. All tool input schemas validate correctly (Zod at runtime)
7. Path traversal attacks are rejected (test with `../../etc/passwd` patterns)
8. Binary auto-download works on clean machine (macOS, Linux)
9. Structured output conforms to declared outputSchema
10. Error messages are actionable and never leak sensitive paths/tokens

## Decisions

- **TypeScript + MCP SDK** following git-mcp architecture (proven pattern, team familiarity)
- **CLI tools as backend** instead of native Node.js APIs: fd/eza/sd/charon are significantly faster than Node equivalents and handle edge cases (gitignore, unicode, permissions) correctly
- **Native Node.js `fs` for file read/write** — no CLI overhead needed; Node's `fs` is already fast for I/O-bound operations and avoids encoding/parsing issues with piping binary content through CLI tools
- **fzf in non-interactive mode only**: `--filter` flag for programmatic fuzzy matching without TTY
- **Safe-by-default replacements**: fileops_replace defaults to preview mode, requires explicit opt-in to mutate
- **Charon for deletion**: Trash-first approach prevents irreversible data loss
- **Auto-download binaries**: Reduces friction; can be disabled via `fileops_AUTO_INSTALL_BINS=false`
- **Version pinning**: Exact versions pinned in constants with SHA256 checksums for reproducible behavior
- **Transport**: stdio default (local), optional streamable HTTP (remote)
- **MCP spec version**: Target 2025-06-18 compliance
- **No SSH/Git operations**: Out of scope — git-mcp handles those. Focus on filesystem operations only.
- **No file watching/subscriptions**: Agents are request-response; they poll on demand via `fileops_search` with `changed_within`. MCP clients already have their own file watchers for editor integration. The complexity of inotify/fsevents cross-platform handling + debouncing + resource cleanup is unjustified for marginal benefit.

## Further Considerations

1. **Grep/ripgrep integration**: Could add `fileops_grep` tool wrapping `ripgrep` for content search within files (find patterns in code). Currently fd + grep covers this but a dedicated tool would be faster and more feature-rich.
2. **Archive operations**: Could add `fileops_archive` / `fileops_extract` wrapping `tar`/`unzip` for common archive workflows.
3. **Permission management**: Could add `fileops_chmod`, `fileops_chown` tools for Unix permission management.
4. **File diff**: Could add `fileops_diff` for comparing two files or file versions, useful for agent self-review before writing.
