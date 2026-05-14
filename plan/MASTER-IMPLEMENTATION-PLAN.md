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

### 3.3 Recommended external integration targets (UPDATED)

Agentsy should stay adapter-first: use proven external projects as interoperability and durability references, but keep the core package boundaries internal and explicit.

**NEW Ecosystem Analysis Findings (2026-05-14):**

#### A) Packages to Use Instead of Building (Bundle Strategy):

1. **models.dev** - Model selection engine with 100+ providers and complete capability/cost data
2. **Honker** - SQLite extension for pub/sub and task queues (local-first with Turso sync)
3. **AgentFS** - Agent-specific filesystem with tool call tracking and audit trails (PRIMARY)
4. **tldw_server** (CONDITIONAL) - Media analysis capabilities only if critically needed
5. **mcp-rag-server** - Zero-ceremony RAG with local LLM support (PRIMARY)
6. **Mirage** (CONDITIONAL) - Multi-resource unification only if external resource access needed

#### B) Patterns to Adopt:

**Critical Patterns:**

- **Token optimization** (Caveman): 75% output reduction, 46% memory file compression
- **Virtual sandbox** (Flue): 90% infrastructure savings, virtual-first execution
- **Content addressing** (re_gent): BLAKE3 hashing, automatic deduplication
- **Role orchestration** (Flue): Clean precedence rules (call > session > harness)
- **Task delegation** (Flue): Isolated message history for parallel execution

**High-Priority Patterns:**

- **Auth gateway** (SuperHQ): Credential proxy for sandbox secrets
- **Structural sandboxing** (SpiceAI): Undeclared paths are unmountable
- **Schema-first secrets** (Varlock): Agents receive schema, not raw secrets
- **Preview-first execution** (Stagehand): Show tool effects before execution
- **Tree-sitter tools** (Maki): Efficient code analysis (59 token cost vs 224 token reads)

#### C) Standards/Frameworks to Embrace:

**Tier 1 (Industry Standards):**

- **MCP** - Tool integration (enhance existing)
- **ACP** - Editor integration (NEW)
- **A2UI** - UI generation (align existing AG-UI)

**Tier 2 (Strategic Integration):**

- **Ratify** - Identity and trust infrastructure (NEW)
- **Skills Protocol** - Modular capability framework (NEW)
- **AP2** - Payment protocol (domain-specific, NEW)

**Legacy Standards:**

- **Observability** - Baseline on OpenTelemetry, optional Tapes/Opik workflows
- **Durable execution** - Hatchet, Agentspan, Chidori patterns (document adapters)
- **Prompt caching** - CacheLLM-middleware patterns
- **Retrieval/memory backends** - Local-first with R2R/Mem0 adapter documentation

#### D) UPDATED Integration Architecture:

```typescript
// Unified external integration layer
interface ExternalIntegrationLayer {
  // Core agent ecosystem (PRIMARY)
  agentOperations: {
    filesystem: 'AgentFS (Turso-native, agent-specific)',
    coordination: {
      local: 'Honker extension (1-5ms latency)',
      sync: 'Turso cloud sync (persistence + backup)'
    },
    retrieval: 'mcp-rag-server (MCP-native, zero-ceremony)',
    modelSelection: 'models.dev API (100+ providers)'
  };

  // External resource access (CONDITIONAL)
  externalResources: {
    resources: ['S3', 'GitHub', 'Notion', 'Linear', 'Slack'] (via mirage if needed),
    useCase: 'Multi-resource integration and workflow composition'
  };

  // Quality & security (HIGH PRIORITY)
  analytics: 'Codeburn (cost-yield analysis)',
  browserAutomation: 'Stagehand (hybrid AI+code)',
  secrets: 'Varlock (schema-first safety)',
  codeReview: 'Crit (browser UI with round-diff tracking)',
  tools: {
    efficient: 'Maki (tree-sitter, token-efficient)',
    permissions: 'Maki (inference via AST)'
  };
}
```

