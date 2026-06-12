# Phase 22: CortexKit Integration — Magic Context + AFT (Direct Integration)

**Status:** Draft  
**Last Updated:** 2026-06-12  
**Estimated Effort:** ~31h total  
**Nature:** Hard integration — CortexKit packages become workspace dependencies, not optional plugins

---

## Summary

Replace homegrown context/history management with direct integration of two mature CortexKit packages. Both are published MIT npm packages with 1,000+ commits. Instead of plugin-based adoption, they become workspace dependencies resolved at build time.

**Core principle:** CortexKit packages are added as `dependencies` (not optional/peer) in the packages that need them. The AFT Rust binary is resolved automatically at install time. Magic Context's SQLite storage becomes the canonical session/memory store — our code reads/writes the same tables.

### What Changes

| Before | After |
|---|---|
| @agentsy/context has its own compaction, compression, retrieval | @agentsy/context deprecated; MC handles all of it |
| @agentsy/session has its own file-based store | @agentsy/session consumers use MC's SQLite via the session API |
| @agentsy/memory has its own SQLite with full schema | @agentsy/memory keeps its wiki/RAG but MC's store is the primary durable session memory |
| Agent uses built-in read/edit/bash/grep | AFT Rust binary resolves at install; tree-sitter-backed tools are the default |
| `pnpm install` only resolves JS deps | Postinstall hook downloads the AFT binary for the platform |

---

## Dependency Graph

```
@agentsy/session
  └── @cortexkit/magic-context  (hard: manages context history, compartments, compartments)

@agentsy/memory
  ├── @cortexkit/magic-context  (hard: consumes project memories, dreamer coordination)
  └── @cortexkit/aft-bridge      (hard: manages AFT binary for code-level memory operations)

@agentsy/cli
  ├── @cortexkit/magic-context  (hard: setup/doctor commands delegate to MC CLI)
  └── @cortexkit/aft            (hard: setup/doctor commands delegate to AFT CLI)

@agentsy/tokenomics
  └── (no CortexKit dep — but feeds token counts into MC via integration point)

@agentsy/context
  └── (deprecated — no new deps; shim layer only)
```

No optional/peer dependencies. No setup wizard. Everything is guaranteed present at runtime.

---

## Sub-Phase 22.1: Workspace Wiring & Install Flow (4h)

### 22.1.1 — Add CortexKit as Workspace Dependencies (2h)

**`pnpm-workspace.yaml`** — no change needed (already has `packages/*`).

**`package.json` (root)** — no change needed for workspace-level.

**Per-package dependency additions:**

```jsonc
// packages/session/package.json
{
  "dependencies": {
    "@cortexkit/magic-context": "^0.30.0"  // pinned major
  }
}

// packages/memory/package.json
{
  "dependencies": {
    "@cortexkit/magic-context": "^0.30.0",
    "@cortexkit/aft-bridge": "^0.37.0"
  }
}

// packages/cli/package.json
{
  "dependencies": {
    "@cortexkit/magic-context": "^0.30.0",
    "@cortexkit/aft": "^0.37.0"
  }
}
```

**Tasks:**
1. Add deps to `packages/session/package.json`, `packages/memory/package.json`, `packages/cli/package.json`
2. Run `pnpm install` — resolves JS dependencies
3. Verify `node_modules` contains `@cortexkit/*` packages

**Deliverables:**
- Updated `packages/session/package.json`
- Updated `packages/memory/package.json`
- Updated `packages/cli/package.json`
- `pnpm-lock.yaml` updated

### 22.1.2 — Postinstall AFT Binary Resolution (2h)

AFT is a Rust binary. The JS deps give us the TS adapter packages, but the `aft` binary must be on disk. The `@cortexkit/aft-bridge` package includes a resolver that checks cache → npm platform package → PATH → GitHub release.

**Tasks:**

1. **Postinstall script (`scripts/postinstall-aft.ts`)**
   - Runs `ensureBinary()` from `@cortexkit/aft-bridge`
   - Resolves binary to `~/.local/share/cortexkit/aft/bin/` (CortexKit standard)
   - Fails gracefully with a clear error message if resolution fails
   - Idempotent: cached binary is reused

