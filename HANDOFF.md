# @agentsy/vscode DX Improvement — Handoff State

**Date:** 2026-05-06  
**Branch:** `main`  
**Test status:** 237 tests, 17 test files — all passing  
**Type check:** `tsc --noEmit` clean

---

## What Was Done

### 1. Typed MCP transport union — `packages/processor/src/mcp/transport.ts`

New file. Defines a discriminated union `MCPTransport` covering `http` and `stdio` variants, plus two utilities:

- `adaptTransportToStream(transport)` — converts either transport variant to a readable stream
- `createCompatibilityAdapter(transport)` — wraps a transport for use with `@modelcontextprotocol/sdk`

### 2. VS Code MCP bridge helper — `packages/vscode/src/mcp/`

New file `vscodeBridgeHelper.ts` + barrel `index.ts`.  
`VSCodeMCPBridgeHelper` class wraps an `MCPTransport` and a VS Code `CancellationToken` to expose a `createChatResponseStream()` method that returns a VS Code `ChatResponseStream`-compatible object. Factory: `createVSCodeMCPBridge(transport, token)`.

Tested in `vscodeBridgeHelper.test.ts` (5 tests).

### 3. MCP chat bridge — `packages/vscode/src/stream-bridge/`

New subdirectory. `mcpChatBridge.ts` bridges `MCPTransport → VS Code ChatResponseStream` at a higher level using `VSCodeMCPBridgeHelper` internally.

- `MCPChatBridge` class — `createStream()`, `getTransport()`, `getCancellationToken()`
- `createMCPChatBridge(transport, token)` factory
- `index.ts` barrel

**Naming note:** The existing `stream-bridge.ts` (root-level, handles `StreamChunk → VSCode`) retains its names `VSCodeStreamBridge`/`bridgeStream`. The new subdirectory uses `MCPChatBridge`/`createMCPChatBridge` to avoid collision. Both are exported from the package root.

Tested in `mcpChatBridge.test.ts` (5 tests).

### 4. VS Code chat response stream overloads — `packages/vscode/src/vscode-overloads/`

New `chatResponseStream.ts` + barrel `index.ts`.  
`VSCodeChatResponseStream` — extended interface adding typed overloads and helper methods on top of the raw VS Code `ChatResponseStream`. Factory: `createVSCodeChatResponseStream(stream)`.

Tested in `chatResponseStream.test.ts` (8 tests).

### 5. Retry utility — `packages/vscode/src/retry/`

New `retryUtility.ts` + barrel `index.ts`.  
`RetryUtility` class — configurable retry loop with VS Code `CancellationToken` integration. Constructor: `(maxRetries, delayMs, cancellationToken)`. Method: `executeWithRetry(operation, onRetry?)`. Factory: `createRetryUtility(maxRetries, delayMs, cancellationToken)`.

Tested in `retryUtility.test.ts` (7 tests).

### 6. `buildToolResultMessage` overload — `packages/tool-calls/src/buildToolResultMessage.ts`

Modified. Added overload accepting a minimal `{ id?: string; name: string }` shape alongside the existing `XmlToolCall` overload so callers working with native tool call formats don't need to construct a full `XmlToolCall`.

### 7. Shared `ProviderTool` contract — `packages/tool-calls/src/providerToolsContract.ts`

New file. Defines `ProviderTool` interface (provider-facing tool schema) interoperable with `NativeTool[]` plus:

- `isProviderTool(value)` type guard
- `providerToolToNative(tool)` converter
- `nativeToProviderTool(tool)` converter

### 8. `createProviderError` options — `packages/vscode/src/error-handling/error-mapper.ts`

Modified. `CreateProviderErrorOptions` extended with:

- `preserveOriginalMessage?: boolean` — keeps the underlying error message verbatim
- `attachCode?: boolean` — appends the numeric error code to the message

### 9. `ApiKeyManager` safe mode — `packages/vscode/src/api-key-manager/api-key-manager.ts`

Modified. `initialize()` and `getApiKey()` accept a `safeMode?: boolean` option. When `true`, these methods return `undefined` rather than throwing when no key is found, enabling soft-failure flows in optional authentication scenarios.

### 10. New exports wired to package root — `packages/vscode/src/index.ts`

All new modules are now exported from the package root:

```ts
// MCP chat bridge (MCPTransport → ChatResponseStream)
export { MCPChatBridge, createMCPChatBridge } from './stream-bridge/index.js';

// VS Code chat response stream overloads
export { createVSCodeChatResponseStream } from './vscode-overloads/index.js';
export type { VSCodeChatResponseStream } from './vscode-overloads/index.js';

// Retry utility with CancellationToken support
export { RetryUtility, createRetryUtility } from './retry/index.js';

// MCP bridge helper (MCPTransport ↔ VS Code)
export { VSCodeMCPBridgeHelper, createVSCodeMCPBridge } from './mcp/index.js';
```

### 11. Tree-shaking baseline — `packages/vscode/`

- `sideEffects: false` added to `packages/vscode/package.json`
- `tsup.config.ts` updated with subpath entry points for all major modules so bundlers can tree-shake at the module level:
  - `renderer/index`, `mcp/index`, `mcp-integration/index`, `retry/index`, `stream-bridge/index`, `vscode-overloads/index`, `api-key-manager/index`, `settings/index`, `error-handling/index`, `testing/index`

**Note:** The `exports` map in `package.json` still only exposes `.` (the root). The next step is to add matching `"./renderer"`, `"./mcp"`, etc. subpath export entries so Node.js/bundlers can resolve them at install-time rather than just at build-time.

---

## What Remains

### High priority

#### A. Add subpath export entries to `packages/vscode/package.json`

