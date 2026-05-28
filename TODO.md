# @agentsy TODO Master List — Updated 2026-05-25

**MASTER PLAN:** See `plan/MASTER-IMPLEMENTATION-PLAN-V2.md` (verified 2026-05-25)

---

## Phase 0 — Foundation ✅ COMPLETE (Verified 2026-05-25)

### Token & Memory Infrastructure ✅

- [x] Output compression (75% savings) — `@agentsy/tokens`
- [x] Memory file compression (46% savings) — `@agentsy/core/context`
- [x] Memory 5-tier foundation — `@agentsy/memory` (214 TS files, production-ready)
- [x] Type stability audit — TASK-067 (17 modules, 7 TSDoc, zero `any`)

### Observability P0-1 ✅ (VERIFIED COMPLETE 2026-05-25)

- [x] TASK-OBS-001: Trace/span/event contracts stabilized
- [x] TASK-OBS-002: Redaction contracts + schema validation
- [x] TASK-OBS-003: Ownership boundaries documented
- [x] TASK-OBS-004: Trace assembly, correlation, exporter abstraction
- [x] TASK-OBS-013: Semantic conventions for all span types
- [x] TASK-OBS-014: Console/OTLP/Langfuse/file sinks
- [x] TASK-OBS-019: Universal logger contracts (tslog-backed)
- [x] TASK-OBS-020: Logger engine + sub-loggers + correlation
- **Evidence:** `packages/observability/src/core/` + `exporters/` + `instrumentation/` (13 TS files)

### Runtime P0-2 ✅ (VERIFIED COMPLETE 2026-05-25)

- [x] TASK-HOOK-001: Hook types enumeration (8 types)
- [x] TASK-HOOK-002: HookRegistry with enable/disable/compile
- [x] TASK-HOOK-003: compileHooks() merging into AgentLoopOptions
- [x] TASK-HOOK-004: Built-in hook library (memory, skills, budget, approval, obs)
- [x] TASK-RUNTIME-001: Runtime loop interfaces + state envelope
- [x] TASK-RUNTIME-002: Approval + budget enforcement boundaries
- [x] TASK-RUNTIME-003: Orchestrator/tools/session/core ownership docs
- [x] TASK-RUNTIME-004: Turn execution loop (deltas, tool calls, approval)
- [x] TASK-RUNTIME-005: Hook registry + policy evaluation
- [x] TASK-RUNTIME-006: Cache-aware context + token governance
- **Evidence:** `packages/runtime/src/hooks/` + `interruption/` + `checkpoint/` (46 TS files)

### Orchestrator P0-2 ✅ (VERIFIED COMPLETE 2026-05-25)

- [x] TASK-HOOK-001..004: Hook registry + compilation (shared with runtime)
- [x] TASK-ORCH-001: Orchestration engine scaffold
- [x] TASK-ORCH-002: Agent loop creation + session wiring
- [x] TASK-ORCH-003: Scheduler + multi-turn coordination
- **Evidence:** `packages/orchestrator/src/hooks/` + `core/` + `agent/` (20 TS files)

---

## Phase R1 — Plan Synchronization (0.5 hour — IMMEDIATE)

### Update Package IMPLEMENTATION-PLAN.md Files ⏳ (2026-05-25)

- [ ] `packages/observability/IMPLEMENTATION-PLAN.md` — Mark P0-1 ✅ (TASK-OBS-001..004,013,014,019,020)
- [ ] `packages/runtime/IMPLEMENTATION-PLAN.md` — Mark P0-2 ✅ (TASK-HOOK-001..004, TASK-RUNTIME-001..009)
- [ ] `packages/orchestrator/IMPLEMENTATION-PLAN.md` — Mark P0-2 ✅ (TASK-HOOK-001..004, TASK-ORCH-001..003)
- [ ] `packages/core/IMPLEMENTATION-PLAN.md` — Mark TASK-009 ✅ (stream-to-events in processor/)
- [ ] `packages/providers/IMPLEMENTATION-PLAN.md` — Mark TASK-008 ✅ (request path in pipeline/)
- [ ] `packages/plugins/IMPLEMENTATION-PLAN.md` — Mark TASK-091 ✅ 2026-05-25
- [ ] `packages/session/IMPLEMENTATION-PLAN.md` — Mark TASK-SESSION-001..003 ✅ scaffold

---

## Phase 1 — Cross-Package Contract Stabilization ⏳

### Types + Testing Infrastructure

- [x] TASK-067: Type audit (types package)
- [ ] TASK-090: External API posture audit across all manifest packages
- [ ] TASK-095: MSW bootstrap for testing (`packages/testing/src/msw/`)
- **Gate:** `pnpm check-types` + `pnpm test` monorepo green

---

## Phase 2 — TUI Vertical Slice (In Progress)

### Renderers: Ink Components

