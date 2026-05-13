# Plan: Agentsy Master Implementation Plan

**TL;DR:** Phased plan starting from the PR63 DX bug backlog, then consolidating ~12 standalone packages into `@agentsy/core` and `@agentsy/providers`, then building out stub packages into real implementations. Grounded in actual audited state of `main`.

---

## Canonical Boundary Decisions (20, locked)

1. adapters → providers/src/adapters/
2. ag-ui → NO standalone pkg; embed in runtime/orchestrator; **delete packages/ag-ui/**
3. agentic-loop → runtime/src/loop/
4. agent → orchestrator/src/agent/
5. agents → plugins/src/agents/
6. context + context-manager → core/src/context/
7. formatting → core/src/formatting/
8. normalizers → **providers**/src/normalizers/ (NOT core — avoids circular dep)
9. processor → core/src/processor/ (mcp transport ✓ done)
10. recovery → core/src/recovery/
11. retry → core/src/retry/
12. scheduler → orchestrator/src/scheduler/
13. sse → core/src/sse/
14. structured → core/src/structured/
15. thinking → core/src/thinking/
16. token-economy → tokens (@agentsy/tokens)
17. tool-calls → core/src/tool-calls/
18. universal-client → providers/src/universal-client/
19. xml-filter → core/src/xml-filter/
20. markdown → core/src/markdown/

---

## Actual Codebase State (Audited)

### FULLY IMPLEMENTED on `main`

