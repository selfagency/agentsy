# @agentsy Master Implementation Plan (Canonical)

Last updated: 2026-05-15
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
- `@agentsy/models`
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

Any package that is valuable outside the framework must also behave as a reusable library: it should expose a stable, framework-agnostic public API, typed entry points, and documentation/examples that let external projects consume it without depending on CLI or host-specific internals.

**NEW Ecosystem Analysis Findings (2026-05-14):**

#### A) Packages to Use Instead of Building (Bundle Strategy)

1. **models.dev** - Model selection engine with 100+ providers and complete capability/cost data
2. **Honker** - SQLite extension for pub/sub and task queues (local-first with Turso sync)
3. **AgentFS** - Agent-specific filesystem with tool call tracking and audit trails (PRIMARY)
4. **tldw_server** (CONDITIONAL) - Media analysis capabilities only if critically needed
5. **mcp-rag-server** - Zero-ceremony RAG with local LLM support (PRIMARY)
6. **Mirage** (CONDITIONAL) - Multi-resource unification only if external resource access needed

#### A.1) Local LLM provider support strategy (NEW)

Agentsy must support both cloud and local model execution by combining catalog intelligence with protocol adapters:

- **Catalog + selection:** `@agentsy/models` (models.dev + local provider profiles)
- **Protocol adapters:** `@agentsy/providers` (OpenAI-compatible, Ollama-native, native local runtimes)
- **First-party local runtime provider:** `node-llama-cpp`-based adapter in `@agentsy/providers`

Initial local provider targets:

1. Ollama
2. vLLM OpenAI-compatible server
3. LM Studio
4. Lemonade Server
5. Docker Model Runner
6. Jan API Server
7. Apfel
8. Agentsy native local provider (`node-llama-cpp`)

#### A.2) Runner model acquisition strategy (NEW)

Agentsy runner must support searching and fetching models from open ecosystems:

1. Hugging Face (GGUF/llama.cpp-compatible model discovery + artifact fetch)
2. Ollama registry/local manifests
3. Additional open providers via pluggable source adapters

Canonical ownership:

- `@agentsy/models`: recommendation, ranking, and fetch-plan generation
- `@agentsy/providers`: source/protocol adapters
- `@agentsy/runtime`: execution of fetch/install/activation lifecycle

#### A.3) Local automodel selection strategy (NEW)

Agentsy should support a **model recommendation → runtime selection → hot-swap** pipeline for local use cases.

Reference sources:

- `llmfit`-style hardware fit scoring and benchmark overlays
- `llama-swap`-style hot-swapped OpenAI/Anthropic-compatible endpoint management

System behavior:

1. `@agentsy/models` ranks candidates using hardware + benchmark + cost criteria.
2. `@agentsy/runtime` chooses direct backend, fetch/install, or llama-swap hot-swap routing.
3. `@agentsy/providers` owns the protocol adapters and request filters.

Local automodel selection should prefer a single stable API endpoint when it improves developer experience, but it must keep direct provider fallback available.

#### B) Patterns to Adopt

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
- **Spec-first workflow** (Superpowers, gstack, Sisyphus): think/plan/build/review/test/ship as explicit gated phases
- **Category-based delegation** (oh-my-openagent): route work by semantic mode/category rather than hardcoded vendor personas
- **Iterative research loops** (local-deep-researcher, local-deep-research): search → summarize → reflect → re-search with citations and configurable strategies
- **Planner/conductor/worker separation** (Sisyphus): keep planning and orchestration responsibilities distinct from execution workers
- **Optional computer-use substrate** (Agent-S): grounding/reflection/computer-use should be pluggable capability, not required for normal coding flows

#### C) Standards/Frameworks to Embrace

**Tier 1 (Industry Standards):**

- **MCP** - Tool integration (enhance existing)
- **ACP** - Editor integration (NEW)
- **A2UI** - UI generation (align existing AG-UI)

**Tier 2 (Strategic Integration):**

- **Ratify** - Identity and trust infrastructure (NEW)
- **Skills Protocol** - Modular capability framework (NEW)
- **AP2** - Payment protocol (domain-specific, NEW)

