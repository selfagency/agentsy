# API Posture Matrix

> Monorepo-wide audit of each package's entry points, type export completeness,
> TSDoc coverage, and build configuration.
>
> Generated: 2026-05-26  
> Scope: 7 critical infrastructure packages

---

## Legend

| Icon | Meaning |
|------|---------|
| ✅ | Complete / compliant |
| ⚠️ | Partial — action recommended |
| ❌ | Missing — action required |
| — | Not applicable |

---

## `@agentsy/core` — Stream Processing Bundle

**tsup `dts: true`** ✅ | **13 entry points**

| Entry Point | Exports | TSDoc |
|---|---|---|
| `.` (index) | Core types, constants, `createLLMStreamProcessor` | ✅ |
| `./processor` | `LLMStreamProcessor`, `StreamProcessingOptions`, processor types | ✅ |
| `./context` | `ContextBuilder`, context management types | ✅ |
| `./formatting` | Format helpers | ✅ |
| `./recovery` | Recovery strategies | ✅ |
| `./retry` | Retry logic | ✅ |
| `./sse` | SSE parser, event types | ✅ |
| `./stream-to-events` | `streamToEvents`, event types | ✅ |
| `./structured` | JSON streaming, partial repair, `emitPartials` | ✅ |
| `./thinking` | Thinking block parser | ✅ |
| `./tool-calls` | Tool call extraction | ✅ |
| `./xml-filter` | XML stream filter | ✅ |

**Verdict: ✅ All entry points verified stable. TSDoc comprehensive.**

---

## `@agentsy/types` — Shared Types

**tsup `dts: true`** ✅ | **1 entry point**

| Entry Point | Exports | TSDoc |
|---|---|---|
| `.` (index) | All shared TypeScript types/interfaces | ✅ |

**Verdict: ✅ Single entry point, clean barrel exports, fully typed.**

---

## `@agentsy/providers` — Provider Normalizers & Adapters

**tsup `dts: true`** ✅ | **6 entry points**

| Entry Point | Exports | TSDoc |
|---|---|---|
| `.` (index) | Provider abstractions, types | ✅ |
| `./adapters` | Provider adapter implementations | ✅ |
| `./normalizers` | Provider-specific normalizers | ✅ |
| `./pipeline` | Provider pipeline | ✅ |
| `./request-path` | Request path utilities | ✅ |
| `./universal-client` | `UniversalClient`, client types | ✅ |

**Verdict: ✅ Stable. 6 subpath exports all verified.**

---

## `@agentsy/memory` — Multi-Tier Memory

**tsup `dts: true`** ✅ | **10 entry points**

| Entry Point | Exports | TSDoc |
|---|---|---|
| `.` (index) | Main barrel | ✅ |
| `./cognitive` | Cognitive tier system | ⚠️ Interfaces documented, minor gaps |
| `./mcp` | MCP protocol types/utilities | ✅ |
| `./hooks` | Memory hooks | ✅ |
| `./config` | Configuration | ✅ |
| `./init` | Initialization | ✅ |
| `./cli` | CLI commands | ✅ |
| `./commands/init` | Init subcommand | ✅ |
| `./commands/mcp` | MCP subcommand | ✅ |

**TSDoc Gaps Filled (Phase 1):**

- `wiki-manager.ts`: `WikiManagerDependencies` — added ✅
- `knowledge-base.ts`: `KnowledgeBaseManager`, `KnowledgeBaseManagerOptions` — added ✅
- Prior: `RawCaptureInput`, `RawCapture`, `WikiPageInput`, `WikiPage`, `WikiPageHistoryEntry`, `PageDiff`, `ConceptRelation`, `VectorEntry`, `VectorSearchResult`, `WikiManager` — already documented

**Verdict: ✅ All critical interfaces now have TSDoc. Minor cognitive tier gaps remain for Phase 2.**

---

## `@agentsy/runtime` — Agent Execution Runtime

**tsup `dts: true`** ✅ | **3 entry points**

| Entry Point | Exports | TSDoc |
|---|---|---|
| `.` (index) | Runtime barrel | ✅ |
| `./ag-ui` | Agent-Generated UI protocol adapter | ✅ |
| `./loop` | Agent execution loop | ✅ |

**TSDoc Gaps Filled (Phase 1):**

- `hooks/types.ts` — already fully documented (audited, no gaps)

**Verdict: ✅ All types documented. Clean bill of health.**

---

## `@agentsy/orchestrator` — Agent Orchestration

**⚠️ `dts: true` MISSING (FIXED)** → Now added to `tsup.config.ts`

**tsup `dts: true`** ⚠️ **→ ✅ FIXED** | **2 entry points**

| Entry Point | Exports | TSDoc |
|---|---|---|
| `.` (index) | Orchestration barrel | ✅ |
| `./agent` | Agent subsystem | ✅ |

**TSDoc Gaps Filled (Phase 1):**

- `core/engine.ts`: `WorkflowContext`, `ExecutionOptions` — added ✅

**Verdict: ⚠️ Was missing `dts: true` in tsup config (no `.d.ts` emitted). Fixed. All types now documented.**

---

## `@agentsy/session` — Session Management

**tsup `dts: true`** ✅ | **1 entry point**

| Entry Point | Exports | TSDoc |
|---|---|---|
| `.` (index) | Session types, snapshot, store | ✅ |

**TSDoc Gaps Filled (Phase 1):**

- `ReusableSessionSegment` — added ✅
- `SessionState` — added ✅
- `SessionSnapshot` — added ✅
- `CreateSessionSnapshotInput` — added ✅
- `SessionStore` — added ✅

**Verdict: ✅ Single entry point, all interfaces now documented.**

---

## Summary

### TSDoc Coverage (Phase 1)

| Package | Audited | Fixed | Remaining |
|---|---|---|---|
| `@agentsy/core` | 0 gaps | — | 0 |
| `@agentsy/types` | 0 gaps | — | 0 |
| `@agentsy/providers` | 0 gaps | — | 0 |
| `@agentsy/memory` | 13 interfaces | 3 (WikiManagerDeps, KnowledgeBaseManager, KBMgrOptions) | Minor cognitive tier |
| `@agentsy/runtime` | 0 gaps | — | 0 |
| `@agentsy/orchestrator` | 2 interfaces | 2 (WorkflowContext, ExecutionOptions) | 0 |
| `@agentsy/session` | 5 interfaces | 5 (all) | 0 |

### Build Configuration

| Package | dts:true | types in exports | Notes |
|---|---|---|---|
| `@agentsy/core` | ✅ | ✅ | |
| `@agentsy/types` | ✅ | ✅ | |
| `@agentsy/providers` | ✅ | ✅ | Top-level `types` stale but `exports` correct |
| `@agentsy/memory` | ✅ | ✅ | |
| `@agentsy/runtime` | ✅ | ✅ | |
| `@agentsy/orchestrator` | ✅ (FIXED) | ✅ | Was silently not emitting `.d.ts` |
| `@agentsy/session` | ✅ | ✅ | |

### Action Items

1. ✅ **orchestrator `dts: true`** — Added. Next build will emit `.d.ts` files.
2. ⏳ **providers top-level `types` field** — Low priority. `"types": "./src/index.ts"` is a legacy fallback; `exports` correctly references `./dist/index.d.ts`.
3. ⏳ **Memory cognitive tier TSDoc** — Minor gaps remain for Phase 2.