| Package                       | Status                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@agentsy/vscode`             | Full — all DX work ported (retry/, mcp/vscodeBridgeHelper, stream-bridge, vscode-overloads, api-key-manager, etc.)                                 |
| `@agentsy/tool-calls`         | Full — DX changes done (providerToolsContract ✓, buildToolResultMessage ✓). **NOT yet in core**                                                    |
| `@agentsy/orchestrator/agent` | Full — createAgentLoop, types, tests. **NOT yet in orchestrator**                                                                                  |
| `@agentsy/retry`              | Full — withRetry+retryWithBackoff. Has open AbortSignal bug                                                                                        |
| `@agentsy/core`               | Partial — processor/mcp/transport ✓, context/formatting/xml-filter have content; sse/thinking/structured/tool-calls/normalizers dirs are **EMPTY** |

### STUBS ONLY on `main`

`orchestrator`, `runtime`, `providers`, `plugins`, `memory`, `tokens`, `session`, `mcp`, `connectors`, `testing`

---

## PORT-DX Status

### ✅ DONE

PORT-DX-001 (vscode retry) · PORT-DX-003 (vscodeBridgeHelper) · PORT-DX-004 (stream-bridge) · PORT-DX-006 (providerToolsContract) · PORT-DX-007 (buildToolResultMessage) · PORT-DX-010 (processor transport) · PORT-DX-012 (PR63-HANDOFF.md)

### ❌ OPEN

- **HIGH**: `vscode-overloads/chatResponseStream.ts` — `any[]` for filetree → proper `FileTreeEntry[]`
- **HIGH**: `vscode-overloads/chatResponseStream.test.ts` — type mismatches (anchor, filetree)
- **HIGH**: `api-key-manager/api-key-manager.ts` — `getApiKey()` must pass `safeMode` to `initialize()`
- **HIGH**: `api-key-manager/api-key-manager.test.ts` — add error branch coverage
- **HIGH**: index.ts — `createDelayPromise` must resolve immediately on AbortSignal abort
- **MED**: README.md — add CancellationToken/AbortSignal section
- **MED**: 8 doc files with content errors (getting-started, production-provider.md, vscode.md, migration/index.md, migration/v0.1-to-v0.2.md, vitepress config, CHANGELOG links)
- **UNKNOWN**: PORT-DX-002 (vscode-overloads — partial; dir exists but has type bugs), PORT-DX-005 (vscode index.ts alignment), PORT-DX-011 (core processor barrel)

---

## Phases

### Phase 0 — Close PR63 DX Issues (BLOCKER)

Fix all open HIGH/MED issues above before any consolidation work begins.

**Steps:**

1. Fix `vscode-overloads/chatResponseStream.ts`: `any[]` → `FileTreeEntry[]`
2. Fix `vscode-overloads/chatResponseStream.test.ts`: anchor/filetree types
3. Fix `api-key-manager/api-key-manager.ts`: `safeMode` param threading
4. Add error branch test to `api-key-manager/api-key-manager.test.ts`
5. Fix index.ts: abort-responsive delay
6. Update README.md
7. Verify/complete `core/src/processor/index.ts` barrel exports
8. Fix 5+ doc files (getting-started, production-provider, vscode.md, migration/index, migration/v0.1-to-v0.2, config.ts)
9. Fix LOW: CHANGELOG links; add `@agentsy/retry` to package.json where missing

**Gate: G-PORT** — all PORT-DX items merged, CI green

---

### Phase C-1 — Core Consolidation (standalone → @agentsy/core)

**STATUS: ✅ COMPLETE** — All 10 steps completed and verified. Build/check-types/test gates passing.

Migrate in dep order (lower-level first). After each: update core barrel + exports map + tsup config, add compat shim to old package.

**Steps (in order):**

1. ✅ sse → `core/src/sse/`
2. ✅ Verify `core/src/xml-filter/` and `core/src/formatting/` have full content (else copy from standalone)
3. ⊘ `packages/markdown/` → `core/src/markdown/` (NOT APPLICABLE — package doesn't exist in workspace)
4. ✅ recovery → `core/src/recovery/` (fixed import paths in latest session)
5. ✅ thinking → `core/src/thinking/` _(depends on sse)_
6. ✅ tool-calls → `core/src/tool-calls/` _(includes providerToolsContract + buildToolResultMessage)_
7. ✅ structured → `core/src/structured/` _(depends on sse, recovery)_
8. ✅ context + context-manager → `core/src/context/`
9. ✅ retry → `core/src/retry/` _(after Phase 0 AbortSignal fix)_
10. ✅ Update `core/src/index.ts` barrel; update `core/tsup.config.ts`; update `core/package.json` exports

**Cleanup completed:**

- Deleted `packages/recovery/` (standalone package superseded by consolidation)
- Deleted `packages/context-manager/` (broken orphaned package with no package.json)

**Verification gates (all passing):**

- ✅ `pnpm build` — 20/20 tasks successful
- ✅ `pnpm check-types` — 31/31 tasks successful
- ✅ `pnpm test` — 41/41 tasks successful (including recovery consolidation tests)
- ✅ Recovery integration tests — 13/13 passing

**Gate: G-CORE** — ✅ PASSED — zero runtime deps in @agentsy/core, all 11 subpaths exported, test coverage complete

---

### Phase C-2/C-3/C-4 — Parallel Consolidations _(after C-1)_

**C-2 — Providers** _(parallel)_

1. normalizers → `providers/src/normalizers/`
2. adapters → `providers/src/adapters/`
3. universal-client → `providers/src/universal-client/`
4. Wire providers barrel; verify no circular dep with core

**Gate: G-PROVIDERS** — circular dep test passes

**C-3 — AG-UI removal** _(parallel)_

1. Extract AG-UI protocol code from ag-ui
2. Move to `packages/runtime/src/ag-ui/`
3. Delete ag-ui; update imports

**C-4 — Agent → Orchestrator** _(parallel)_

1. Copy src → `packages/orchestrator/src/agent/`
2. Add deprecation shim to agent
3. Copy tests; verify all pass in orchestrator

---

### Phase F-1 — Orchestrator Full Implementation _(depends on C-4)_

Extend `createAgentLoop` from migrated agent code.

**Steps:**

1. Add 6 lifecycle hooks (REQ-004): `beforeStep`, `afterStep`, `beforeToolCall`, `afterToolCall`, `onError`, `onAbort`
2. `StopCondition` predicates: `isStepCount(n)`, `hasToolCall(name?)`, `isLoopFinished()` (REQ-023)
3. `prepareStep` callback + `mergeCallbacks` helper (REQ-024)
4. Parallel tool executor with bounded concurrency + `AbortSignal` (REQ-009)
5. Tool approval engine: `allow`/`ask`/`deny`/`auto` modes (REQ-010, SEC-001)
6. `memoryEngine.startTask()/endTask()` integration stubs (REQ-005)

**Gate: G-ORCH** — 6 hooks pass, StopCondition predicates pass, parallel executor bounded

---

### Phase F-2 — Runtime Full Implementation _(depends on F-1, F-6, C-3)_

1. Session store + StreamSnapshot checkpoints (REQ-011)
2. Multi-agent spawning with max depth cap (REQ-014)
3. AG-UI protocol integration (from C-3)
4. DAG workflow execution (REQ-051)
5. Pause/resume snapshots (REQ-052)
6. A2A protocol (REQ-053)

---

### Phase F-3 — Providers Full Implementation _(depends on C-2)_

1. Provider capability matrix + fallback chains (REQ-013)
2. `openaiResponses` adapter/normalizer (REQ-020)
3. Tool validation + retry (REQ-049)
4. Parallel registry selection (REQ-050)

---

### Phase F-4 — Tokens Full Implementation _(depends on C-1 processor)_

1. Token budget monitoring + `compressConversation()` (REQ-007)
2. `CostThresholdExceeded` event + budget limits (REQ-008)
3. 6 new `LLMStreamProcessor` events: `ContextWindowWillOverflow`, `ChatCompressed`, `LoopDetected`, `Citation`, `Retry`, `InvalidStream` (REQ-006)

---

### Phase F-5 — Memory Full Implementation _(independent)_

1. 3-layer: raw log → Karpathy wiki → vector RAG over wiki only (REQ-016/017)
2. 5 OpenBrain tools: `memory_search`, `memory_capture`, `memory_list`, `memory_stats`, `memory_lint` (REQ-018)
3. Context injection via `<memory_context>` XML tags (REQ-019)
4. `MemoryScope` enum: session/user/project/team (REQ-066)
5. `TeamBankConfig` + retention tags (REQ-067/068)
6. Multi-strategy recall: keyword → semantic → hybrid (REQ-069)
7. White-box memory editing CRUD (REQ-055)
8. Memory scope isolation (SEC-005)

**Gate: G-MEMORY** — 3-layer integration test, wiki-only vector indexing, team-scope isolation

---

### Phase F-6 — Session _(independent)_

1. `StreamSnapshot` serialize/restore (REQ-011)
2. Persistence adapter interface (file/DB/KV)
3. Conversation branching (REQ-056)

---

### Phase F-7 — MCP _(independent)_

1. MCP 2025-06-18 spec compliance (REQ-012)
2. `mcp-auto-install` v0.2.1 (REQ-031); `dryRun: true` default (REQ-032)
3. MCP trust level registry (SEC-007)
4. SSRF prevention for tool URLs (SEC-008)

---

### Phase F-8 — Plugins _(depends on F-5, F-7)_

1. `CavemanMode` enum (lite/full/ultra/wenyan variants) + `CavemanManager` (REQ-025/026)
2. `caveman-shrink` MCP proxy — wraps any tool, preserves `inputSchema`, compresses output (REQ-027/028)
3. `SkillsManager`: reads `.agents/skills/**/SKILL.md` (REQ-029/030)
4. superpowers v5.0.7 integration (REQ-033) + context-signal auto-activation (REQ-034)
5. `SlashCommandRegistry` + stock commands `/help /reset /skill /mode` (REQ-035/036)
6. SKILL.md frontmatter parser (REQ-037)
7. `AgentModeFactory` + 9 garry skill modes + `detectPhase` + `selectSkills(≤3)` (REQ-071..082)
8. WIP checkpoints (REQ-083), safety guardrails / injection detection (REQ-084), design taste memory (REQ-085)
9. LATS / Evaluator-Optimizer / Gate-Driven patterns (REQ-086..088)
10. Plugin manifest signing (SEC-004)

**Gate: G-PLUGINS** — caveman/superpowers/garry modes pass unit tests, SKILL.md present, caveman-shrink preserves inputSchema

---

### Phase F-9 — Connectors _(depends on F-1)_

`ConnectorGateway` + Telegram + Discord + Slack + OpenClaw CLI surface (REQ-038..042)

---

### Phase F-10 — Testing Harness _(depends on F-1, F-2)_

`UserSimulatorAgent` + `JudgeAgent` + `RedTeamAgent`; pass^k scoring; Crescendo multi-turn red team (REQ-057..059)

---

### Phase F-11 — Security Hardening _(woven into F-1..F-8)_

Tests for SEC-001..016 covering approval engine, path confinement, secret redaction, plugin signing, scope isolation, injection detection, MCP trust, SSRF.

**Gate: G-SECURITY** — all SEC-001..016 with tests

---

### Phase F-12 — Docs _(follows all F phases)_

Architecture diagrams updated for C-1/C-2 consolidations; user profile install paths (UP-1..UP-7); API reference for all new public APIs; CHANGELOG cleanup.

---

## Dependency Order

```text
Phase 0 (PR63 fixes) ─→ C-1 (core consolidation)
                              ↓
                    C-2 ─┬─ C-3 ─┬─ C-4   (all parallel)
                         ↓       ↓       ↓
                        F-3    runtime  F-1 (orchestrator)
                               (F-2)      ↓
                    F-4 (tokens) ──────── F-9 (connectors)
                    F-5 (memory)
                    F-6 (session) ──→ F-2
                    F-7 (mcp) ──→ F-8 (plugins)
                    F-10 (testing) ← F-1 + F-2
                    F-11 (security) ← woven throughout
                    F-12 (docs) ← last
```

---

## Acceptance Gates

| Gate        | Condition                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------- |
| G-PORT      | All PORT-DX OPEN items merged, CI green                                                           |
| G-CORE      | @agentsy/core zero runtime deps, all subpaths exported, compat shims work                         |
| G-PROVIDERS | normalizers in providers (not core), circular dep test passes                                     |
| G-ORCH      | createAgentLoop 6 hooks pass, StopConditions pass, parallel executor bounded                      |
| G-MEMORY    | 3-layer integration test, wiki-only RAG, team-scope isolation                                     |
| G-PLUGINS   | caveman/superpowers/garry pass unit tests, SKILL.md present, caveman-shrink preserves inputSchema |
| G-SECURITY  | all SEC-001..016 covered with tests                                                               |
| G-CI        | `pnpm check-types && pnpm test` pass from root                                                    |