#### C.1) First-party superagents plugin strategy (NEW)

Agentsy should not ship third-party named agent packs such as Caveman, Superpowers, or Garry's mode as canonical built-ins. Instead, it should ship a **first-party official superagents plugin** that is installable like any external plugin, but prepackaged with `@agentsy/cli` for zero-config usage.

Canonical shape:

- distribution model: standard plugin registry/discovery path, independently installable, bundled by default in CLI
- mode set:
  - `research` — iterative retrieval, synthesis, citation, source strategy selection, and gap detection
  - `plan` — interview-driven clarification, architecture review, implementation-plan generation, and explicit approval gates
  - `agent` — execution mode combining investigation discipline, review/test gates, completion enforcement, and safe shipping workflows
- picker UX: mode discovery must include bundled modes plus user/project-installed modes from `~/.agents`, project `.agents`, and `~/.config/agentsy`

Pattern sources to adapt rather than rebrand:

- `minds-platform`: deploy-anywhere platform mindset; automation + retrieval as dual foundations
- `Agent-S`: optional grounding, reflection, and computer-use execution patterns
- `local-deep-researcher` and `local-deep-research`: configurable research strategies, iterative loops, and citation-heavy outputs
- `superpowers`: spec-first workflow, TDD discipline, and subagent-driven execution methodology
- `oh-my-openagent` and Sisyphus: planner/conductor/worker separation, category-based delegation, background specialists, and continuation enforcement
- `gstack`: think → plan → build → review → test → ship → reflect pipeline, checkpointing, QA/review/ship specialization, and multi-host skill distribution

Harness decision:

- Do **not** adopt `oh-my-openagent` wholesale as the Agentsy runtime harness.
- Do adopt its strongest orchestration and specialization patterns within Agentsy's own `plugins`, `orchestrator`, `runtime`, and `renderers` boundaries.
- Keep the official superagents plugin host-neutral so it works in Agentsy first and remains reusable by any compatible external host.

**Legacy Standards:**

- **Observability** - Baseline on OpenTelemetry for traces/metrics + `tslog` as the universal cross-domain structured logger, optional Tapes/Opik workflows
- **Durable execution** - Hatchet, Agentspan, Chidori patterns (document adapters)
- **Prompt caching** - CacheLLM-middleware patterns
- **Retrieval/memory backends** - Local-first with R2R/Mem0 adapter documentation

#### D) UPDATED Integration Architecture

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

### 2.3 Public API posture matrix

Packages below are classified by whether they should expose a reusable, framework-agnostic external API.