2. **Root `package.json` scripts**
   - `"postinstall": "bun run scripts/postinstall-aft.ts"`
   - Updates only when AFT version changes or cache is cleared

3. **Turbo pipeline update (`turbo.json`)**
   - Add `postinstall` step after `build` (or as a separate task)
   - Ensure it runs before any package that depends on AFT

**Deliverables:**
- `scripts/postinstall-aft.ts`
- Updated root `package.json` (postinstall script)
- Updated `turbo.json` (if needed for ordering)

---

## Sub-Phase 22.2: Magic Context — Direct Storage Integration (12h)

### 22.2.1 — Magic Context Database Access Layer (4h)

MC's durable state lives in a local SQLite database at `~/.local/share/cortexkit/magic-context/context.db`. Our packages need direct read/write access to this database.

**Tasks:**

1. **Database path resolver (`packages/shared/src/cortexkit/db-path.ts`)**
   - `resolveCortexKitDbPath()` → returns the XDG-compatible path to MC's context.db
   - Platform-aware: `~/.local/share/` on Linux/macOS, equivalent on Windows
   - Respects `XDG_DATA_HOME` override

2. **SQLite connection helper (`packages/shared/src/cortexkit/db.ts`)**
   - `openCortexKitDb()` → opens a read-write connection to MC's database
   - Uses `better-sqlite3` (matching MC's native SQLite dependency)
   - Thread-safety: opens in WAL mode for concurrent access
   - Error handling: `SQLITE_BUSY` retry with backoff

3. **Schema constants (`packages/shared/src/cortexkit/schema.ts`)**
   - Table names and column references for the shared tables we need:
     - `project_memories` — persistent knowledge
     - `compartments` — tiered history
     - `session_meta` — per-session metadata
     - `project_memory_epoch` — version tracker

**Deliverables:**
- `packages/shared/src/cortexkit/db-path.ts`
- `packages/shared/src/cortexkit/db.ts`
- `packages/shared/src/cortexkit/schema.ts`

### 22.2.2 — Session Store → Magic Context Migration (4h)

@agentsy/session's `SessionStore` (`packages/session/src/store.ts`) is in-memory. Replace the backing store with MC's SQLite so session state is durable and shared.

**Tasks:**

1. **`CortexKitSessionStore` (`packages/session/src/cortexkit/session-store.ts`)**
   - Implements `SessionStore` interface from `packages/session/src/store.ts`
   - Writes session state as MC's `session_meta` JSON blobs
   - Reads/writes session values into key-value pairs in MC's database
   - Maintains backward compatibility: existing code using `SessionStore` doesn't change

   ```typescript
   export function createCortexKitSessionStore(
     sessionId: string,
     db: Database
   ): SessionStore {
     // Implementation: read/write via MC's session_meta table
     // Values stored as JSON in session_meta.value_blob column
   }
   ```

2. **Session lifecycle integration**
   - `SessionManager.createSession()` opens a CortexKit-backed session store
   - `SessionManager.restoreSession()` reads from MC's compartments + session_meta
   - Crash recovery (`restoreSession`) checks MC's compartment boundaries

3. **Snapshot bridge**
   - `createCortexKitSnapshotBridge()` — reads MC compartments + project memories
   - Wraps them as `SessionSnapshot` objects (same interface, MC-backed)

**Deliverables:**
- `packages/session/src/cortexkit/session-store.ts`
- `packages/session/src/cortexkit/snapshot-bridge.ts`
- Updated `packages/session/src/index.ts`

### 22.2.3 — Memory Store → Magic Context Memory Bridge (4h)

@agentsy/memory's cognitive tier engine and wiki are complementary to MC's project memories. Build a bridge so MC's memories feed into our wiki and vice versa.

**Tasks:**

1. **Memory adapter (`packages/memory/src/cortexkit/memory-adapter.ts`)**
   - `createCortexKitMemoryAdapter(mcDb, wikiManager)` — runs inside the memory engine
   - On ingest: new memories are written to MC's `project_memories` table AND our wiki
   - On recall: results merge from both MC's memory search and our wiki/RAG
   - Dedup: MC's 5-category taxonomy maps to our wiki's entity concepts

2. **Dreamer post-task consumer**
   - After MC's dreamer consolidates/archives memories, our adapter syncs the changes to the wiki
   - MC's dreamer runs are discoverable via `dream_runs` table — we listen for new entries

3. **Tokenizer bridge for accurate token counts**
   - MC's importance/decay uses crude `text.length / 4` estimates
   - Feed accurate BPE counts from @agentsy/tokenomics via the shared DB
   - `packages/tokenomics/src/cortexkit/budget-provider.ts` — simple adapter

**Deliverables:**
- `packages/memory/src/cortexkit/memory-adapter.ts`
- `packages/memory/src/cortexkit/types.ts`
- `packages/tokenomics/src/cortexkit/budget-provider.ts`
- Updated `packages/memory/src/index.ts`

---

## Sub-Phase 22.3: AFT — Direct Tool Integration (8h)

### 22.3.1 — AFT Bridge Pool Integration (3h)

AFT runs as a persistent Rust process per project root. The `@cortexkit/aft-bridge` package provides `BinaryBridge` and `BridgePool` classes to manage these processes.

**Tasks:**

1. **AFT process manager (`packages/shared/src/cortexkit/aft-manager.ts`)**
   - `createAftManager()` — wraps `@cortexkit/aft-bridge`'s `BridgePool`
   - Auto-resolves the binary (postinstall already downloaded it)
   - Spans one `aft` process per project root
   - Reconnects on crash, hot-swaps on version mismatch
   - Exposes send/receive API for all `aft_*` commands

2. **Lazy initialization pattern**
   - First call to any `aft_*` function triggers binary resolution and process start
   - Subsequent calls reuse the warm process
   - ~100ms cold start for the Rust binary

3. **Config surface (`packages/shared/src/cortexkit/aft-config.ts`)**
   - Schema for `aft.jsonc` options that affect our integration
   - Sensible defaults: `bash_compress: true`, `semantic_search: "local"`

**Deliverables:**
- `packages/shared/src/cortexkit/aft-manager.ts`
- `packages/shared/src/cortexkit/aft-config.ts`

### 22.3.2 — Code Health Integration (2h)

Make AFT's `aft_inspect` and code health diagnostics available through our observability layer.

**Tasks:**

1. **Diagnostics bridge (`packages/observability/src/cortexkit/health-bridge.ts`)**
   - `createHealthBridge(aftManager)` — wraps `aft_inspect` as a health check source
   - Feeds diagnostic data (LSP errors, unused exports, complexity hotspots) into our metrics pipeline
   - Distinguishes between AFT-based diagnostics and our fallow-based ones

2. **Fallow ↔ AFT mapping**
   - AFT's `aft_inspect` and our `fallow` tool serve similar roles
   - Document which to use when: `aft_inspect` for quick LSP/complexity, `fallow` for deep dead-code/duplication

**Deliverables:**
- `packages/observability/src/cortexkit/health-bridge.ts`

### 22.3.3 — Import Management Integration (3h)

AFT's language-aware import add/remove/organize (`aft_import`) covers 20+ languages through tree-sitter. Integrate this into our build pipeline.

**Tasks:**

1. **Import linter (`packages/tools/src/cortexkit/import-linter.ts`)**
   - `createImportLinter(aftManager)` — runs `aft_import organize` on changed files
   - Can be called as a precommit check or ad hoc
   - Reports `format_skipped_reason` per AFT's tri-state convention

2. **Language-aware refactoring**
   - Expose `aft_refactor` (symbol move, extract, inline) through our tool surface
   - Adds symbol-rename + import update in one step

**Deliverables:**
- `packages/tools/src/cortexkit/import-linter.ts` (or as part of `packages/tools/src`)

---

## Sub-Phase 22.4: @agentsy/context Removal (2h)

We're v0 — no backward compat. Just remove it.

### 22.4.1 — Audit + Remove (2h)

**Tasks:**
1. Search for all `from "@agentsy/context"` imports across the monorepo
2. For each import: if it's something MC subsumes, delete the call. If it's `createTokenLedger` / `TokenLedgerBudget`, inline into the calling package or move to `@agentsy/tokenomics`
3. Delete `packages/context/` directory
4. Remove `packages/context` from any root workspace references (if any — already in `packages/*` glob so mostly no-op)

**Expected survivors:**
- `createTokenLedger` + `TokenLedgerBudget` → move to `@agentsy/tokenomics/shared/token-ledger.ts` if still imported externally. Likely zero internal consumers since phase 0 tokenizer already has its own counting.

---

## Sub-Phase 22.5: Tests & Docs (6h)

### 22.5.1 — Integration Tests (3h)

**`packages/testing/src/cortexkit/`:**
- `mc-db.test.ts` — open MC's SQLite, verify expected tables exist
- `session-store.test.ts` — create CortexKitSessionStore, write/read/clear values
- `snapshot-bridge.test.ts` — read compartments from a known fixture DB
- `aft-binary.test.ts` — verify AFT binary resolves and responds to version command
- `budget-provider.test.ts` — TokenizerRegistry → MC bridge: verify gpt-4o returns o200k_base counts
- `memory-adapter.test.ts` — write to MC memories, verify wiki page created

### 22.5.2 — Architecture & Integration Docs (2h)

- Update `00-AUTHORITY-ARCHITECTURE.md` with CortexKit layer
- `docs/developers/cortexkit-integration.md` — full integration guide
- `docs/runbooks/migrate-from-agentsy-context.md`
- `docs/developers/patterns/aft-output-compression.md` — crib patterns

### 22.5.3 — Update Plan Index (1h)

- Add Phase 22 to `plan/INDEX.md` (done in draft above)

---

## Effort Summary

| Sub-Phase | Tasks | Hours |
|---|---|---|
| 22.1.1 | Add CortexKit as dependencies | 2h |
| 22.1.2 | Postinstall AFT binary resolution | 2h |
| 22.2.1 | MC database access layer | 4h |
| 22.2.2 | Session store → MC migration | 4h |
| 22.2.3 | Memory store → MC bridge | 4h |
| 22.3.1 | AFT bridge pool integration | 3h |
| 22.3.2 | Code health integration | 2h |
| 22.3.3 | Import management integration | 3h |
| 22.4.1 | Audit + remove @agentsy/context | 2h |
| 22.5.1 | Integration tests | 3h |
| 22.5.2 | Architecture docs | 2h |
| 22.5.3 | Plan index update | 1h |
| **Total** | | **31h** |

---

## Execution Order (Parallel Batches)

```
Batch 1 (parallel):
  22.1.1 — Workspace deps (2h)
  22.4.1 — Context audit (1h)

Batch 2 (parallel — all independent):
  22.1.2 — AFT binary postinstall (2h)
  22.2.1 — MC DB access layer (4h)
  22.4.1 — Audit + remove @agentsy/context (2h)

Batch 3 (parallel — depends on 22.2.1):
  22.2.2 — Session store → MC (4h)
  22.2.3 — Memory → MC bridge (4h)
  22.3.1 — AFT bridge pool (3h)

Batch 4 (parallel — depends on batch 3):
  22.3.2 — Code health integration (2h)
  22.3.3 — Import management (3h)

Batch 5 (serial):
  22.5.1 — Integration tests (3h)
  22.5.2 — Architecture docs (2h)
  22.5.3 — Plan index (1h)
```

---

## Key Decisions

1. **Hard dependency, not plugin** — CortexKit packages are `dependencies` in `package.json`, not optional/peer. `pnpm install` always resolves them.
2. **Shared SQLite** — MC's database is the canonical storage. Our session/memory packages read/write the same tables. No duplication.
3. **AFT binary at install time** — `postinstall` script resolves the Rust binary. No runtime discovery.
4. **@agentsy/context removed from workspace** — no backward compat concern at v0
5. **@agentsy/memory kept** — its wiki, RAG, sync, and cognitive tiers serve a different purpose than MC's session memory. The bridge keeps them synchronized.
6. **No MC/AFT forks** — we consume them as published npm packages and build adapters. Forking creates a maintenance burden.