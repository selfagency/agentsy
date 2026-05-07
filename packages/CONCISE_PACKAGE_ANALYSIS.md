# Package Architecture Analysis: Current vs Planned

## Executive Summary

**Current State:** 40 active packages (38 with package.json, 1 empty core, 1 stale tool-calls/src/)
**Target State:** 22 packages (6 tiers)
**Gap:** 18 packages need consolidation/updates

---

## Tier-by-Tier Analysis

### Tier 0: Foundation (6 packages) ✓

| Package | Status | Notes |
|---------|--------|-------|
| types | ✓ Live | Core type system |
| xml-filter | ✓ Live | XML privacy stripping |
| context | ✓ Live | Context window events |
| formatting | ✓ Live | Response formatting |
| sse | ✓ Live | SSE parsing |
| structured | ✓ Live | Structured output |

**Status:** All aligned with plan. No changes needed.

---

### Tier 1: Stream Processing (3 packages) ✓

| Package | Status | Notes |
|---------|--------|-------|
| processor | ✓ Live | LLMStreamProcessor, state map |
| recovery | ✓ Live | Session recovery, snapshot |
| thinking | ✓ Live | Thinking block parsing |

**Status:** All aligned. No changes needed.

---

### Tier 2: Agent Runtime (3 packages) ✓

| Package | Status | Notes |
|---------|--------|-------|
| agentic-loop | ✓ Live | Agent loop orchestration |
| token-economy | ✓ Live | Token budgets & shaping |
| session | ✓ Live | Session management |

**Status:** All aligned. No changes needed.

---

### Tier 3: Provider Integration (4 packages) ✓

| Package | Status | Notes |
|---------|--------|-------|
| mcp | ✓ Live | MCP integrator |
| providers | ✓ Live | Provider registry, manager |
| memory | ✓ Live | Durable knowledge store |
| retrieval | ✓ Live | RAG document store |

**Status:** All aligned. No changes needed.

---

### Tier 4: Tools & Integrations (4 packages) ✓

| Package | Status | Notes |
|---------|--------|-------|
| tools | ✓ Live | Built-in agent tools |
| telemetry | ✓ Live | Observability |
| guardrails | ✓ Live | Safety moderation |
| testing | ✓ Live | Scenario libraries |

**Status:** All aligned. No changes needed.

---

### Tier 5: User Experience (3 packages) ✓

| Package | Status | Notes |
|---------|--------|-------|
| ui | ✓ Live | UI layer components |
| agents | ✓ Live | Plugin system |
| cli | ✓ Live | CLI package |

**Status:** All aligned. No changes needed.

---

### Tier 6: Protocol Bridges (2 packages, 1 missing) ⚠️

| Package | Status | Notes |
|---------|--------|-------|
| slash-commands | ✗ **MISSING** | 12 stock commands, SKILL.md parsing |
| skills | ✗ **MISSING** | SkillsManager, progressive loading |
| connectors | ✓ Live | External bridges (WhatsApp, Matrix, etc.) |

**Status:** `slash-commands` and `skills` packages missing. `connectors` exists but may need consolidation.

---

## Consolidation Gaps

### Packages to Merge/Consolidate (9 packages)

| Old Package | Target | Reason |
|-------------|--------|--------|
| **core** | Delete | Empty directory, no functionality |
| **context-manager** | Merge into `context` | Overlaps context window events |
| **runtime** | Merge into `processors` | Runtime concerns belong in stream processing |
| **scheduler** | Delete or move to `providers` | Scheduling is provider-specific |
| **retry** | Delete or move to `context` | Retry mechanism fits retry pattern in token-economy |
| **repl** | Delete or move to `cli` | REPL is a CLI feature |
| **secrets** | Move to `providers` | API key management belongs to providers |
| **ag-ui** | Merge into `ui` | UI components should be in UI package |
| **adapters** | Delete | Functionality should be in `providers` subfolders |

### Packages to Split (3 packages)

| Old Package | Split Target | Reason |
|-------------|---------------|--------|
| **tool-calls** | Extract to `tools` + `providers` | Hybrid: tool schemas go to tools, provider-specific calls go to providers |
| **normalizers** | ⏳ **DEFERRED** | Plan indicates they should be in `providers/_providers/*` subfolders |
| **renderers** | Keep | Standalone component library |

