# @agentsy Authoritative Master Implementation Plan (Canonical)

Last updated: 2026-05-11
Scope: repository-wide implementation, package-boundary canonicalization, and doc/plan consolidation
Branch alignment target: `feature/dx-improvements` (content-shape emulation, not blind copy)

---

## 1) Purpose and decision authority

This document is the **single source of truth** for:

- package boundaries
- merge/rename/delete actions
- migration sequencing and acceptance gates
- branch-sync posture for `feature/dx-improvements`
- retirement of superseded plan files

If any plan/doc conflicts with this file, **this file wins**.

---

## 2) Canonical package-boundary decisions (explicit)

The following directives are final and must be reflected in implementation, docs, and migration guides:

1. `adapters` moves into `providers`
2. `ag-ui` is treated as a protocol capability, not a standalone package
3. `agentic-loop` is part of `runtime`
4. `agent` is part of `orchestrator`
5. `agents` is transformed into `plugins` with Claude-style plugin support and examples (former custom agents)
6. `context` + `context-manager` become one thing under `core`
7. `formatting` is part of `core`
8. `normalizers` is part of `providers`
9. `processor` is part of `core`
10. `recovery` is part of `core`
11. `retry` is part of `core`
12. `scheduler` is part of `orchestrator`
13. `sse` is part of `core`
14. `structured` is part of `core`
15. `thinking` is part of `core`
16. `token-economy` is renamed to `tokens`
17. `tool-calls` is part of `core`
18. `universal-client` is part of `providers`
19. `xml-filter` is part of `core`

---

## 3) Canonical mapping matrix (keep/merge/rename/delete)

| Source           | Canonical target                                  | Action                                           | End state                |
| ---------------- | ------------------------------------------------- | ------------------------------------------------ | ------------------------ |
| adapters         | providers/adapters                                | Merge                                            | Source removed           |
| ag-ui (package)  | protocol surfaces in runtime/orchestrator/plugins | Remove package; keep protocol contracts/adapters | Package removed          |
| agentic-loop     | runtime                                           | Merge                                            | Source removed           |
| agent            | orchestrator                                      | Merge                                            | Source removed           |
| agents           | plugins                                           | Semantic rename + scope shift                    | plugins authoritative    |
| context          | core/context                                      | Merge                                            | Source removed           |
| context-manager  | core/context                                      | Merge                                            | Source removed           |
| formatting       | core/formatting                                   | Merge                                            | Source removed           |
| normalizers      | providers/normalizers                             | Merge                                            | Source removed           |
| processor        | core/processor                                    | Merge                                            | Source removed           |
| recovery         | core/recovery                                     | Merge                                            | Source removed           |
| retry            | core/retry                                        | Merge                                            | Source removed           |
| scheduler        | orchestrator/scheduler                            | Merge                                            | Source removed           |
| sse              | core/sse                                          | Merge                                            | Source removed           |
| structured       | core/structured                                   | Merge                                            | Source removed           |
| thinking         | core/thinking                                     | Merge                                            | Source removed           |
| token-economy    | tokens                                            | Rename                                           | Legacy alias then remove |
| tool-calls       | core/tool-calls                                   | Merge                                            | Source removed           |
| universal-client | providers/universal-client                        | Merge                                            | Source removed           |
| xml-filter       | core/xml-filter                                   | Merge                                            | Source removed           |

---

## 4) Target package topology (post-consolidation)

### 4.1 Primary packages

- `@agentsy/core`
  - `context`, `formatting`, `processor`, `recovery`, `retry`, `sse`, `structured`, `thinking`, `tool-calls`, `xml-filter`
- `@agentsy/providers`
  - `adapters`, `normalizers`, `universal-client`, provider registries/capabilities
- `@agentsy/runtime`
  - merged loop runtime (`agentic-loop` responsibilities)
- `@agentsy/orchestrator`
  - merged agent orchestration + scheduler
- `@agentsy/plugins`
  - Claude-style plugin system + former custom agent examples
- `@agentsy/tokens`
  - renamed `token-economy`

### 4.2 Independent/support packages (retain unless separately superseded)

- `memory`, `retrieval`, `session`, `secrets`, `observability`, `types`, `cli`, `vscode`, `integration`, and other non-conflicting domains.

---

## 5) Branch emulation contract (`feature/dx-improvements`)

