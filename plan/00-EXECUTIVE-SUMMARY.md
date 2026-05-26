# @agentsy Unified Implementation Plan — Executive Summary

**Last Updated:** 2026-05-25  
**Status:** Phase 0-1 VERIFIED COMPLETE; Phases 2-12 in planning/progress  
**Authority Document:** Master plan consolidating 25+ planning artifacts + codebase audit  

---

## Quick Navigation

| Document | Purpose | Audience |
|----------|---------|----------|
| **00-AUTHORITY-ARCHITECTURE.md** | Layer model, package boundaries, ecosystem decisions | Architects, TLs |
| **01-PHASE-0-FOUNDATION.md** | ✅ Verified complete baseline | Reference |
| **02-PHASE-R1-PLAN-SYNC.md** | Read-only: update 8 IMPLEMENTATION-PLAN.md files | Plan owners |
| **03-PHASE-1-CONTRACT-STABILIZATION.md** | Cross-package API contracts, MSW bootstrap | Teams on core packages |
| **04-PHASE-2-TUI-VERTICAL-SLICE.md** | FIRST DOGFOODABLE: streaming chat TUI | CLI, renderers, core teams |
| **05-PHASE-3-MODEL-SELECTION.md** | Provider routing, local LLM discovery | Models, providers, renderers |
| **06-PHASE-3.5-LLM-GATEWAY.md** | Semantic gateway, failover, quota tracking | Gateway team |
| **07-PHASE-4-ORCHESTRATION.md** | Hooks, skills, instructions, agents, secrets, budget | Orchestrator, plugins, runtime |
| **08-PHASE-5-TOOLS-APPROVALS.md** | Safe tool execution, deny-by-default, guardrails | Runtime, tools, guardrails |
| **09-PHASE-6-SESSION-DURABILITY.md** | Resume, branching, snapshot persistence | Session, runtime |
| **10-PHASE-7-MEMORY-INTEGRATION.md** | AgentFS migration, memory capture/retrieval | Memory, runtime |
| **11-PHASE-8-RAG-AUGMENTATION.md** | 4-stage retrieval, hybrid ranking, reranking | Retrieval, memory |
| **12-PHASE-9-OBSERVABILITY.md** | Cost tracking, tracing, structured logging | Observability, all packages |
| **13-PHASE-10-CONFIGURATION.md** | XDG config, interactive editor, plan-only promotion | CLI, plugins, mcp |
| **14-PHASE-11-INTEGRATION.md** | Standards compliance (MCP/ACP/A2UI), complete manifests | All packages |
| **15-PHASE-12-HARDENING-RELEASE.md** | Smoke tests, CI gates, cross-surface parity, closure | All teams, Release |
| **16-CLI-SURFACE-CMUX.md** | Optional: cmux integration for terminal multiplexing | CLI team |
| **17-GOVERNANCE-QUALITY-GATES.md** | Build rules, security invariants, completion protocol | All teams |

---

## Execution Timeline

```text
Phase 0  ✅ DONE (observability, runtime, orchestrator, memory)
         ↓
Phase R1 (Plan sync — 1 hr)
         ↓
Phase 1  (Contract stabilization — 2 hrs)
         ↓
Phase 2  (TUI vertical slice — 11 hrs) ← FIRST DOGFOODABLE MILESTONE
         ↓
Phase 3  (Model selection — 5 hrs) + Phase 3.5 (Gateway — 8 hrs)
         ↓
Phase 4  (Orchestration — 24 hrs) ← GATE BEFORE TOOLS
         ↓
Phase 5  (Tools+approvals — 16 hrs)
         ↓
Phase 6  (Session durability — 8 hrs)
         ↓
Phase 7  (Memory integration — 20 hrs)
         ↓
Phase 8  (RAG pipeline — 14 hrs)
         ↓
Phase 9  (Observability — 12 hrs) ← GATE BEFORE GA
         ↓
Phase 10 (Configuration — 10 hrs) + plan-only promotion
         ↓
Phase 11 (Integration — 8 hrs)
         ↓
Phase 12 (Hardening+release — 10 hrs)

TOTAL FORWARD WORK: ~150 hrs
```

---

## Key Decisions (Non-Negotiable)

1. **Dogfood-first** — Every phase produces CLI-demoable artifact
2. **Vertical-slice ordering** — Build TUI chat early; validate each subsequent capability
3. **Approval-gated execution** — Destructive ops deny-by-default before any autonomous mode
4. **Hook/Prompt Axiom** — Safety lives in hooks (deterministic), never in system prompts
5. **Always-injected instructions vs lazy-loaded skills** — Narrow behavior vs expand capability
6. **Hard budget enforcement** — Token caps active before autonomous mode
7. **Default-deny hooks** — No hook runs unless explicitly registered
8. **Untrusted content discipline** — Retrieved/model-generated content treated as hostile
9. **Structured logging contract** — All packages emit through `@agentsy/observability` (tslog)
10. **Universal quality gates** — `pnpm build`, `pnpm check-types`, `pnpm test` green; no circular deps

---

## Verified Completion Status (2026-05-25 Codebase Audit)

### Phase 0 — ✅ COMPLETE

| Component | Evidence |
|-----------|----------|
| Token compression (75% output / 46% memory) | `@agentsy/tokens` + `@agentsy/core/context` |
| Memory 5-tier foundation | `@agentsy/memory` — 214 TS files, production-ready |
| Types audit + stability | TASK-067 — 17 modules, 7 TSDoc, zero `any` |
| Observability P0-1 (tracer + logger) | `@agentsy/observability` — 13 TS files ✅ |
| Runtime hook taxonomy P0-2 | `@agentsy/runtime` — hooks/registry/types ✅ |
| Orchestrator hook compilation P0-2 | `@agentsy/orchestrator` — compileHooks ✅ |

### Critical Compliance Findings

**Major underreporting corrected (6 packages):**

- **observability**: Marked ~30% → Actually P0-1 **COMPLETE ✅**
- **runtime**: Marked \"hooks needed\" → P0-2 **COMPLETE ✅**
- **orchestrator**: Marked ~40% → P0-2 **COMPLETE ✅**
- **core**: Marked \"stream-to-events missing\" → TASK-009 **DONE ✅**
- **providers**: Marked \"request path missing\" → TASK-008 **DONE ✅**
- **plugins**: Marked ~10% → TASK-091 **DONE ✅**

---

## Immediate Next Steps

1. **Phase R1** — Update 7 package IMPLEMENTATION-PLAN.md files with verified marks (1 hr)
2. **Phase 1** — Stabilize cross-package contracts + MSW bootstrap (2 hrs)
3. **Phase 2** — TUI vertical slice (11 hrs) ← **UNBLOCKED READY TO START**
4. Continue phases 3-12 per sequencing

---

## Success Definition

✅ Phase 0-1 foundations verified complete  
✅ Package boundaries match code/export reality  
✅ All deferred work correctly scheduled in Phases 2-12  
✅ Cross-domain governance enforced  
✅ Package-level IMPLEMENTATION-PLAN.md files reflect verified completion  

---

**Read next:** `00-AUTHORITY-ARCHITECTURE.md` (canonical layer model) or jump to `04-PHASE-2-TUI-VERTICAL-SLICE.md` (unblocked work)