### Previously Marked But Now Live (6 packages)

| Package | Original Note | Current Status |
|---------|---------------|----------------|
| **agentic-loop** | "from agent package" | ✓ Extracted successfully |
| **token-economy** | "renamed from..." | ✓ Live |
| **ag-ui** | "UI components" | ✓ Live |
| **agents** | "plugin system" | ✓ Live |
| **cli** | "New MVP" | ✓ Live |
| **connectors** | "External bridge" | ✓ Live |

### Redundant/Empty Packages (1 package)

| Package | Current State | Action |
|---------|---------------|--------|
| **core** | 0-byte directory | **DELETE** - no functionality, effectively dead |

---

## Missing Packages (2 packages)

Based on revised-implementation-architecture.md:

| Package | Purpose | Tier | Reason Missing |
|---------|---------|------|----------------|
| **slash-commands** | Command system with 12 stock commands & SKILL.md parsing | Tier 6 | Not created yet |
| **skills** | SkillsManager with progressive loading & orchestration | Tier 6 | Not created yet |

**Note:** `connectors` package exists but only handles protocol bridges, not the broader command/skills orchestration described in plan.

---

## Need for Consolidation (vs Code Inspo)

### "Inspo from Old Packages, Not Identical Copies"

| Current Package | Has Code from Old Package | Notes |
|-----------------|---------------------------|-------|
| `token-economy` | Code from old `token-economy` | Integration complete |
| `providers` | Code from old `providers/` | ✗ Should be clean reimplementation |
| `memory` | Code from old `memory/` | ✗ Should be clean reimplementation |
| `retrieval` | Code from old `retrieval/` | ✗ Should be clean reimplementation |
| `agentic-loop` | Code from old `agents/` | ✓ Proper extraction done |
| `listeners` | Code from old `listeners/`? | Possibly needs migration |

### Flagged for Conservative Consolidation

1. **`tool-calls` package** - Contains hybrid logic:
   - Tool call structures → should live in `tools` package
   - Provider-specific tool calling → should live in `providers` package
   - Current state: Mixed responsibilities

2. **`normalizers` package** - Plan indicates they should be in provider subfolders but not yet moved:
   - `anthropic/normalizers/` → `providers/_Providers/anthropic/`
   - `openai/normalizers/` → `providers/_Providers/openai/`
   - Currently: Standalone package with unclear ownership

3. **`integration` package** - Accumulated cross-package tests:
   - Currently consumes 16 packages as dependencies
   - Purpose is testing, not implementation
   - ✗ Should be renamed to `__tests__/cross-package` or `__integration__/` per package instead

---

## Final Count Summary

### Before Analysis (Current State)
```
Total: 40 active packages
- Tier 0: 6/6 ✓
- Tier 1: 3/3 ✓
- Tier 2: 3/3 ✓
- Tier 3: 4/4 ✓
- Tier 4: 4/4 ✓
- Tier 5: 3/3 ✓
- Tier 6: 1/3 ⚠️ (connectors exists, slash-commands & skills missing)
- Extra/Merge: 4 more
```

### Target State (After Consolidation)
```
Total: 22 packages (target from plan)
- Tier 0: 6/6 ✓
- Tier 1: 3/3 ✓
- Tier 2: 3/3 ✓
- Tier 3: 4/4 ✓
- Tier 4: 4/4 ✓
- Tier 5: 3/3 ✓
- Tier 6: 2/3 ⚠️ (slash-commands, skills missing)
- Extra/Merge: 1 deletion
```

### Consolidation Impact
```
Packages to delete: 1 (core)
Packages to merge: 5 (context-manager, runtime, scheduler, retry, repl)
Packages to delete: 1 (secrets) → actions to providers
Packages to merge: 1 (ag-ui → ui)
Packages to delete: 1 (adapters) → actions to providers
Packages pending split: 1 (tool-calls) → moves to tools + providers
Packages pending folderization: 1 (normalizers) → providers/_Providers/* subfolders
Packages pending refactor: 1 (integration) → cross-package tests in proper locations

Total packages after consolidation: 22 (target)
Net reduction: 18 packages from current state
```