We emulate **DX sequencing and quality controls**, not stale boundary assumptions.

### 5.1 Adopt from branch workflow

- content-based sync behavior
- phased porting (vscode/runtime, tool-calls/retry, processor transport, docs)
- “do not port blindly” safeguards

### 5.2 Branch deep-sweep files explicitly considered

From `main..feature/dx-improvements`, docs/plan deltas include:

- `docs/PR63-HANDOFF.md`, `docs/api.md`, `docs/getting-started.md`, migration and package docs updates
- `plan/DECISION-LOG.md`, `plan/PACKAGE-NAMING-MAP.md`, `plan/REVISED-ARCHITECTURE.md`, `plan/revised-implementation-architecture.md`
- added branch planning artifacts: `plan/agentsy-acp-client.md`, `plan/agentsy-memory.md`, `plan/agentsy-memory-integration.md`, `plan/agentsy-secrets.md`, `plan/agentsy-subagents.md`, `plan/agentsy-token-economy.md`, `plan/agentsy-utils-extraction-plan.md`, `plan/pacing-function-implementation.md`, `plan/PR63-HANDOFF.md`
- research-tree updates under `plan/research/*`

These references are integrated in Section 9 and Section 10.

---

## 6) Migration phases (execution order)

### Phase A — Canonicalization lock

- Freeze this mapping across code/docs/plans.
- Introduce temporary compatibility aliases where required (`token-economy` -> `tokens`).

**Gate A**:

- No unresolved boundary contradiction in `plan/*` and `docs/*`.

### Phase B — Provider consolidation wave

- Move `adapters`, `normalizers`, `universal-client` into `providers`.
- Preserve provider contracts and tests.

**Gate B**:

- Provider package exports satisfy previous public API expectations.
- No imports from deprecated provider-side source packages.

### Phase C — Core consolidation wave

- Merge stream and utility packages into `core` modules.

**Gate C**:

- `core` subpath exports compile and tests pass.
- parser/stream/recovery regression suites green.

### Phase D — Runtime + orchestrator reshape

- Merge `agentic-loop` into `runtime`.
- Merge `agent` and `scheduler` into `orchestrator`.

**Gate D**:

- Exactly one loop authority (`runtime`) and one orchestration authority (`orchestrator`).

### Phase E — Plugin surface conversion

- Transform `agents` responsibilities into `plugins`.
- Port former custom agents as plugin examples.

**Gate E**:

- Claude-style plugin flows validated in tests/docs examples.

### Phase F — Token/protocol cleanup

- Complete `token-economy` rename to `tokens`.
- Remove `ag-ui` package artifact; retain protocol support in runtime/orchestrator/plugins surfaces.

**Gate F**:

- No remaining runtime imports of removed packages.

### Phase G — Documentation and plan retirement

- Replace outdated package references across docs.
- Mark superseded plan files for deletion per Section 10.

**Gate G**:

- docs and plans reflect only canonical map.

---

## 7.1) Implementation Status & Completion Tracking (May 2026)

### Phases A-C: ✅ COMPLETE

| Phase | Scope                           | Status  | Gate      | Evidence                                                                                                                        |
| ----- | ------------------------------- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A     | Canonicalization Lock           | ✅ DONE | ✅ PASSED | All 20 canonical boundary decisions locked in DECISION-LOG                                                                      |
| B     | Provider Consolidation          | ✅ DONE | ✅ PASSED | normalizers, adapters, universal-client → @agentsy/providers                                                                    |
| C-1   | Core Consolidation              | ✅ DONE | ✅ PASSED | 10 submodules consolidated (sse, processor, structured, recovery, thinking, tool-calls, context, formatting, xml-filter, retry) |
| C-2   | Providers (Parallel)            | ✅ DONE | ✅ PASSED | Providers wave completed, no circular deps                                                                                      |
| C-3   | AG-UI Removal (Parallel)        | ✅ DONE | ✅ PASSED | Protocol retained in orchestrator; package deleted                                                                              |
| C-4   | Agent → Orchestrator (Parallel) | ✅ DONE | ✅ PASSED | Agent code consolidated to @agentsy/orchestrator/agent; consumer packages audited clean                                         |

**Verification Status (All Phases A-C):**