| Package                  | API posture                               | Notes                                                                                             |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@agentsy/core`          | External API required                     | Core stream/context primitives must remain consumable by non-CLI hosts.                           |
| `@agentsy/connectors`    | External API required                     | Bridge/adaptation layer should be reusable by other runtimes and integrations.                    |
| `@agentsy/guardrails`    | External API required                     | Policy enforcement must be importable outside the CLI.                                            |
| `@agentsy/mcp`           | External API required                     | Server/client integration surface is inherently external-facing.                                  |
| `@agentsy/memory`        | External API required                     | Memory capture, retrieval, and reuse are library concerns as well as framework concerns.          |
| `@agentsy/models`        | External API required                     | Selection/ranking/catalog APIs should be reusable by other apps.                                  |
| `@agentsy/observability` | External API required                     | Tracing/redaction/event helpers should be consumable by other projects.                           |
| `@agentsy/orchestrator`  | External API required                     | Planning and policy APIs should be available to alternate hosts.                                  |
| `@agentsy/plugins`       | External API required                     | Registry/manifests/capability filtering are designed for reuse.                                   |
| `@agentsy/prompts`       | External API required                     | Deterministic prompt composition helpers must be importable independently.                        |
| `@agentsy/providers`     | External API required                     | Protocol adapters are a primary integration boundary.                                             |
| `@agentsy/renderers`     | External API required                     | Ink/rendering components should be reusable by other terminal apps.                               |
| `@agentsy/retrieval`     | External API required                     | Retrieval adapters and query interfaces should be importable directly.                            |
| `@agentsy/runtime`       | External API required                     | Execution policy/runtime orchestration should be host-agnostic.                                   |
| `@agentsy/secrets`       | External API required                     | Secrets lifecycle helpers should be reusable by other hosts.                                      |
| `@agentsy/session`       | External API required                     | Persistence/resume state models should be available to other integrations.                        |
| `@agentsy/tokens`        | External API required                     | Token accounting and budget policy helpers are cross-host utilities.                              |
| `@agentsy/tools`         | External API required                     | Tool schemas/registry contracts should be reusable outside the CLI.                               |
| `@agentsy/types`         | External API required                     | Shared contracts are the foundation of external consumption.                                      |
| `@agentsy/ui`            | External API required                     | Shared UI state/contracts should be consumable by other surfaces.                                 |
| `@agentsy/cli`           | Host surface / no external API commitment | Primary product shell; may export narrow helpers, but external reuse is not the default contract. |
| `@agentsy/scripts`       | Host-only/private                         | Operational scripts are not a public library surface.                                             |
| `@agentsy/testing`       | Host-only/private                         | Test utilities stay private unless explicitly promoted.                                           |
| `@agentsy/vscode`        | Host surface / integration package        | Extension integration surface; public API only if needed for editor-side composition.             |

Planned package domains (`packages/connectors`, `packages/guardrails`, `packages/mcp`, `packages/retrieval`) should inherit the same rule once promoted to manifest-bearing workspaces.

#### E) Implementation Priority Phases

**Phase 0 (Weeks 1-16): Token Optimization Foundation (CRITICAL)**

- Output compression (75% savings) in `@agentsy/tokens`
- Memory file compression (46% savings) in `@agentsy/core/context`
- Virtual sandbox mode (90% savings) in `@agentsy/runtime` sandbox
- BLAKE3 content addressing in `@agentsy/memory`
- Cache-aware reusable context fingerprints across memory, context manager, and session resume paths
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
- **Context reuse:** fingerprinted stable segments and cache-aware memory assembly inspired by LMCache

**Phase 2 (Weeks 9-26): Tool & Resource Integration**

- **AgentFS PRIMARY:** Agent-specific filesystem (Turso-native, KV store, toolcall audit trails)
- **mirage CONDITIONAL:** Multi-resource unification (S3, GitHub, Notion, Linear, Slack) only if needed
- **Integration Pattern:** AgentFS for all agent operations, mirage only for external resources
- **Expected Benefits:** 30-40% integration cost reduction, 3-5x faster workflow development
- **Tool coordination:** honker pub/sub for memory updates, task queues for background workflows
- **Maki integration:** Tree-sitter tools (59 token cost vs 224 reads), permission inference

**Phase 3 (Weeks 1-24): Model Selection & Analytics**

- **models.dev integration:** New `@agentsy/models` package with 100+ provider support
- **Local LLM provider profiles:** Full support matrix (Ollama, vLLM, LM Studio, Lemonade, Docker Model Runner, Jan, Apfel)
- **First-party local runtime provider:** `node-llama-cpp` adapter plan in `@agentsy/providers`
- **Recommendation engine enhancement:** llm-stats developer endpoint integration for criteria-driven ranking
- **Runner acquisition flows:** search/fetch/install support for Hugging Face + Ollama + open providers
- **Local automodel selection:** llama-swap-backed hot-swap routing for multiple local backends
- **Expected Benefits:** Cost-optimized model selection, automatic updates, capability-aware matching
- **Codeburn analytics:** Cost-yield analysis, deterministic optimization suggestions
- **Varlock secrets:** Schema-first validation, runtime leak prevention

**Phase 4 (Weeks 1-24): Standards & Protocol Integration**

- **ACP integration:** Editor integration server/client patterns (NEW)
- **Enhanced MCP 1.0:** Dynamic tool loading, enterprise gateway configuration
- **Skills Protocol:** Modular capability framework (NEW)
- **Structured output handler:** adopt schema-first + grammar-backed structured generation patterns from Outlines/llguidance
- **Other standards:** Ratify identity, AP2 payments (domain-specific)

#### F) Expected Combined Benefits

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
- Model catalog federation, scoring, and route recommendation live under `@agentsy/models`.
- Local provider protocol implementations (including node-llama-cpp native runtime) remain under `@agentsy/providers`.
- Runner-side model acquisition lifecycle (fetch/install/activate) lives under `@agentsy/runtime`.
- Runtime-owned local automodel selection routing may delegate to llama-swap when multiple backends are viable.
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
- Comprehensive compliance matrix created comparing plan requirements to actual code (see `IMPLEMENTATION-COMPLIANCE-MATRIX.md`).

### 5.2 Code Review-Based Compliance Assessment

> **CRITICAL FINDING (2026-05-17):** Plan completion estimates based on ✅ marks are **wildly inaccurate**. Actual code review reveals major gaps.

**Verified Progress vs Plans:**

| Package                    | Plan Tasks   | Implemented         | Compliance | Status                                     |
| -------------------------- | ------------ | ------------------- | ---------- | ------------------------------------------ |
| **@agentsy/tools**         | 10           | 2 stubs             | 15%        | 🔴 CRITICAL - No actual tool functionality |
| **@agentsy/secrets**       | 12           | 1 interface         | 8%         | 🔴 CRITICAL - No persistence or encryption |
| **@agentsy/guardrails**    | 8+           | 2 error classes     | 12%        | 🔴 CRITICAL - No policy engine             |
| **@agentsy/observability** | 10           | 3 type stubs        | 30%        | 🟠 HIGH - No implementation behind types   |
| **@agentsy/orchestrator**  | 10           | 4 interfaces        | 40%        | 🟠 HIGH - No orchestration logic           |
| **@agentsy/cli**           | 8            | 3 commands          | 37%        | 🟠 HIGH - No interactive shell/oclif       |
| **@agentsy/memory**        | 52           | 51+ implementations | 98%        | 🟢 HIGH - Nearly complete                  |
| **@agentsy/runtime**       | 6 plan tasks | 32 files+           | 200%+      | 🟢 BONUS - Beyond plan scope               |
| **@agentsy/session**       | 30           | 6 interfaces        | 60%        | 🟡 MEDIUM - Entity detection beyond plan   |
| **@agentsy/tokens**        | 28           | 7 files             | 10%        | 🟡 MEDIUM - Compression only               |

### 5.3 Active implementation streams

1. **Critical production blockers** (must address first)
   - Complete tools baseline (repl/file/shell/web/mcp bridge) - currently 0% functional
   - Persistent secret storage - currently in-memory only
   - Guardrails policy engine - currently only types with no enforcement
   - Observability implementation behind type stubs
2. **Plan-only domain promotion to manifest packages**
   - connectors (10% complete), guardrails (23% complete), mcp (5% complete), retrieval (30% complete)
3. **Cross-domain architecture hardening**
   - session durability, policy enforcement, memory/retrieval integration, provider fallback behavior
4. **Docs and migration coherence**
   - remove stale references to superseded plans and stale package assumptions
   - Update TODO.txt with accurate gaps from code review (not plan checkmarks)

### 5.4 Source of execution truth

Detailed implementation work is tracked in:

- `packages/*/IMPLEMENTATION-PLAN.md` (package-specific planning)
- `plan/IMPLEMENTATION-COMPLIANCE-MATRIX.md` (verified gaps from code review)
- `plan/TODO.txt` (task tracking, needs update with accurate status)
- `plan/BIDIRECTIONAL-GAP-ANALYSIS.md` (120+ detailed tasks missing from TODO, ecosystem decisions missing from package plans)
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

## 14) Cross-Package Task Coordination (Missing Tasks)

This section captures the bidirectional gaps where TODO.txt and package implementation plans are out of sync. For the full detailed analysis, see `plan/BIDIRECTIONAL-GAP-ANALYSIS.md`.

### 14.1 Package plan tasks NOT captured in TODO.txt (120+ detailed tasks missing)

| Package           | Tasks Missing                                                                                                               | Critical Impact                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **cli**           | 18 detailed tasks including oclif plugin stack, cmux integration contracts, subagent orchestration, interactive shell flows | Cannot implement interactive CLI or plugin system          |
| **core**          | 12 detailed tasks including chunk/event contracts, compile-time snapshots, error taxonomy                                   | Cannot stabilize stream processing contracts               |
| **guardrails**    | 12 detailed tasks + ethical rules including policy schema, evaluators, transform/redaction, red-team coverage               | Cannot enforce security policies or detect PII/secrets     |
| **orchestrator**  | 12 detailed tasks + agent mode infrastructure including planner/strategy interfaces, plan/act loops, supermode contracts    | Cannot implement multi-step planning or agent mode bundles |
| **observability** | 22 detailed tasks including semantic conventions, tslog logger, trace assembly, metric aggregation                          | Cannot monitor production or debug issues                  |
| **runtime**       | 6 additional tasks beyond current ✅ marks (7-12) including integration tests, telemetry emission, stress suites            | Core loop mostly complete but missing verification         |
| **session**       | 6 additional tasks beyond current ✅ marks (7-12) including integration tests, regressions, operational workflows           | Persistence mostly complete but missing verification       |
| **secrets**       | 12 detailed tasks including keychain adapters, rotation flows, diagnostics integrations                                     | Cannot store secrets securely or rotate them               |
| **tools**         | 12 detailed tasks including tool definition contracts, baseline tool sets, error handling                                   | Agent cannot execute actual operations                     |
| **tokens**        | 6 additional tasks beyond current ✅ marks (7-12) including integration tests, performance benchmarks                       | Compression complete but cost tracking incomplete          |

### 14.2 TODO.txt content NOT in package plans

| Content Type                        | Missing From                   | What's Missing                                                                                                                                      |
| ----------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ecosystem integration targets       | All package plans              | Bundle strategy (models.dev, Honker, AgentFS, mcp-rag-server, Maki), conditional packages (tldw_server, mirage, Codeburn, Stagehand, Varlock, Crit) |
| Turso+Honker hybrid strategy        | memory package plan            | CRITICAL CONSTRAINT that Turso does NOT support honk extension, local-first coordination architecture                                               |
| Phase 0-3 sequencing                | Individual package plans       | 26-priority structure across Foundation/Integration/Feature/Polish phases                                                                           |
| Local LLM provider support strategy | models/providers package plans | Targets (Ollama, vLLM, LM Studio, Lemonade, Docker Model Runner, Jan, Apfel), node-llama-cpp first-party adapter                                    |
| Runner model acquisition strategy   | models/providers package plans | Hugging Face, Ollama marketplace artifact fetch and model search                                                                                    |
| Local automodel selection strategy  | models/providers minimal plan  | llmfit hardware scoring, llama-swap hot-swap endpoint management                                                                                    |

### 14.3 Recommended synchronization actions

**Immediate (Before next implementation cycle):**

1. **Add package plan tasks to TODO.txt**: Incorporate the 120+ detailed TASK-XXX-XXX tasks into the priority structure in TODO.txt.

2. **Add ecosystem decisions to package plans**: Document Turso+Honker strategy in @agentsy/memory plan, models.dev targets in @agentsy/models plan, etc.

3. **Verify completion marks**: Cross-reference all ✅ marks in package plans with actual code via compliance matrix.

4. **Phase claim verification**: Verify Phase 0-2 completion claims against verified task completion in individual plans.

**Structural (Long-term):**

5. **Automate synchronization**: Consider a script that reads package plan task IDs, checks actual exports, and auto-completes ✅ marks when they match.

6. **Governance enforcement**: Add pre-commit hook that prevents marking tasks complete without verified implementation.

---

## 15) Success definition

This plan is being executed successfully when:

- package boundaries in Section 4 match code/export reality
- docs no longer depend on superseded planning artifacts
- plan-only domains are either clearly marked or promoted with manifests and tests
- package-level implementation plans are the active execution engine
- cross-domain governance and gates in Sections 6–8 remain enforced
- completion tracking follows the verification protocol in Section 12
- TODO.txt, package plans, and compliance matrix are synchronized per Section 12.3

---

## 12) Completion verification and synchronization governance

### 12.1 Single source of truth hierarchy

Completion status is tracked in this priority order:

1. **IMPLEMENTATION-COMPLIANCE-MATRIX.md** (authoritative): Verified code review comparing plan requirements to actual implementation. This is the ground truth for what's actually shipped.

2. **Individual package IMPLEMENTATION-PLAN.md** (source of tasks): Detailed task-level requirements per package. Completion marks (✅) should be verified against code before being marked complete.

3. **TODO.txt** (summary view): High-level task tracking and priority sequencing. Should be a read-only summary of package plan tasks, not an independent source of truth.

4. **This MASTER-IMPLEMENTATION-PLAN.md** (cross-domain governance): Cross-package policy, sequencing, and architectural decisions that transcend individual package details.

### 12.2 Verification protocol

Before marking a task ✅ complete in a package implementation plan:

1. **Verify actual implementation**: Check that the required function/class/module actually exists and exports the documented API.
2. **Run build/typecheck/test**: Ensure pnpm build, pnpm check-types, and pnpm test all pass for the relevant package.
3. **Update compliance matrix**: After code review verification, update IMPLEMENTATION-COMPLIANCE-MATRIX.md with the new completion status.
4. **Sync to TODO.txt**: Propagate verified completion status back to the priority tracking in TODO.txt.

### 12.3 Synchronization requirements

When work is completed:

1. **Package plan first**: Mark task ✅ complete in `packages/<pkg>/IMPLEMENTATION-PLAN.md` with verification date.
2. **Compliance matrix second**: Update `plan/IMPLEMENTATION-COMPLIANCE-MATRIX.md` with verified implementation status.
3. **TODO.txt third**: Update completion counts and priority status based on verified compliance matrix data.
4. **Master plan fourth**: Update this master plan's Section 5.2 with verified cross-package status.

**NO COMPLETION CLAIMS WITHOUT VERIFICATION**: Never mark a task as complete or claim a package is X% complete based on estimates alone. Completion must be verified through code review and the compliance matrix.

### 12.4 Critical discrepancy resolution (2026-05-17)

The 2026-05-17 compliance audit revealed significant discrepancies:

- **TODO.txt claimed 30% completion for runtime/session/tokens** but compliance matrix showed 200%/60%/10% and package plans had mixed verification
- **TODO.txt claimed Phase 0-2 COMPLETE** but compliance matrix showed 98% for memory and missing tasks for core/tokens
- **118+ detailed package plan tasks** were missing from TODO entirely
- **Ecosystem integration decisions** (Turso+Honker, AgentFS, models.dev, etc.) were in TODO but not in individual package plans

**Resolution**: All completion tracking going forward must follow the verification protocol in Section 12.2 and the single source of truth hierarchy in Section 12.1.

---

## 12) Change log

- **2026-05-13**: Comprehensive synthesis rewrite; resolved providers/core ambiguity; normalized package maturity model; retired `agentsy-platform-v2.md`; aligned execution authority around package plans + canonical master.
- **2026-05-14**: Added external ecosystem recommendations and explicit adapter guidance for observability, durable execution, retrieval/memory, interoperability, prompt caching, and orchestration patterns.
- **2026-05-15**: Added canonical local LLM strategy across `@agentsy/models` + `@agentsy/providers`, including support targets (Ollama/vLLM/LM Studio/Lemonade/Docker Model Runner/Jan/Apfel) and first-party `node-llama-cpp` provider plan.
- **2026-05-15**: Added runner model acquisition strategy (Hugging Face/Ollama/open providers) and llm-stats-based recommendation integration plan.
- **2026-05-15**: Added local automodel selection guidance and llama-swap hot-swap routing strategy.
- **2026-05-17**: **CRITICAL COMPLIANCE AUDIT**: Created comprehensive compliance matrix comparing plan requirements to actual code via IMPLEMENTATION-COMPLIANCE-MATRIX.md. Found major discrepancies between TODO completion estimates, package plan ✅ marks, and actual verified implementation. Updated Section 5.2 with verified code review data showing 16/24 packages have <50% compliance. Identified critical production blockers: tools (15%), secrets (8%), guardrails (12%), observability (30%).