---

## Immediate Priorities

### Phase 1: Clean Up Dead/Empty Packages (Week 1)
1. Delete `packages/core/` (empty directory)
2. Delete `packages/test/`, `packages/src/` references if any

### Phase 2: Merge Redundant/Accumulated Packages (Weeks 2-3)
1. Merge `core` → Delete
2. Merge `context-manager` into `context`
3. Merge `runtime` into `processor`
4. Merge `scheduler` into `providers`
5. Merge `retry` into `context` or delete
6. Merge `repl` into `cli`
7. Move `secrets` functionality into `providers`
8. Merge `ag-ui` into `ui`
9. Delete `adapters` (consolidate into `providers`)

### Phase 3: Split Hybrid Packages (Weeks 4-5)
1. Analyze `tool-calls`:
   - Move tool schemas to `tools/`
   - Move provider-specific tool calling to `providers/_Providers/*`
   - Delete standalone `tool-calls` package
2. Refactor `normalizers`:
   - Move to provider subfolders in `providers/_Providers/*`
   - Delete standalone `normalizers` package

### Phase 4: Missing Packages (Weeks 6-8)
1. Create `packages/slash-commands/`
2. Create `packages/skills/`
3. Update `connectors` to match commands/skills patterns

### Phase 5: Test Infrastructure Cleanup (Week 9)
1. Refactor `integration` package:
   - Rename to `__tests__/integration` or move per-package
   - Stop being a circular test dependency collector

---

## Architecture Alignment Checklist

Before each tier can proceed:

- [x] Tier 0: All 6 packages aligned with revised architecture
- [x] Tier 1: All 3 packages aligned
- [x] Tier 2: All 3 packages aligned
- [x] Tier 3: All 4 packages aligned
- [x] Tier 4: All 4 packages aligned
- [x] Tier 5: All 3 packages aligned
- [ ] Tier 6: Connectors ✓, slash-commands ✗, skills ✗
- [ ] Consolidation: All 9 packages moved/merged/deleted
- [ ] Dependency Graph: No cycles
- [ ] Build Pipeline: All 22 packages have working builds
- [ ] Verification: `pnpm install --frozen-lockfile` succeeds

---

## Final Code-to-Architecture Mapping

### Live, Aligned (33 packages)
Types, xml-filter, context, formatting, sse, structured, processor, recovery, thinking, agentic-loop, token-economy, session, mcp, providers, memory, retrieval, tools, telemetry, guardrails, testing, ui, agents, cli, connectors, plugis, adapters, renderers, normalizers, integration, secrets, scheduler, retry, repl

### To Consolidate (9 packages)
core, context-manager, runtime, scheduler, retry, repl, secrets, ag-ui, adapters

### To Split (2 packages)
tool-calls → tools + providers, normalizers → providers subfolders

### Missing (2 packages)
slash-commands, skills

### Note on `plugins`
The `plugins` package shows up in listing but appears to test for it separately. Should verify if this is active or dead.

---

## Recommendations

### Critical Path
1. **Delete `core`** immediately (no purpose)
2. **Merge `context-manager`**, `runtime`, `scheduler`, `retry`, `repl` in next 2 weeks
3. **Split `tool-calls`** (hybrid responsibilities)
4. **Create `slash-commands`** and `skills` packages**

### ⚠️ Area of Concern
**`normalizers`** package is moving responsibility but structure not yet defined:
- Plan says: Move to `providers/_Providers/*/normalizers/`
- Current reality: Standalone package with unclear future
- Recommendation: Clarify ownership immediately during consolidation phase

### Optional Refinements
1. **`integration` package** - Consider renaming to `__integration__/` subdirectory or subpackage infrastructure
2. **`plugins` package** - Verify if active; may be meant for plugin examples rather than framework code
3. **`renderers` package** - Consider if this belongs in `ui` package vs standalone component library

---

**Analysis Date:** May 7, 2026
**Packages Count:** 40 current → 22 target
**Consolidation Priority:** High (Phase 1-3)
**Missing Packages:** 2 (slash-commands, skills)