- `pnpm check-types`: 26–31 tasks passing ✅
- `pnpm build`: 17–20 tasks passing ✅
- `pnpm test`: 35–41 tasks passing, 84 tests ✅
- Documentation updated: 34 files across docs/, plan/, examples/ ✅
- Branch: `feature/Phase-C1-consolidation` clean and pushed to remote ✅

### Phase D: ⏳ LOCKED REQUIREMENTS (Blocked - Awaiting Implementation)

**Scope:** Runtime + Orchestrator reshape
**Blocker:** C-4 gate closure (NOW REMOVED — Phase D may proceed)
**Current State:** Structure in place, stub implementations present

**Locked Requirements Per Section 6:**

1. **Runtime Package Full Implementation** (currently stub)
   - Merge agentic-loop→runtime source code
   - Implement: SessionStore, StreamSnapshot, multi-agent spawning with depth cap
   - Add: DAG workflow execution engine
   - Export public API: createRuntimeLoop, RuntimeConfig, SessionSnapshot, DAG workflow types

2. **Orchestrator Package Expansion** (agent/ag-ui in place; need scheduler merge)
   - Current structure: src/agent/, src/ag-ui/ present
   - Merge scheduler→orchestrator/src/scheduler
   - Implement: 6 orchestrator lifecycle hooks (before-init, after-init, before-step, after-step, before-final, after-final)
   - Add: tool approval mechanism, stop conditions, resumable loops
   - Export public API: createOrchestratorLoop, OrchestratorConfig, hooks, tool approval

3. **Acceptance Gate D Criteria**
   - Exactly one loop authority: `runtime` (agentic-loop merged)
   - Exactly one orchestration authority: `orchestrator` (agent, ag-ui, scheduler merged)
   - `pnpm check-types` passes (no new violations)
   - `pnpm test` passes (all 84+ tests passing)
   - No circular dependencies introduced
   - docs updated for runtime/orchestrator boundary changes

**Unblocked:** Consumer packages already verified clean (no migration needed)

### Phases E-G: ⏳ BLOCKED (Awaiting Phase D)

- **E:** Plugin surface conversion — blocked until orchestrator implementation complete
- **F:** Token/protocol cleanup — blocked until orchestrator protocol boundaries clear
- **G:** Documentation retirement — blocked until F complete

**Recommended Phase D Timeline:** 2–4 hours (scaffold + integration + testing)

---

## 7) Acceptance gates and quality checks

For each migration phase:

1. `pnpm check-types` passes
2. `pnpm test` passes
3. if relevant: coverage gate for touched packages passes
4. no net loss of critical tests
5. no circular dependency regressions
6. docs updated for all user-facing boundary changes

Final release gate:

- migration guides updated
- package catalog reflects canonical topology
- plan retirement completed

---

## 8) Contradiction resolution log (embedded)

Resolved here:

- `runtime` vs `agentic-loop` direction: **agentic-loop -> runtime**
- `ag-ui` standalone package vs protocol-only: **protocol-only; package removed**
- `normalizers` in providers/core/standalone: **providers**
- `scheduler` in providers vs orchestrator: **orchestrator**
- `agents` keep vs plugins conversion: **plugins conversion**
- `token-economy` drift: **rename to tokens complete**

---

## 9) Integrated reference digest (prior planning material absorbed)

This section embeds essential reference intent so historical plan files can be retired.

### 9.1 Platform and architecture lineage

- `plan/agentsy-platform-v1.md`, `plan/agentsy-platform-v2.md`, `plan/agentsy-tech.md`, `plan/REVISED-ARCHITECTURE.md`, `plan/revised-implementation-architecture.md`, `plan/DECISION-LOG.md`, `plan/PACKAGE-NAMING-MAP.md`
- Absorbed as:
  - layered architecture intent
  - package split/merge rationale
  - dependency ordering and acceptance constraints

### 9.2 Feature and domain plans

- `plan/agentsy-features-v1.md`, `plan/agentsy-agents-v1.md`, `plan/agentsy-connectors-v1.md`, `plan/agentsy-scheduler-v1.md`, `plan/agentsy-fileops-mcp.md`, `plan/provider-capability-matrix.md`, `plan/owasp-security-testing-1.md`, `plan/PROMPTS_TODO.md`
- Absorbed as:
  - plugin and connector scope
  - scheduler placement under orchestrator
  - provider capabilities and security testing principles

