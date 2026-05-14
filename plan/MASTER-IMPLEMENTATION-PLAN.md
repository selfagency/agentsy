# @agentsy Master Implementation Plan (Canonical)

Last updated: 2026-05-14
Repository: `selfagency/agentsy` (`main`)
Scope: architecture authority, implementation sequencing, and documentation governance

---

## 1) Decision authority

This document is the **single source of truth** for:

- canonical package boundaries
- implementation sequencing and gates
- current-state vs planned-state package maturity
- retirement of superseded planning files
- documentation alignment policy

If any other planning document conflicts with this one, this one is authoritative.

---

## 2) Current repository reality snapshot

### 2.1 Package maturity map

The workspace currently has two package maturity classes:

#### A) Workspace packages with `package.json` manifests (active package units)

- `@agentsy/cli`
- `@agentsy/core`
- `@agentsy/memory`
- `@agentsy/observability`
- `@agentsy/orchestrator`
- `@agentsy/plugins`
- `@agentsy/prompts`
- `@agentsy/providers`
- `@agentsy/renderers`
- `@agentsy/runtime`
- `@agentsy/scripts` (private)
- `@agentsy/secrets`
- `@agentsy/session`
- `@agentsy/testing` (private)
- `@agentsy/tokens`
- `@agentsy/tools`
- `@agentsy/types`
- `@agentsy/ui`
- `@agentsy/vscode`

#### B) Plan-only package domains (directory + implementation plan, no manifest yet)

- `packages/connectors`
- `packages/guardrails`
- `packages/mcp`
- `packages/retrieval`

### 2.2 Critical boundary clarification

`@agentsy/providers` is an active package and is **not deleted**.

Current exports from providers include:

- `@agentsy/providers/adapters`
- `@agentsy/providers/normalizers`
- `@agentsy/providers/pipeline`
- `@agentsy/providers/universal-client`

`@agentsy/core` does not currently replace these provider exports.

---

## 3) Canonical architecture (synthesized)

### 3.1 Layer model

1. **Core stream and transformation primitives** — `@agentsy/core`
2. **Provider integration boundary** — `@agentsy/providers`
3. **Execution and orchestration** — `@agentsy/runtime`, `@agentsy/orchestrator`
4. **Session, memory, and token governance** — `@agentsy/session`, `@agentsy/memory`, `@agentsy/tokens`
5. **Rendering and interaction surfaces** — `@agentsy/renderers`, `@agentsy/ui`, `@agentsy/vscode`, `@agentsy/cli`
6. **Extensibility and policy** — `@agentsy/plugins`, plus planned domains (`connectors`, `guardrails`, `mcp`, `retrieval`)

### 3.2 Data flow (canonical)

1. Provider outputs normalize via `@agentsy/providers/*`
2. Stream events/process transforms run in `@agentsy/core`
3. Multi-step policy and loop behavior run in `@agentsy/orchestrator`
4. Tool execution/approval runtime concerns run in `@agentsy/runtime`
5. Session durability and resume semantics run in `@agentsy/session`
6. Long-horizon memory and token policy feed optimization and continuity (`@agentsy/memory`, `@agentsy/tokens`)
7. Surface adapters and presentation layers consume event/state outputs (`renderers`, `ui`, `vscode`, `cli`)

### 3.3 Recommended external integration targets

Agentsy should stay adapter-first: use proven external projects as interoperability and durability references, but keep the core package boundaries internal and explicit.

- **Observability**: baseline on OpenTelemetry, with optional Tapes-style content-addressable replay and Opik-style trace/eval workflows.
- **Durable execution**: model runtime checkpointing and resume behavior after Hatchet, Agentspan, and Chidori rather than inventing a bespoke persistence story.
- **Prompt efficiency**: treat CacheLLM-like prompt caching as a provider-bound middleware concern, not a core streaming concern.
- **Retrieval and memory**: keep local-first search and memory primitives, but document adapters for R2R- and Mem0-shaped backends when the managed path is needed.
- **Interoperability**: treat MCP, ACP, A2A, A2UI, the Skills Protocol, and Ratify as companion standards for transports, handoffs, UI payloads, skills, and trust boundaries.
- **Orchestration patterns**: borrow deterministic scheduling and event-hook ideas from Bernstein, Rivet, and Yao while keeping Agentsy's runtime/orchestrator split intact.

---

## 4) Boundary decisions (normalized from all prior plans)

### 4.1 Finalized decisions

- `context`, `formatting`, `processor`, `recovery`, `retry`, `sse`, `structured`, `thinking`, `tool-calls`, `xml-filter` live under `@agentsy/core`.
- Provider abstractions and provider-facing adaptation/normalization remain under `@agentsy/providers`.
- Orchestration logic belongs in `@agentsy/orchestrator`; runtime execution controls belong in `@agentsy/runtime`.
- `ag-ui` exists as runtime capability (`@agentsy/runtime/ag-ui`), not a standalone package.
- `token-economy` naming is reconciled to `@agentsy/tokens`.
- Extension concepts formerly spread across standalone plan artifacts map into `@agentsy/plugins` plus package-level implementation plans.