The tsup config now emits per-module dist files (e.g. `dist/mcp/index.js`), but the `exports` map doesn't advertise them yet. Add entries like:

```json
"exports": {
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" },
  "./renderer": { "types": "./dist/renderer/index.d.ts", "import": "./dist/renderer/index.js", "require": "./dist/renderer/index.cjs" },
  "./mcp": { "types": "./dist/mcp/index.d.ts", "import": "./dist/mcp/index.js", "require": "./dist/mcp/index.cjs" },
  "./mcp-integration": { ... },
  "./retry": { ... },
  "./stream-bridge": { ... },
  "./vscode-overloads": { ... },
  "./api-key-manager": { ... },
  "./settings": { ... },
  "./error-handling": { ... },
  "./testing": { ... }
}
```

After adding, run `pnpm build` inside the vscode package and confirm each `dist/*/index.js` file is emitted.

#### B. `docs/packages/vscode.md` — parity pass

The package docs don't yet mention any of the new exports (`MCPChatBridge`, `VSCodeMCPBridgeHelper`, `RetryUtility`, `createVSCodeChatResponseStream`, etc.). Add a section per new module with description, constructor/factory signature, and a minimal code example.

#### C. Production-style reference example — `docs/examples/production-provider.md`

A complete, realistic example showing:

- Streaming with `VSCodeStreamBridge`
- Tool use round-trip with `buildToolResultMessage`
- Retry with `RetryUtility` + `CancellationToken`
- MCP bridge with `VSCodeMCPBridgeHelper`
- Error handling with `createProviderError` + `isRetryableError`
- Thinking token stripping with `@agentsy/thinking`

Check `docs/examples/` for existing examples first to avoid duplication.

### Medium priority

#### D. Versioned migration guide — `docs/migration/`

`docs/migrating-from-llm-stream-parser.md` already exists but covers the old `@agentsy/parser` → `@agentsy/processor` migration. Create:

- `docs/migration/index.md` — overview table (from version → to version → guide)
- `docs/migration/v0.x-to-v1.md` — covers the current API surface; documents `bridgeStream` vs `MCPChatBridge` decision; documents safe mode, retry utility, new ProviderTool contract

#### E. Minimal dependency matrix — `docs/getting-started.md`

Add a section listing which packages are needed for common use cases:

- "I only need streaming" → `@agentsy/vscode` (just `bridgeStream`)
- "I need MCP" → `@agentsy/vscode` (mcp subpath) + `@agentsy/processor`
- "I need tool calls" → `@agentsy/tool-calls`
- "I need thinking token extraction" → `@agentsy/thinking`

### Lower priority

#### F. Recommended modern integration path

Add a "Getting started the modern way" section to `docs/getting-started.md` or `docs/index.md` that points to subpath imports and explains the recommended minimal footprint setup.

#### G. Release notes / upgrade matrix

Update or create `CHANGELOG.md` entries for `@agentsy/vscode`, `@agentsy/tool-calls`, and `@agentsy/processor` covering all new APIs added in this session. Include:

- New exports
- Changed signatures (with before/after)
- Migration decision tree (when to use `VSCodeStreamBridge` vs `MCPChatBridge`)

#### H. Codemods for import rewrites _(optional, lower confidence on value)_

If the package previously exposed these utilities via different paths, a codemod (jscodeshift or ts-morph) to automate import path updates for consumers upgrading. Only worth doing if there are known external consumers affected by path changes.

---

## Explicitly Skipped

- **agentsy doctor CLI** — user explicitly skipped; do not implement

---

## Quick Validation Commands

```sh
# All packages
pnpm test
pnpm check-types

# vscode package only
cd packages/vscode
pnpm test          # 17 test files, 237 tests
pnpm check-types   # tsc --noEmit, should be clean
pnpm build         # verify dist/ outputs after export map changes
```

---

## File Index (changed/new this session)

| File                                                              | Status                          |
| ----------------------------------------------------------------- | ------------------------------- |
| `packages/processor/src/mcp/transport.ts`                         | New                             |
| `packages/vscode/src/mcp/vscodeBridgeHelper.ts`                   | New                             |
| `packages/vscode/src/mcp/vscodeBridgeHelper.test.ts`              | New                             |
| `packages/vscode/src/mcp/index.ts`                                | New                             |
| `packages/vscode/src/stream-bridge/mcpChatBridge.ts`              | New                             |
| `packages/vscode/src/stream-bridge/mcpChatBridge.test.ts`         | New                             |
| `packages/vscode/src/stream-bridge/index.ts`                      | New                             |
| `packages/vscode/src/vscode-overloads/chatResponseStream.ts`      | New                             |
| `packages/vscode/src/vscode-overloads/chatResponseStream.test.ts` | New                             |
| `packages/vscode/src/vscode-overloads/index.ts`                   | New                             |
| `packages/vscode/src/retry/retryUtility.ts`                       | New                             |
| `packages/vscode/src/retry/retryUtility.test.ts`                  | New                             |
| `packages/vscode/src/retry/index.ts`                              | New                             |
| `packages/tool-calls/src/providerToolsContract.ts`                | New                             |
| `packages/tool-calls/src/buildToolResultMessage.ts`               | Modified                        |
| `packages/vscode/src/error-handling/error-mapper.ts`              | Modified                        |
| `packages/vscode/src/api-key-manager/api-key-manager.ts`          | Modified                        |
| `packages/vscode/src/index.ts`                                    | Modified (new exports added)    |
| `packages/vscode/package.json`                                    | Modified (`sideEffects: false`) |
| `packages/vscode/tsup.config.ts`                                  | Modified (subpath entry points) |