#### E) Implementation Priority Phases:

**Phase 0 (Weeks 1-16): Token Optimization Foundation (CRITICAL)**

- Output compression (75% savings) in `@agentsy/tokens`
- Memory file compression (46% savings) in `@agentsy/core/context`
- Virtual sandbox mode (90% savings) in `@agentsy/runtime` sandbox
- BLAKE3 content addressing in `@agentsy/memory`
- Maki tree-sitter tool efficiency in `@agentsy/tools`
- Role-based orchestration in `@agentsy/orchestrator`
- Task delegation with isolated history in `@agentsy/runtime`
- **ROI:** 60% total cost reduction, 3x faster responses

**Phase 1 (Weeks 1-8): Memory & Coordination Enhancement**

- **Turso + Honker Hybrid:** Local SQLite with honk extension for coordination (1-5ms latency)
- **Integration Pattern:** Local honker for events/queues/scheduling, Turso for cloud sync/backup
- **Expected Benefits:** 90% infrastructure savings, atomic operations, single database for persistence+coordination
- **Memory coordination:** honker pub/sub for cross-process events, task queues for orchestration
- **Turso sync:** Cloud persistence, analytics, backup with conflict resolution
- **mcp-rag-server integration:** Zero-ceremony RAG, local-only processing, MCP-native design

**Phase 2 (Weeks 9-26): Tool & Resource Integration**

- **AgentFS PRIMARY:** Agent-specific filesystem (Turso-native, KV store, toolcall audit trails)
- **mirage CONDITIONAL:** Multi-resource unification (S3, GitHub, Notion, Linear, Slack) only if needed
- **Integration Pattern:** AgentFS for all agent operations, mirage only for external resources
- **Expected Benefits:** 30-40% integration cost reduction, 3-5x faster workflow development
- **Tool coordination:** honker pub/sub for memory updates, task queues for background workflows
- **Maki integration:** Tree-sitter tools (59 token cost vs 224 reads), permission inference

**Phase 3 (Weeks 1-24): Model Selection & Analytics**

- **models.dev integration:** New `@agentsy/models` package with 100+ provider support
- **Expected Benefits:** Cost-optimized model selection, automatic updates, capability-aware matching
- **Codeburn analytics:** Cost-yield analysis, deterministic optimization suggestions
- **Varlock secrets:** Schema-first validation, runtime leak prevention

**Phase 4 (Weeks 1-24): Standards & Protocol Integration**

- **ACP integration:** Editor integration server/client patterns (NEW)
- **Enhanced MCP 1.0:** Dynamic tool loading, enterprise gateway configuration
- **Skills Protocol:** Modular capability framework (NEW)
- **Other standards:** Ratify identity, AP2 payments (domain-specific)

#### F) Expected Combined Benefits:

**Efficiency:**

- **Token reduction:** 60% total cost reduction (75% output + 46% memory + infrastructure)
- **Coordination:** 90% infrastructure savings via local honker vs custom broker
- **Tool integration:** 30-40% via unified AgentFS/conditional mirage approaches

**Performance:**

- **Latency:** 1-5ms coordination vs current polling approach
- **Speed:** 3-5x faster agent workflow development with efficient tools
- **Reliability:** Atomic operations prevent lost tasks/corrupted workflows

**Agent Experience:**

- **Simplicity:** 50% tool integration complexity reduction
- **Productivity:** 3-5x faster multi-resource agent workflows
- **Flexibility:** Add new resources/backends without agent code changes

**Security & Privacy:**

- **Local-first:** Zero external data transfer for privacy-sensitive work
- **Safe execution:** Copy-on-write filesystem isolation with AgentFS
- **Consistent:** Unified permission model across all resource types

**Cost Optimization:**

- **Model selection:** Intelligent model choice based on capabilities and pricing
- **Token efficiency:** 75% output token reduction with Caveman
- **Infrastructure:** 90% cost reduction for simple tasks with virtual sandbox

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