### 4.2 Legacy-name reconciliation

- `context-manager` -> core context + orchestration/runtime integration policy
- `cost-tracker` -> `@agentsy/tokens`
- `telemetry` -> `@agentsy/observability`
- standalone `ag-ui` -> `@agentsy/runtime/ag-ui`
- legacy standalone extension package ideas (skills/superpowers/caveman/slash-commands) -> plugin extension domains

---

## 5) Implementation status (project-wide)

### 5.1 Completed consolidation outcomes

- Core consolidation achieved around `@agentsy/core` subpath modules.
- Runtime/orchestrator split established as the loop + execution separation model.
- Provider package remains active and integrated in docs/tests/examples.
- Token naming and AG-UI package retirement direction are reflected in docs and package boundaries.

### 5.2 Active implementation streams

1. **Manifest-backed package hardening**
   - continue implementation in package-level `IMPLEMENTATION-PLAN.md` files
2. **Plan-only domain promotion to manifest packages**
   - connectors, guardrails, mcp, retrieval
3. **Cross-domain architecture hardening**
   - session durability, policy enforcement, memory/retrieval integration, provider fallback behavior
4. **Docs and migration coherence**
   - remove stale references to superseded plans and stale package assumptions

### 5.3 Source of execution truth

Detailed implementation work is tracked in:

- `packages/*/IMPLEMENTATION-PLAN.md` (package-specific)
- this master plan (cross-domain policy, sequencing, and governance)

---

## 6) Sequenced execution roadmap

### 6.1 Immediate (Now)

1. Keep package boundaries consistent with Section 4.
2. Complete docs consolidation and superseded file retirement.
3. Continue implementation on manifest-backed packages by package plan priority.

### 6.2 Near-term (Next)

1. Promote plan-only domains (`connectors`, `guardrails`, `mcp`, `retrieval`) from plan-only to manifest-backed packages.
2. Add/validate tests and export contracts for each promoted package.
3. Ensure integration points with runtime/orchestrator/providers/session remain acyclic and explicit.
4. For each promoted package, record the chosen external integration targets or standards bridge in that package's implementation plan before implementation starts.

### 6.3 Mid-term (Later)

1. Expand cross-domain resilience and security controls.
2. Strengthen advanced routing/retrieval/policy layers.
3. Maintain additive complexity discipline: introduce capabilities in response to concrete needs and validation data.

---

## 7) Quality, security, and performance gates

For every implementation slice:

1. `pnpm build` passes
2. `pnpm check-types` passes
3. `pnpm test` passes
4. touched package-level plans/docs are updated for boundary-impacting changes
5. no circular dependency regressions

Security and safety invariants:

- destructive operations remain approval-gated
- untrusted inbound/retrieved content is treated as hostile by default
- trust-level filtering and confinement controls remain explicit at runtime boundaries

Performance/reliability guardrails:

- preserve low-latency streaming behavior
- preserve deterministic resume semantics for session continuity
- preserve bounded memory/token behavior over long-running sessions

---

## 8) Documentation governance

### 8.1 Required alignment files

- `README.md`
- `docs/roadmap.md`
- `docs/packages.md`
- `docs/architecture/*`
- `docs/migration/*`

### 8.2 Governance rules

- Do not describe plan-only domains as shipped package artifacts.
- Do not claim providers are merged into core unless code and exports prove it.
- Keep package names and boundaries consistent with actual `packages/*/package.json` manifests.
- When architecture changes, update package plans + master + docs in the same change window.
- When a package plan adopts an external standard or mature library, document the adapter boundary, fallback behavior, and ownership in both the package plan and this master plan.

---

## 9) Supersession and retirement policy

### 9.1 Superseded planning artifacts

Planning artifacts are superseded when their actionable content has been absorbed into:

- this master plan, and/or
- package-level implementation plans.

### 9.2 Current retirement state

- `plan/agentsy-platform-v2.md` — retired/deleted after consolidation into this master plan.

Historical references may still exist in narrative lineage sections, but must not be used as active execution authority.

---

## 10) Resumable implementation guide

1. Confirm package reality (`packages/*`, manifest presence, current exports).
2. Use this master plan for cross-domain authority.
3. Execute from package `IMPLEMENTATION-PLAN.md` files for concrete tasks.
4. Validate each slice with build/typecheck/test gates.
5. Keep docs synchronized for any boundary or ownership change.

---

## 11) Success definition

This plan is being executed successfully when:

- package boundaries in Section 4 match code/export reality
- docs no longer depend on superseded planning artifacts
- plan-only domains are either clearly marked or promoted with manifests and tests
- package-level implementation plans are the active execution engine
- cross-domain governance and gates in Sections 6–8 remain enforced

---

## 12) Change log

- **2026-05-13**: Comprehensive synthesis rewrite; resolved providers/core ambiguity; normalized package maturity model; retired `agentsy-platform-v2.md`; aligned execution authority around package plans + canonical master.
- **2026-05-14**: Added external ecosystem recommendations and explicit adapter guidance for observability, durable execution, retrieval/memory, interoperability, prompt caching, and orchestration patterns.