- [ ] TASK-089: Acid ANSI theme (palette, frames, ASCII, motion) — `src/ink/theme/`
- [ ] TASK-072: Chat/dialog components — `src/ink/components/chat/`
  - [ ] `transcript.tsx` — Scrollable message history
  - [ ] `message-bubble.tsx` — User/assistant styling
  - [ ] `streaming-cursor.tsx` — Animated cursor
  - [ ] `token-meter.tsx` — Live token display
  - [ ] `status-footer.tsx` — Connection status
- [ ] TASK-073: Stream-event components — `src/ink/components/stream-events/`
  - [ ] `model-delta.tsx` — Response delta rendering
  - [ ] `thinking-block.tsx` — Expandable thinking
  - [ ] `tool-lifecycle.tsx` — Tool call states
  - [ ] `approval-state.tsx` — Pending/approved/rejected
- [ ] TASK-085: Provider/model chooser — `src/ink/components/model-picker/`

### Providers: Request Path

- [x] TASK-008: Request handler (createRequestHandler) — **VERIFIED ✅ in pipeline/**

### Core: Stream Normalization

- [x] TASK-009: Stream-to-events adapter — **VERIFIED ✅ in processor/**

### Runtime: Turn Loop

- [ ] TASK-010: Simple turn loop (no tools) — `src/loop/simple-turn.ts`

### Renderers: CLI Bridge

- [ ] TASK-011: Ink ↔ stream bridge — `src/adapters/cli-bridge.ts`

### CLI: Integration + E2E

- [ ] TASK-007: Interactive shell loop (prompt, history, mode)
- [ ] TASK-012: E2E test — `chat-streaming.e2e.test.ts`
- [ ] TASK-095: MSW provider handlers ready

**Gate:** `pnpm check-types` + `pnpm test` + e2e streaming test pass

---

## Phase 3 — Model Selection & Provider Routing ⏳

### Models Package

- [ ] TASK-013: Model selector for CLI path
- [ ] TASK-014: Provider capability/profile bridge
- [ ] TASK-016: Local provider discovery (Ollama, vLLM, LM Studio, etc.)
- [ ] TASK-018: Integration tests for routing

### Plugins: Slash Commands

- [ ] TASK-015: Slash-command manifest + registry (`/model`, `/provider`, `/help`, `/status`)

### Renderers + CLI: Model Selection UI

- [ ] TASK-086: Provider/model search-select flows in TUI

---

## Phase 3.5 — LLM Gateway ⏳

### Foundation (Verified Complete ✅ 2026-05-24)

- [x] TASK-LB-001..009: Package scaffold, profiles, registries, config, stubs (9 tasks)

### Remaining Gateway Work

- [ ] TASK-LB-005: Built-in provider profiles (generic-openai, Tier 0-2 clouds)
- [ ] TASK-LB-010: CLI integration (replace direct UniversalClient call)
- [ ] TASK-LB-011: Circuit breaker + health/latency tracking
- [ ] TASK-LB-012: Rate-limit header parsing + quota tracking
- [ ] TASK-LB-013: Six routing strategies (round-robin, weighted, failover, cost-based, adaptive)
- [ ] TASK-LB-014: Retry + failover implementation
- [ ] TASK-LB-015: Active usage probing (DeepInfra, etc.)
- [ ] TASK-LB-016: `agentsy lb status` CLI command
- [ ] TASK-LB-017: Slash commands (`/lb status`, `/lb providers`, `/lb strategy`)
- [ ] TASK-LB-018: Unit tests (config, registry, circuit breaker, header parsing, strategies)
- [ ] TASK-LB-019: E2E tests (429 failover, exhaustion, circuit-open, strategy switch)
- [ ] TASK-LB-020: Public exports + TSDoc + README migration guide
- [ ] TASK-LB-OBS: Metrics collector for Phase 9 observability integration

---

## Phase 4 — Orchestration, Hooks, Secrets, Prompts, Plugins, Skills ⏳

### Orchestrator: Hook Registry + Agent Session

- [ ] TASK-HOOK-001..004: Already verified complete ✅
- [ ] TASK-PLAN-001..003: Plan mode (`--plan` flag)
- [ ] TASK-061..062: CLI/runtime orchestrator integration

### Plugins: Skills Foundation

- [ ] TASK-SIA-001: SkillManifest Zod schema
- [ ] TASK-SIA-002: SkillDiscoverer (5 search roots)
- [ ] TASK-SIA-003: SkillActivator (semantic matching)
- [ ] TASK-SIA-004: createSkillsHook() callback

### Plugins: Instructions Foundation

- [ ] TASK-SIA-005: InstructionFile type
- [ ] TASK-SIA-006: InstructionsDiscoverer (standard paths)
- [ ] TASK-SIA-007: createInstructionsHook() callback

### Plugins: Agent Definitions

- [ ] TASK-SIA-008: AgentDefinition Zod schema
- [ ] TASK-SIA-009: AgentLoader + AgentRegistry
- [ ] TASK-SIA-010: Five built-in agents (default, research, code, plan, superagent)

### Plugins: Official Superagents

- [ ] TASK-091: Already verified ✅ — manifest registry done
- [ ] TASK-092: Superagents plugin (research/plan/agent modes)

### Plugins: Security

- [ ] TASK-PLUGIN-020: Allowlist-based context field filtering
- [ ] TASK-PLUGIN-021: Security model documentation
- [ ] TASK-PLUGIN-022: Audit context-injection points

### Plugins: SKILL.md Discovery

- [ ] TASK-SKILL-015: Plugin manifest `skills` field
- [ ] TASK-SKILL-016: SKILL.md discovery during plugin load
- [ ] TASK-SKILL-017: Surface skills in agent resolution

### Runtime: Memory Hooks

- [ ] TASK-MEM-HOOK-001: `createMemoryPreTurnHook()` (read-only observer)
- [ ] TASK-MEM-HOOK-002: `createMemoryPostTurnHook()` (side effects)
- [ ] TASK-MEM-HOOK-003: `createWikiMemoryHook()` (synthesis)

### Prompts: Layer Types

- [ ] TASK-064: Prompt policy stack (deterministic composition)
- [ ] TASK-PROMPT-001: InstructionsLayer + InstructionsComposer
- [ ] TASK-PROMPT-002: SkillsLayer (activation payloads)

### Tokens: Hard Budget Enforcement

- [ ] TASK-063: Hard token restriction (fail-closed on breach)

### Secrets: Bootstrap

- [ ] TASK-065: Secrets integration into CLI doctor/setup

### Renderers + CLI: Agent Mode Picker

- [ ] TASK-SIA-022: AgentPickerComponent (Ink)
- [ ] TASK-SIA-023: `--agent` flag + `/agent` command
- [ ] TASK-SIA-024/025: `agentsy agents/skills list/show` commands
- [ ] TASK-074: Slash command registry + `/mode`, `/budget`, `/prompt`, `/plugins`, `/doctor`

---

## Phase 5 — Tools, Approvals, Guardian Enforcement ⏳

### Tools Package

- [ ] TASK-019: Baseline tool registry (REPL, file ops, shell, fetch, MCP)

### Runtime: Approval Engine

- [ ] TASK-020: Approval engine (`src/approval/`)
- [ ] TASK-021: Deny-by-default for high-impact commands

### Guardrails Package

- [ ] Policy schema + evaluators
- [ ] PII/secrets/red-team detection
- [ ] Transform/redaction pipeline

### Renderers: Tool & Approval UI

- [ ] TASK-022: Tool-call lifecycle components
- [ ] TASK-075: Document/diff/git/terminal viewers
- [ ] TASK-076: Data adapters for structured events

### UI Package

- [ ] TASK-068: Parity adapters for tool/approval/memory states

### CLI

- [ ] TASK-087: `@` project path insertion flow
- [ ] TASK-023: `tool-approval.e2e.test.ts`
- [ ] TASK-024: Audit event assertions in observability

---

## Phase 6 — Session Durability & Resume ⏳

### Session Package

- [ ] TASK-025: Snapshot save/resume integration
- [ ] TASK-027: Reusable context metadata in snapshots
- [ ] TASK-028: Crash/stale-session detection

### CLI

- [ ] TASK-026: `/resume`, `/sessions`, `/checkpoint`, `/status` commands
- [ ] TASK-077: TUI workspace layout/session state persistence
- [ ] TASK-029: `session-resume.e2e.test.ts`
- [ ] TASK-030: `docs/packages/session.md` + CLI examples

---

## Phase 7 — Memory Integration ⏳

### Memory: AgentFS Migration (4.5 weeks)

- [ ] TASK-MEM-001: Turso AgentFS schema mapping
- [ ] TASK-MEM-002: `TierFsAdapter` implementation
- [ ] TASK-MEM-003: `WikiFsAdapter` implementation
- [ ] TASK-MEM-004: `RagFsAdapter` implementation
- [ ] TASK-MEM-005: `ToolCallAuditor` wrapper
- [ ] TASK-MEM-006: Turso sync integration (`@tursodatabase/sync`)

### Runtime + Core: Memory Hooks

- [ ] TASK-031: Wire memory capture in runtime post-turn pipeline
- [ ] TASK-032: Inject memory context into core context assembly
- [ ] TASK-034: Cache-aware context segment reuse

### CLI: Memory Commands

- [ ] TASK-033: `/memory search`, `/memory list`, `/memory stats`, `/memory lint`
- [ ] TASK-035: Cross-package integration tests
- [ ] TASK-036: Update `docs/examples/stateful-ops-copilot.md`

---

## Phase 8 — Retrieval / RAG Augmentation ⏳

### Retrieval Package

- [ ] TASK-037: Promote from plan-only (package.json, exports)
- [ ] TASK-038: Integrate memory RAG with runtime context assembly
- [ ] TASK-040: Source allowlist + provenance tagging

### CLI: Retrieval Commands

- [ ] TASK-039: `/index`, `/search`, `/sources` + citation display
- [ ] TASK-078: Document/diff open flows via retrieval results
- [ ] TASK-041: Quality benchmark tests
- [ ] TASK-042: `docs/packages/retrieval.md`

---

## Phase 9 — Observability & Cost Governance ⏳

### Observability: Cost Tracking

- [ ] TASK-005: Token/cost/latency metric aggregation
- [ ] TASK-043: Runtime/event tracing standardization
- [ ] TASK-044: Token telemetry integration with CLI status bar
- [ ] TASK-045: `agentsy status --json`, `/trace`, `/events` commands
- [ ] TASK-094: Structured logging via tslog (all packages)
- [ ] TASK-046: Redaction processor defaults
- [ ] TASK-047: Regression tests for trace completeness

### LLM Gateway: Metrics

- [ ] TASK-LB-OBS: MetricsCollector integration with observability

### UI: Observability Hooks

- [ ] TASK-069: UI state transitions + tool lifecycle telemetry

### CLI: Production Diagnostics

- [ ] TASK-048: `docs/packages/observability.md` + incident diagnosis

---

## Phase 10 — User Configuration & Workspace Ergonomics ⏳

### CLI: Configuration System

- [ ] TASK-079: Typed config model (defaults, workspace, env, user)
- [ ] TASK-080: Interactive config editor (`/config`, `/settings`, setup wizard)
- [ ] TASK-081: Secrets via `@agentsy/secrets` (no plaintext)
- [ ] TASK-082: Config doctor + migration logic
- [ ] TASK-083: Config tests (layering, editing, migration, YAML round-trip)
- [ ] TASK-084: Schema documentation + `docs/getting-started.md`
- [ ] TASK-088: Workspace config discovery (precedence diagnostics)

### Plan-only Package Promotion

- [ ] **@agentsy/mcp** (5% → manifest): CLI server management commands
- [ ] **@agentsy/guardrails** (23% → finalized): Full policy engine
- [ ] **@agentsy/connectors** (10% → manifest): Minimal bridge commands
- [ ] **@agentsy/retrieval** (30% → finalized): Alignment with runtime contracts

---

## Phase 11 — Integration Surface Completion ⏳

### Finalization

- [ ] TASK-049: Guardrails finalization
- [ ] TASK-050: MCP finalization
- [ ] TASK-051: Connectors finalization
- [ ] TASK-052: Retrieval finalization
- [ ] TASK-053: Integration tests (CLI → runtime → mcp → tool)
- [ ] TASK-096: Networked integration suites (MSW fixtures)
- [ ] TASK-054: Update `README.md`, `docs/packages.md`, migration docs

---

## Phase 12 — Production Hardening, Cross-Surface Parity & Release ⏳

### Release Readiness

- [ ] TASK-055: Release checklist in `packages/scripts/`
- [ ] TASK-056: CLI smoke-test suite
- [ ] TASK-057: CI gates in `.github/workflows/tests.yml`
- [ ] TASK-058: Performance budget assertions
- [ ] TASK-059: Production runbook + `docs/developer-guide.md`
- [ ] TASK-060: Closure artifact `plan/PHASE-CLI-PRODUCTION-COMPLETION.md`

### Cross-Surface Parity

- [ ] TASK-070: VSCode + UI + CLI parity validation
- [ ] TASK-071: Test-factory + fixture hardening

---

## Superseded Planning Documents (Archived)

These files are now canonical in `MASTER-IMPLEMENTATION-PLAN-V2.md`:

- ~~`plan/MASTER-IMPLEMENTATION-PLAN.md`~~ → `MASTER-IMPLEMENTATION-PLAN-V2.md`
- ~~`plan/DOGFOOD-PLAN.md`~~ → Phases 2-4 in V2
- ~~`plan/REMEDIATION-PLAN.md`~~ → Phase R1 in V2
- ~~`plan/SKILLS-INSTRUCTIONS-AGENT-PLAN.md`~~ → Phase 4 in V2
- ~~`plan/MEMORY-AGENTFS-PLAN.md`~~ → Phase 7 in V2
- ~~`plan/LLM-GATEWAY-PLAN.md`~~ → Phase 3.5 in V2

---

## Master Checklist

**Authority:** See `plan/MASTER-IMPLEMENTATION-PLAN-V2.md`

Last Verified: **2026-05-25**  
Next Review: After Phase 2 completion (TUI vertical slice)