### 9.3 PRD/deep-dive/research lineage

- `plan/agentsy-prd.md`, `plan/agentsy-prd-notes.md`, `plan/agentsy-prd-task-plan.md`, `plan/agentsy-deep-dive-v1.md`, `plan/agentsy-deep-dive-v2.md`, and `plan/research/*`
- Absorbed as:
  - requirement traceability backbone
  - comparative architecture inputs
  - implementation risk framing

### 9.4 DX branch-added planning artifacts absorbed

- `plan/agentsy-acp-client.md`: ACP client/session lifecycle model and transport-neutral boundaries
- `plan/agentsy-memory.md`: durable memory layers, scope model, lifecycle, safe injection
- `plan/agentsy-memory-integration.md`: memory/token-economy/recovery/subagent integration contract
- `plan/agentsy-secrets.md`: secure secret-store architecture and env hygiene model
- `plan/agentsy-subagents.md`: explicit separation of subagents vs ACP vs A2A
- `plan/agentsy-token-economy.md`: token policy architecture and compression controls
- `plan/agentsy-utils-extraction-plan.md`: utility extraction and reuse strategy
- `plan/pacing-function-implementation.md`: pacing + dead-time utilization model (rolled into `tokens` policy roadmap)
- `plan/PR63-HANDOFF.md` and `docs/PR63-HANDOFF.md`: DX implementation and hardening status

All above are now represented in this plan’s canonical boundaries and migration phases.

---

## 10) Supersession and deletion matrix (plans)

After this master plan is accepted and corresponding docs are updated:

### 10.1 Retire by deletion (superseded)

- `plan/PACKAGE-NAMING-MAP.md`
- `plan/DECISION-LOG.md`
- `plan/REVISED-ARCHITECTURE.md`
- `plan/revised-implementation-architecture.md`
- `plan/prompt.md`
- `plan/rearchelogy-RESEARCH-STATUS.md`

### 10.2 Retire by archive or merge-note (optional)

- `plan/agentsy-platform-v1.md`
- `plan/agentsy-platform-v2.md`
- `plan/agentsy-tech.md`
- `plan/agentsy-features-v1.md`
- `plan/agentsy-agents-v1.md`
- `plan/agentsy-connectors-v1.md`
- `plan/agentsy-scheduler-v1.md`
- `plan/agentsy-fileops-mcp.md`
- `plan/provider-capability-matrix.md`
- `plan/PROMPTS_TODO.md`
- `plan/agentsy-prd*.md`
- `plan/agentsy-deep-dive-*.md`
- `plan/research/*`

### 10.3 Branch-added plan files to retire after merge

- `plan/agentsy-acp-client.md`
- `plan/agentsy-memory.md`
- `plan/agentsy-memory-integration.md`
- `plan/agentsy-secrets.md`
- `plan/agentsy-subagents.md`
- `plan/agentsy-token-economy.md`
- `plan/agentsy-utils-extraction-plan.md`
- `plan/pacing-function-implementation.md`
- `plan/PR63-HANDOFF.md`

Rationale: their material is captured in Section 9 and canonicalized in Sections 2–7.

---

## 11) Documentation reconciliation checklist (required)

Update these docs to canonical topology before deleting superseded plans:

- `docs/packages.md`
- `docs/architecture/package-ecosystem.md`
- `docs/architecture/platform-evolution.md`
- `docs/api.md`
- `docs/getting-started.md`
- `docs/migration/index.md`
- `docs/migration/v0.1-to-v0.2.md`
- `docs/migration/vscode-v0.1-to-v0.2.md`
- package pages under `docs/packages/*` for moved/removed domains
- `docs/PR63-HANDOFF.md` (retain as release hardening history or archive note)

---

## 12) Immediate execution backlog (next commits)

1. Apply canonical package moves in code with compatibility shims where required.
2. Complete import rewrites and export map updates.
3. Run full type/test gates.
4. Update docs listed in Section 11.
5. Remove superseded plan files per Section 10.

---

## 13) Success definition

This consolidation is complete when:

- repository compiles/tests with canonical boundaries
- all docs match canonical map
- superseded plan set is removed/archived
- `feature/dx-improvements` sequencing constraints are satisfied without reintroducing stale boundary assumptions
