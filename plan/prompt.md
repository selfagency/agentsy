---
mode: agent
description: 'Comprehensive resumable implementation guide for the @agentsy platform monorepo'
---

# @agentsy Platform — Resumable Implementation Guide

## How to Use This Prompt

1. **Check current progress**: Open `plan/agentsy-platform-v2.md` and scan the `Completed` column in each task table. The first unchecked task is your resume point.
2. **Follow execution order** exactly as listed in §2 of this guide.
3. **Verify before advancing**: Run `turbo run build && turbo run typecheck && turbo run test` after each phase.
4. **Reference planning docs** at the line numbers cited for each phase — do not guess; read the spec.

---

## 1. Project Overview

### What Exists Now

Repository: `/Users/daniel/Developer/agentsy`
Active branch: `feature/provider-vscode-parity-dedupe` (PR #51)

**MONO-0 through P1 are COMPLETE. 18 packages are live in `packages/`.**

| Package                | Status                   |
| ---------------------- | ------------------------ |
| `@agentsy/types`       | ✅ live                  |
| `@agentsy/xml-filter`  | ✅ live                  |
| `@agentsy/context`     | ✅ live                  |
| `@agentsy/formatting`  | ✅ live                  |
| `@agentsy/sse`         | ✅ live                  |
| `@agentsy/thinking`    | ✅ live — 20 tests added |
| `@agentsy/normalizers` | ✅ live                  |
| `@agentsy/structured`  | ✅ live                  |
| `@agentsy/tool-calls`  | ✅ live                  |
| `@agentsy/processor`   | ✅ live                  |
| `@agentsy/recovery`    | ✅ live                  |
| `@agentsy/ag-ui`       | ✅ live                  |
| `@agentsy/agent`       | ✅ live                  |
| `@agentsy/adapters`    | ✅ live                  |
| `@agentsy/renderers`   | ✅ live                  |
| `@agentsy/ui`          | ✅ live                  |
| `@agentsy/vscode`      | ✅ live                  |
| `@agentsy/integration` | ✅ live (private)        |

See `plan/agentsy-platform-v2.md` for full MONO/R/P/X task tables with `Completed` column.

### What Is Being Built

**Core layer (18 packages) is complete.** Next: agent infrastructure and extension packages.

**Extension packages** (NOT YET STARTED — depend on core layer):

```text
@agentsy/runtime       →  core, agent
@agentsy/context-manager → core, processor
@agentsy/cost-tracker  →  core
@agentsy/session       →  core, processor
@agentsy/mcp           →  core, runtime
@agentsy/providers     →  core, normalizers
@agentsy/retrieval     →  core
@agentsy/memory        →  core, retrieval
@agentsy/telemetry     →  core
@agentsy/core (shim) → core, processor, agent, adapters, ag-ui (peerDeps)
```

**Feature packages** (added after P12):

```text
@agentsy/slash-commands  →  core
@agentsy/skills          →  core
@agentsy/caveman         →  core
@agentsy/superpowers     →  core
@agentsy/connectors      →  core, agent, session, runtime
```

Full dependency graph (canonical): `plan/agentsy-platform-v2.md` lines ~820–850.

---

## 2. Execution Order

Phases marked ✅ are complete. Resume at Phase 0 (pending commits) then Phase 2.

```text
✅ MONO-0 → ✅ MONO-1 → ✅ R0 → ✅ P0
  → ✅ R1 + ✅ R2 (parallel)
  → ✅ P1
  → ✅ X1 + ✅ X2 (parallel)
  → ✅ P2 → ✅ P3 (basic) → ...
  [RESUME HERE:]
  ⏳ Phase 0 (flush pending commits on PR #51)
  → P3 → P4 → P5 → P6
  → R3
  → X3 + X4 (parallel)
  → P7 → P8 → X5 → X6 → X7
  → P9 → P10 → P11
  → R4 → X8 → P12
  [then features-v1.md phases:]
  → F5 → F6 → F7 → F8 → F9
```

Source of truth for this order: `plan/agentsy-platform-v2.md` lines ~440–460.

---

## 3. Phase-by-Phase Implementation Guide

### MONO-0 — Turborepo Bootstrap ✅ COMPLETE

**Spec**: `plan/agentsy-platform-v2.md` lines ~50–130 (TASK-M0-001 through M0-011)

1. Create `turbo.json` with pipeline: `build`, `typecheck`, `test`, `lint`. Enable remote cache stubs (`TURBO_TOKEN`/`TURBO_TEAM` env vars).
2. Update `pnpm-workspace.yaml` to glob `packages/*`.
3. Create 16 package directories under `packages/`: `tsconfig`, `core`, `normalizers`, `processor`, `agent`, `adapters`, `ag-ui`, `runtime`, `context-manager`, `cost-tracker`, `session`, `mcp`, `providers`, `retrieval`, `memory`, `telemetry` — plus `shim` (the backward-compat package).
4. Scaffold each with: `package.json`, `tsconfig.json` (extends `@agentsy/tsconfig/library.json`), `tsup.config.ts`, `vitest.config.ts`, empty `src/index.ts`.
5. `@agentsy/tsconfig` goes in `packages/tsconfig/` with `library.json` and `app.json` presets.

**Verify**: `pnpm install --frozen-lockfile` succeeds; all 16 packages visible in `pnpm list` (TEST-MONO-001).

---

### MONO-1 — Source Migration ✅ COMPLETE

**Spec**: `plan/agentsy-platform-v2.md` lines ~200–290 (TASK-M1-001 through M1-012)

Move each source directory (see §1 table above) to the correct `packages/*/src/`. Update all cross-package relative imports to use `@agentsy/*` package names. Update `package.json` dependency arrays. Verify no relative `../` import crosses a package boundary (TEST-MONO-003).

**Verify**: `turbo run build` succeeds with zero errors.

---

### R0 — npm Org Setup ✅ COMPLETE

**Spec**: `plan/agentsy-platform-v2.md` lines ~290–340 (TASK-R0-001 through R0-008)

- Claim `@agentsy` npm org (ASSUMPTION-002).
- Set version `0.3.0-alpha.0` across all packages.
- Write per-package `README.md` stubs.
- Update CI to reference new package paths.

---

### P0 — Architecture Contracts ✅ COMPLETE

**Spec**: `plan/agentsy-platform-v2.md` lines ~340–420 (TASK-P0-001 through P0-011)

Create all type contracts in `packages/core/src/types/`:

| File           | Contents                                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events.ts`    | All discriminated union event types: `ContextWindowWillOverflow`, `ChatCompressed`, `LoopDetected`, `LoopExceeded`, `Citation`, `Retry`, `InvalidStream`, `ApprovalRequired`, `ActionTrace`, `MaiDryRunEnforced` |
| `hooks.ts`     | `Hook`, `HookRegistry`, `HookDispatchResult`                                                                                                                                                                     |
| `memory.ts`    | `MemoryEntry`, `WikiPage`, `MemoryLifecycleOptions`                                                                                                                                                              |
| `skills.ts`    | `SkillManifest`, `SkillContent`                                                                                                                                                                                  |
| `plugins.ts`   | `PluginManifest`, `PluginDescriptor`                                                                                                                                                                             |
| `providers.ts` | `ProviderCapabilities`, `FallbackTrigger`                                                                                                                                                                        |
| `approval.ts`  | `ApprovalMode`, `ApprovalResult`, `ApprovalRequired`                                                                                                                                                             |
| `tools.ts`     | `ToolAnnotations` (`readOnly`, `destructive`, `requiresApproval`)                                                                                                                                                |

Also add to `packages/agent/src/`:

- `stopConditions.ts` — `isStepCount`, `hasToolCall`, `isLoopFinished`, `maxIterations`, `untilFinishReason`, `combineStrategies` (FILE-SRC-002, vercel/ai + tanstack/ai patterns)
- `prepareStep` callback and `mergeCallbacks` utility in `types.ts`

**Key ADR**: ADR-001 — all public API surfaces use factory functions (`create*`), not class constructors directly.

---

### R1 + R2 (parallel) ✅ COMPLETE

**R1 — Shim Deprecation Notice**
`plan/agentsy-platform-v2.md` lines ~420–430 (TASK-R1-001 through R1-003): Add deprecation warning to `@agentsy/core` package; write `docs/migration.md` (FILE-DOC-003).

**R2 — Docs Repositioning**
`plan/agentsy-platform-v2.md` lines ~430–440 (TASK-R2-001 through R2-004): Write `docs/architecture.md` (Mermaid package dependency graph, FILE-DOC-001) and `docs/packages.md` (reference table, FILE-DOC-002).

---

### P1 — Normalizer + Adapter Patches ✅ COMPLETE

**Spec**: `plan/agentsy-platform-v2.md` (TASK-P1-001 through P1-005)

- `openaiResponses` normalizer in `packages/normalizers/src/`
- `autoRepair` strategies for tool call repair
- `cli-markdown` as peer dependency (not bundled)
- Deprecate VS Code adapter (warn, point to new API)
- Fix `stepUsage` reset between loop iterations

---

### X1 + X2 (parallel) ✅ COMPLETE

**X1 — Extensibility Contracts**
`plan/agentsy-platform-v2.md` (TASK-X1-001 through X1-005): `HookRegistry`, `SkillManifest`, `PluginManifest`, tool annotation types (`readOnly`/`destructive`/`requiresApproval`). These go in `@agentsy/core`.

**X2 — Hook Runtime Engine**
`plan/agentsy-platform-v2.md` (TASK-X2-001 through X2-005): `HookDispatcher` in `packages/runtime/src/hooks/` — handler ordering, `deny` short-circuit, audit trail, async timeout. Hooks: `beforeStep`, `afterStep`, `beforeToolCall`, `afterToolCall`. Test: TEST-008.

---

### P2 — Processor Extensions

**Spec**: `plan/agentsy-platform-v2.md` (TASK-P2-001 through P2-009)

Six new events (all go in `packages/core/src/types/events.ts`):

- `ContextWindowWillOverflow`, `ChatCompressed`, `LoopDetected`, `Citation`, `Retry`, `InvalidStream`

In `packages/processor/src/LLMStreamProcessor.ts`:

- Per-message state `Map` (ADR-003)
- Lazy assistant message creation — no eager `UIMessage` allocation (ADR-004)
- `replay()` method for round-trip reconstruction

Test: TEST-002 in `packages/processor/src/LLMStreamProcessor.test.ts`.

---

### P3 — Context Manager

**Spec**: `plan/agentsy-platform-v2.md` (TASK-P3-001 through P3-006)

Package: `packages/context-manager/src/`

- `tokenBudget.ts` — `TokenBudget` calculator
- `compressConversation.ts` — truncation + summarization strategy
- `ContextManager.ts` — detects overflow, triggers auto-compact, skips active-task messages, emits `ChatCompressed`
- Factory: `createContextManager(options)`

Test: TEST-003.

---

### P4 — Cost Tracker

**Spec**: `plan/agentsy-platform-v2.md` (TASK-P4-001 through P4-006)

Package: `packages/cost-tracker/src/`

- `pricingMap.ts` — token USD rates per model
- `CostTracker.ts` — accumulates tokens, calculates USD, enforces budget, resets per step
- `BudgetExceededError`
- Factory: `createCostTracker(options)`

Test: TEST-004.

---

### P5 — Runtime Tool Executor

**Spec**: `plan/agentsy-platform-v2.md` (TASK-P5-001 through P5-006)

Package: `packages/runtime/src/tool-executor/`

- `concurrencyPool.ts` — `ConcurrencyPool`
- `ToolExecutor.ts` — sequential ordering, cap enforcement, abort propagation, `areAllToolsComplete()` guard (tanstack/ai pattern)
- Factory: `createToolExecutor(options)`

Test: TEST-005.

---

### P6 — Approval Engine

**Spec**: `plan/agentsy-platform-v2.md` (TASK-P6-001 through P6-009)

Package: `packages/runtime/src/approvals/` and `packages/runtime/src/policy/`

- `ApprovalEngine.ts` — all 5 `ApprovalMode` values: `auto`, `ask`, `deny`, `plan`, `allow_patterns`. **Returns `ApprovalRequired` result — never throws** (ADR-006, vercel/ai pattern).
- `ApprovalStore.ts` — persists approval decisions
- `RiskClassifier.ts` — `critical` escalation, `low` for read-only, path confinement rejection
- `SandboxMode.ts` — trusted-folder sandboxing (Gemini CLI pattern)
- `repairToolCall` hook wired into `ToolExecutor`

**ADR-009**: `allow_patterns` rules take priority over `deny` rules (specificity wins).

Test: TEST-006, TEST-007.

---

### R3 — API Surface Stabilization

**Spec**: `plan/agentsy-platform-v2.md` (TASK-R3-001 through R3-003)

- Tag public API with `@public` JSDoc; experimental with `@experimental`
- Publish `v0.3.0-alpha.0` to npm `@agentsy` org

---

### X3 + X4 (parallel)

**X3 — Skill System**
`plan/agentsy-platform-v2.md` (TASK-X3-001 through X3-005): `packages/runtime/src/skills/`

- `SkillLoader.ts` — scans `~/.agents/skills/` then `.agents/skills/` (two-directory priority)
- `SkillRegistry.ts` — frontmatter parsing, trigger lookup
- `SkillExecutor.ts` — injects `SKILL.md` content as `<skill_context>` XML into system prompt

Test: TEST-009.

**X4 — Plugin Runtime**
`plan/agentsy-platform-v2.md` (TASK-X4-001 through X4-004): `packages/runtime/src/plugins/`

- `PluginLoader.ts` — SHA-256 HMAC checksum verification; fails to `untrusted` mode if key not configured (emit `PluginKeyNotConfigured` warning — RISK-010)
- `PluginRuntime.ts` — tool registration; explicitly rejects built-in tool override
- Factory pattern

Test: TEST-010.

---

### P7 — Session Store

**Spec**: `plan/agentsy-platform-v2.md` (TASK-P7-001 through P7-007)

Package: `packages/session/src/`

- `SessionStore.ts` — abstract interface
- `FileSystemSessionStore.ts` — atomic write via temp file + rename (Hermes Agent pattern)
- `SessionResumeOptions.ts`
- Lazy session creation — session file not created until first user message
- **ADR-005**: user message persisted synchronously (blocking write); assistant message persisted fire-and-forget
- `resumeSession(id)` — reconstructs history from checkpoint

Test: TEST-011.

---

### P8 — MCP Orchestrator

**Spec**: `plan/agentsy-platform-v2.md` (TASK-P8-001 through P8-007)

Package: `packages/mcp/src/`

- `MCPOrchestrator.ts` — MCP 2025-06-18 spec compliance (verify `@modelcontextprotocol/sdk` version first — RISK-007)
- `MCPCapabilityNegotiator.ts`
- `MCPTrustLevel.ts` — trust-level filtering; untrusted tools blocked by default
- WebSocket idle timeout + reconnect logic

Test: TEST-012.

---

### X5 — Memory System

**Spec**: `plan/agentsy-platform-v2.md` (TASK-X5-001 through X5-010)

Package: `packages/memory/src/`

- `RawEventLog.ts` — append-only JSONL log (truth source)
- `WikiStore.ts` — CRUD with `proper-lockfile` advisory locking per-page (RISK-009, TASK-X5-004)
- `MemoryLifecycle.ts` — `startTask()`, `report()`, `endTask()` (triggers async wiki synthesis via configured LLM — ASSUMPTION-004), `contradict()`
- `WikiLinter.ts` — detects contradictions, orphan pages, stale entries
- `decay(threshold)` — removes entries below relevance threshold

**ADR-007**: Two-stage memory — Consolidator → Dream lifecycle (nanobot pattern).

Test: TEST-014.

---

### X6 — Retrieval / Vector Store

**Spec**: `plan/agentsy-platform-v2.md` lines ~670–700 (TASK-X6-\*)

Package: `packages/retrieval/src/`

- `VectorStore.ts` — abstract interface
- `LibSQLVectorStore.ts` / `TursoVectorStore.ts` — libSQL `vector32` backend. Pin `@libsql/client` minor version (RISK-005). Store embedding dimension metadata per wiki page (RISK-008).
- `ChunkStrategy.ts` — interface with `ImmediateStrategy` and `WordBoundaryStrategy` (tanstack/ai ChunkStrategy pattern)
- `embeddings/EmbeddingProvider.ts` + `embeddings/OpenAIEmbeddingProvider.ts`
- `tools.ts` — `memory_search`, `memory_capture`, `memory_list`, `memory_stats`, `memory_lint` (OpenBrain convention)

Test: TEST-015.

---

### X7 — Providers Package

**Spec**: `plan/agentsy-platform-v2.md` (TASK-X7-\*)

Package: `packages/providers/src/`

- `ProviderRegistry.ts` — capability filtering by model
- `CapabilityMatrix.ts` — maps models to capabilities
- `FallbackChain.ts` — triggers on `ContextWindowWillOverflow` or cost limit exceeded (Budget-Aware Routing pattern, PAT-009)

Test: TEST-013.

---

### P9 — Multi-Provider Integration

Wire `FallbackChain` into the agent loop. Providers switch based on context overflow and budget signals.

---

### P10 — Multi-Agent Orchestration

**Spec**: `plan/agentsy-platform-v2.md` (TASK-P10-001 through P10-005)

In `packages/agent/src/`:

- `SubagentRunner.ts` — spawns child agent loops; `maxSubagentDepth: 3` default (RISK: circular depth)
- `SubagentCoordinator.ts` — sequential and parallel orchestration modes; parent abort propagates to children

Test: TEST-017.

---

### P11 — Telemetry

**Spec**: `plan/agentsy-platform-v2.md` (TASK-P11-001 through P11-006)

Package: `packages/telemetry/src/`

- `structuredLogger.ts` — JSON structured log; redacts 15 secret patterns before emitting
- `spans.ts` — OTel spans via **dynamic import** (no-op if `@opentelemetry/api` not installed — Gemini CLI pattern)
- `healthCheck.ts` — aggregates health from all registered packages

Test: TEST-016.

---

### R4 — Release Prep

Changelog, final API audit, publish all packages.

---

### X8 — Examples and Docs

- `examples/minimal-agent/index.ts` — 50-line minimal agent example (FILE-SRC-020)
- `schema/AGENT.md` — LLM-facing wiki structural conventions (nanobot Dream template, FILE-SRC-019)
- `docs/downstream-app-starter.md` (FILE-DOC-004)

---

### P12 — E2E + Performance

Tests: TEST-018 (E2E full agent loop), TEST-019 (adversarial), TEST-020 (performance benchmarks).

SLO targets (platform-v2.md lines ~790–805):

- Startup latency p50 ≤ 500ms
- Memory retrieval p95 (local libSQL) ≤ 50ms
- Turbo build cache hit rate ≥ 90%

---

## 4. Features-v1 Phases (After P12)

All tasks below are in `plan/agentsy-features-v1.md`.

### F5 — Slash Commands + Skills Manager

**Spec**: `plan/agentsy-features-v1.md` lines 1–130 (TASK-F5-001 through F5-015)

- `@agentsy/slash-commands`: `SlashCommandRegistry` (TASK-F5-001 through F5-007) — discovers SKILL.md files with `slash_command: true` frontmatter; substitutes `$1`/`$2` positional args; `execute(name, args)` returns string result
- `@agentsy/skills`: `SkillsManager` (TASK-F5-008 through F5-015) — wraps `npx skills <subcommand>` as subprocess (ADR-020); validates `ref` against `/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/` before subprocess call (SEC-011)

Stock SKILL.md commands: `/skills-find.md`, `/skills-add.md`, `/skills-list.md`

---

### F6 — Caveman + Superpowers

**Spec**: `plan/agentsy-features-v1.md` lines ~130–230 (TASK-F6-001 through F6-019)

**`@agentsy/caveman`** (TASK-F6-001 through F6-012):

- Bundle JuliusBrussee/caveman v1.7.0 SKILL.md files (verify MIT license — ASSUMPTION-009)
- Bundle cavecrew subagent skills: `investigator.md`, `builder.md`, `reviewer.md`
- All bundled skills must include `source_url`, `version`, `license` frontmatter (GUD-008)
- `caveman-shrink` MCP proxy binary: `bin/caveman-shrink.js` — intercepts `tools/list`, compresses `description` fields only; **asserts `inputSchema` is never altered** (SEC-010, startup assertion)
- Factory: `createCavemanManager()`; ADR-019: compression is prompt-injection, not output filter

**`@agentsy/superpowers`** (TASK-F6-013 through F6-019):

- Bundle obra/superpowers v5.0.7 SKILL.md files (verify MIT license — ASSUMPTION-008)
- `SuperpowersActivator` — context-based activation (ADR-022): `hasTestFiles → tdd`, `hasDiff → code-review`, `isOpenEndedPlan → brainstorming`

---

### F7 — MCP Auto-Install

**Spec**: `plan/agentsy-features-v1.md` lines ~230–280 (TASK-F7-001 through F7-008)

- Add `@mcpmarket/mcp-auto-install@^0.2.1` as `devDependency` in `packages/mcp/` (spawned as child process, not imported — ADR-021)
- `MCPAutoInstallServer` spawns `npx @mcpmarket/mcp-auto-install` as stdio MCP server, registers as `__mai__`
- **ADR-021**: `mai_install` and `mai_remove` default `dryRun: true`; actual install requires explicit `{ confirm: true }` through `/mcp-install` slash command confirmation gate (SEC-012)
- `mai_search`, `mai_details`, `mai_readme` are pass-through (read-only, no wrapping)

---

### F8 — Chat Platform Connectors

**Spec**: `plan/agentsy-features-v1.md` lines ~280–350 (TASK-F8-001 through F8-013)

Package: `packages/connectors/src/`

- `ChannelAdapter<TConfig>` interface: `connect`, `disconnect`, `send`, `onMessage`
- `MessageRouter` — routes by `channelId+userId`; inbound text passes through `stripXmlContextTags` (ADR-025, SEC-013)
- `AgentSessionManager` — creates/resumes `createAgentLoop` per `channelId+userId`; `maxIdleTime` eviction (default 1h); evicted sessions persisted to `@agentsy/session`
- Built-in chat commands: `/status`, `/new`, `/reset`, `/compact`, `/think`, `/verbose`, `/usage` (handled before agent loop — ADR-023)
- First-party adapters (platform SDKs as peer deps):
  - `TelegramAdapter` — peer dep `grammy@^1`; token from `TELEGRAM_BOT_TOKEN` env (SEC-014)
  - `DiscordAdapter` — peer dep `discord.js@^14`; token from `DISCORD_BOT_TOKEN` env
  - `SlackAdapter` — peer dep `@slack/bolt@^4`; tokens from `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET` env vars

ADR-024: `@agentsy/connectors` is a pure library — no embedded CLI, HTTP server, or process manager.

---

### F9 — Cross-Package Slash Command Integration

**Spec**: `plan/agentsy-features-v1.md` lines ~350–372 (TASK-F9-001 through F9-006)

- Add `slashCommands?: SlashCommandRegistry` to `AgentLoopOptions`
- Agent loop intercepts `/`-prefixed messages before model call; unrecognized pass through (RISK-015)
- Wire all 12 stock commands (from F5/F6/F7) into `@agentsy/slash-commands`
- E2E test: `/status`, `/new`, `/caveman`, `/skills-find <query>` — each returns result without model call

---

## 5. TypeScript Invariants (Apply Everywhere)

These are non-negotiable. Source: `tsconfig.json`, `plan/agentsy-prd-notes.md` ADR-001.

```text
strict: true
noUncheckedIndexedAccess: true
exactOptionalPropertyTypes: true
verbatimModuleSyntax: true
isolatedModules: true

- Zero `any`. Use `Record<string, unknown>` for untyped JSON shapes.
- All relative imports use `.js` extension (e.g., `from './parsing.js'`).
- ESM-first; `"type": "module"` in every package.json.
- Cross-package deps use `workspace:*` version specifier.
- ES2022 target.
- Dual ESM/CJS output via tsup.
```

---

## 6. Architecture Decision Records (Critical ADRs)

| ADR     | Decision                                                                            | Source         |
| ------- | ----------------------------------------------------------------------------------- | -------------- |
| ADR-001 | Factory functions (`create*`) over class constructors in public API                 | prd-notes.md   |
| ADR-002 | `StopCondition` as composable async predicates (vercel/ai pattern)                  | prd-notes.md   |
| ADR-003 | Per-message state `Map` in `LLMStreamProcessor`                                     | prd-notes.md   |
| ADR-004 | Lazy assistant message — no eager `UIMessage` allocation                            | prd-notes.md   |
| ADR-005 | User message write: blocking. Assistant message write: fire-and-forget              | prd-notes.md   |
| ADR-006 | `ApprovalEngine` returns `ApprovalRequired` result — **never throws**               | prd-notes.md   |
| ADR-007 | Two-stage memory: Consolidator → Dream (nanobot lifecycle)                          | prd-notes.md   |
| ADR-008 | Warning-first loop guardrails: `LoopDetected` → grace period → `LoopExceeded`       | prd-notes.md   |
| ADR-009 | `allow_patterns` take priority over `deny` (specificity wins)                       | prd-notes.md   |
| ADR-019 | Caveman = bundled SKILL.md prompt injection, not output filter                      | features-v1.md |
| ADR-020 | Skills CLI as subprocess (not library import) — input validated pre-spawn           | features-v1.md |
| ADR-021 | MCP auto-install defaults to `dryRun: true`; `confirm: true` required for mutations | features-v1.md |
| ADR-022 | Superpowers skills context-activated, not always-on                                 | features-v1.md |
| ADR-023 | Slash commands intercept before model — deterministic, no LLM round-trip            | features-v1.md |
| ADR-024 | `@agentsy/connectors` is a pure library — no embedded process                       | features-v1.md |
| ADR-025 | Connector inbound messages sanitized via existing XML pipeline                      | features-v1.md |

Full ADR text: `plan/agentsy-prd-notes.md` (ADR-001 through ADR-018 in the main file; ADR-019 through ADR-025 in `plan/agentsy-features-v1.md` §8).

---

## 7. Security Requirements

Enforce throughout all phases. Non-negotiable.

| ID      | Requirement                                                                             | Source                   |
| ------- | --------------------------------------------------------------------------------------- | ------------------------ |
| SEC-010 | `caveman-shrink` MUST NOT alter any `inputSchema` field — startup assertion             | features-v1.md           |
| SEC-011 | Skills `ref` validated against `/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/` before subprocess | features-v1.md           |
| SEC-012 | Any tool mutating MCP client config requires explicit `{ confirm: true }`               | features-v1.md           |
| SEC-013 | All inbound connector messages pass through `stripXmlContextTags`                       | features-v1.md           |
| SEC-014 | Connector bot tokens from env vars only — never hardcoded                               | features-v1.md           |
| SEC-016 | "Lethal Trifecta" prevention: destructive tool + no approval + no session = blocked     | prd.md                   |
| General | No hardcoded secrets, parameterized queries, path sanitization, no `any` (OWASP Top 10) | security.instructions.md |

Full security requirements: `plan/agentsy-prd.md` §6 (SEC-001 through SEC-016) and `plan/agentsy-features-v1.md` §1 (SEC-010 through SEC-026).

---

## 8. Toolchain Reference

```bash
# Build all packages
pnpm build        # turbo run build

# Type-check all packages
pnpm check-types  # turbo run check-types

# Run all tests
pnpm test         # turbo run test

# Lint + format
pnpm lint
pnpm lint:fix
pnpm format

# Pre-commit
pnpm precommit

# Per-package (from package dir)
cd packages/core && pnpm build
cd packages/core && pnpm test
```

CI runs Node.js 22. All packages target Node ≥ 22.

---

## 9. Verification Checklist Per Phase

After each phase, confirm:

- [ ] `turbo run build` — zero errors, zero warnings
- [ ] `turbo run typecheck` — zero errors
- [ ] `turbo run test` — all tests pass
- [ ] No `any` types introduced (`grep -r ': any' packages/*/src/`)
- [ ] No relative `../` imports crossing package boundary
- [ ] New public API functions follow `create*` factory pattern (ADR-001)
- [ ] New event types are discriminated unions (not plain objects)
- [ ] Secrets read from env vars, not hardcoded

After MONO-1 specifically:

- [ ] TEST-MONO-001: `pnpm install --frozen-lockfile` clean checkout
- [ ] TEST-MONO-002: second `turbo run build` achieves >90% cache hit
- [ ] TEST-MONO-003: no cross-package relative imports

---

## 10. Key Reference Files

| File                               | Purpose                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `plan/agentsy-platform-v2.md`      | **Master implementation plan** — all MONO/R/P/X task tables with `Completed` column. Resume here. |
| `plan/agentsy-features-v1.md`      | Feature extensions F5–F9 task tables                                                              |
| `plan/agentsy-prd.md`              | Product requirements, goals, SLOs                                                                 |
| `plan/agentsy-prd-notes.md`        | ADR-001 through ADR-018 + research corpus (SRC-1 through SRC-29)                                  |
| `plan/agentsy-tech.md`             | TypeScript API surface definitions per package                                                    |
| `plan/agentsy-testing-plan.md`     | Full test strategy                                                                                |
| `plan/agentsy-deep-dive-v1.md`     | Research synthesis from 28 reference codebases                                                    |
| `plan/agentsy-deep-dive-v2.md`     | Extended research notes                                                                           |
| `plan/agentsy-connectors-v1.md`    | Connectors deep-dive                                                                              |
| `plan/agentsy-scheduler-v1.md`     | Scheduler design notes                                                                            |
| `plan/agentsy-standalone-v1.md`    | Standalone binary design                                                                          |
| `plan/owasp-security-testing-1.md` | OWASP security test plan                                                                          |

**Reference codebases** (from prd-notes.md SRC-\* and platform-v2.md §8):

- [tanbiralam/claude-code](https://github.com/tanbiralam/claude-code) — `QueryEngine`, cost-tracker, skills/plugins
- [vercel/ai](https://github.com/vercel/ai) — `StopCondition`, `prepareStep`, `toolApproval` as result not throw
- [tanstack/ai](https://github.com/tanstack/ai) — `StreamProcessor` per-message Map, `ChunkStrategy`, `areAllToolsComplete`, `replay()`
- [HKUDS/nanobot](https://github.com/HKUDS/nanobot) — Dream lifecycle, memory as context injection
- [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) — OTel lazy-load, trusted-folder sandbox
- [openai/codex](https://github.com/openai/codex) — `allow/ask/deny` approval engine
- [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) — atomic write + early user-message persistence

---

## 11. Open Questions / Blockers

1. **ASSUMPTION-001**: ✅ RESOLVED — Ink renderer merged; all 18 packages live.
2. **ASSUMPTION-002**: Is `@agentsy` npm org claimed? Required before publishing extension packages (Phase 2+).
3. **RISK-007**: Verify `@modelcontextprotocol/sdk` current version matches MCP 2025-06-18 spec before P8.
4. **ASSUMPTION-008/009**: Verify obra/superpowers v5.0.7 and JuliusBrussee/caveman v1.7.0 are MIT-licensed before F6.
5. **TURBO_TOKEN/TURBO_TEAM**: Configure in CI secrets for remote cache (RISK-002 — local cache alone still accelerates, not a blocker).
6. **Phase 0 (pending)**: Flush uncommitted changes on PR #51 — watch-mode fix, Codacy cleanup, lockfile, types batch (user owns `@agentsy/types` edits).
