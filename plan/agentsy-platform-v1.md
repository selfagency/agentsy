---
goal: 'agentsy library platform — complete implementation plan (rebrand + infra + extensibility + blended memory)'
version: '1.0'
date_created: '2026-05-02'
last_updated: '2026-05-02'
owner: 'selfagency'
status: 'Planned'
tags: ['architecture', 'migration', 'feature', 'memory', 'mcp', 'tui']
---

# agentsy library platform — Complete Implementation Plan

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan covers the full transformation of `@agentsy/core` into `@selfagency/agentsy`: a composable, extensible TypeScript agent-infrastructure library. It integrates deep architectural insights from the Claude Code source leak, OpenCode (anomalyco fork), Hermes Agent (NousResearch), nanobot (HKUDS), Gemini CLI (Google), and OpenAI Codex. The plan is organized into three tracks executed in an optimized interleaved sequence: **Track R** (rebrand), **Track P** (core infrastructure), and **Track X** (extensibility + blended memory).

**Library identity:** `@selfagency/agentsy` — a Node.js 22 ESM-first library consumed by downstream application projects. It is not an end-user CLI or app; it provides the building blocks for building agents.

---

## 1. Requirements & Constraints

### Functional Requirements

- **REQ-001**: Package must be publishable as `@selfagency/agentsy` on npm with full dual ESM/CJS output via tsup.
- **REQ-002**: Old package `@agentsy/core` must remain installable as a compatibility shim re-exporting all public APIs unchanged.
- **REQ-003**: All existing subpath exports (`./thinking`, `./xml-filter`, `./tool-calls`, `./context`, `./structured`, `./formatting`, `./processor`, `./markdown`, `./adapters`, `./normalizers`, `./ag-ui`, `./agent`, `./pipeline`, `./renderers/ink`, `./sse`, `./recovery`, `./ui`) must remain valid on the new package name.
- **REQ-004**: Agent loop (`createAgentLoop`) must support hook injection points: `beforeStep`, `afterStep`, `beforeToolCall`, `afterToolCall`, `onError`, `onAbort`.
- **REQ-005**: Agent loop must call `memoryEngine.startTask()` at loop start and `memoryEngine.endTask()` at loop end when a memory engine is provided.
- **REQ-006**: `LLMStreamProcessor` must emit new events: `ContextWindowWillOverflow`, `ChatCompressed`, `LoopDetected`, `Citation`, `Retry`, `InvalidStream`.
- **REQ-007**: Context window manager must monitor token budget, trigger `compressConversation()` when threshold is reached, and emit `ContextWindowWillOverflow` before compression.
- **REQ-008**: Cost tracker must maintain a provider pricing map, enforce optional budget limits, and emit `CostThresholdExceeded` events.
- **REQ-009**: Parallel tool executor must support bounded concurrency, per-call `AbortSignal`, and deterministic result ordering.
- **REQ-010**: Tool approval engine must implement `allow` / `ask` / `deny` / `auto` modes identical to Claude Code's permission model.
- **REQ-011**: Session store must persist `StreamSnapshot` checkpoints durably (default: local filesystem JSON), enabling deterministic resume on crash.
- **REQ-012**: MCP orchestration must conform to MCP 2025-06-18 spec: server lifecycle (start/stop/restart), capability negotiation, trust-level filtering.
- **REQ-013**: Provider strategy must support a capability matrix (context window, vision, tool calling, streaming) and configurable fallback chains.
- **REQ-014**: Multi-agent orchestration must support parent→child subagent spawning with a configurable max depth cap to prevent runaway recursion.
- **REQ-015**: Skill system must be compatible with the Agent Skills open standard (`.agents/skills/**/SKILL.md`, progressive disclosure).
- **REQ-016**: Memory engine must implement the 3-layer blended architecture: Layer 0 raw event log, Layer 1 Karpathy-style wiki, Layer 2 vector RAG over the wiki.
- **REQ-017**: Vector RAG must index **wiki pages** (synthesized artifacts), NOT raw session events — this is the core Karpathy architectural invariant.
- **REQ-018**: `memory_search()`, `memory_capture()`, `memory_list()`, `memory_stats()`, `memory_lint()` must be exposed as OpenBrain-compatible tool surface.
- **REQ-019**: Retrieved memory context must be injected via existing `splitLeadingXmlContext` / `dedupeXmlContext` / `stripXmlContextTags` pipeline using `<memory_context>` tags.
- **REQ-020**: `openaiResponses` provider must be routable through the pipeline's `NormalizerProvider` union.

### Security Requirements

- **SEC-001**: All tool calls with destructive potential (file overwrite, shell exec, network egress) must pass through the approval engine before execution.
- **SEC-002**: Path confinement: file-system tools must be restricted to a configurable workspace root; path traversal sequences (`../`) must be rejected.
- **SEC-003**: Secret redaction: any string matching a known secret pattern (API key regex, bearer token regex) must be scrubbed from log output and telemetry.
- **SEC-004**: Plugin manifests must carry a signed checksum; the runtime must verify the signature before loading.
- **SEC-005**: Memory scope isolation: project-scoped wiki pages must not be accessible to session-scoped or global-scoped retrieval queries without explicit cross-scope permission.
- **SEC-006**: Retrieved wiki pages must be treated as untrusted LLM-generated content; any `<script>`, HTML injection, or executable pattern within a retrieved page must be stripped before injection into system prompt context.
- **SEC-007**: MCP server connections must be filtered by a trust level (`trusted` / `untrusted` / `readonly`); untrusted servers may not invoke destructive built-in tools.
- **SEC-008**: SSRF prevention: HTTP fetch tools must validate destination URLs against a configurable egress allowlist.
- **SEC-009**: Prompt injection detection: retrieved memory content carrying instruction-override patterns ("ignore previous instructions", "you are now", etc.) must trigger a `MemoryInjectionSuspected` warning event.

### Constraints

- **CON-001**: Runtime target is Node.js ≥ 22 (CI confirmed). Bun compatibility is acceptable but not required.
- **CON-002**: Module system is ESM-first (`"type": "module"`). All relative imports in `.ts` source use `.js` extensions.
- **CON-003**: TypeScript strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`. Zero `any` types.
- **CON-004**: Toolchain: pnpm, tsup (dual output), vitest, oxlint, oxfmt, Taskfile commands.
- **CON-005**: No runtime dependencies may be added without explicit justification. Peer dependencies preferred over hard dependencies for optional integrations.
- **CON-006**: The library must not embed a CLI entrypoint or TUI; those live in downstream consumer projects.
- **CON-007**: libSQL/Turso is the default vector store backend for Layer 2; the backend must be swappable via configuration interface.

### Guidelines

- **GUD-001**: Factory functions (`create*`) over direct class instantiation for all stateful modules.
- **GUD-002**: Silent failure by default in stream-processing hot paths; recoverable errors emit warning events rather than throwing.
- **GUD-003**: Options objects with optional properties and `??` defaults; export `DEFAULT_*` constants for all tunables.
- **GUD-004**: Each new module gets its own `src/<module>/index.ts` barrel export and a corresponding subpath export in `package.json` and `tsup.config.ts`.
- **GUD-005**: Tests colocated as `*.test.ts`; adversarial/malformed-input test cases required for all parser and memory modules.

### Patterns to Follow

- **PAT-001**: Claude Code `QueryEngine` pattern: single streaming engine with a typed tool-call loop, retry logic, and token counting — agentsy's `LLMStreamProcessor` + `createAgentLoop` compose this.
- **PAT-002**: OpenCode client/server architecture: decouple the agent runtime from any transport or UI surface; `@selfagency/agentsy` is the server-side runtime.
- **PAT-003**: Hermes Agent closed learning loop: `startTask → report → endTask → synthesize` lifecycle drives wiki maintenance (memelord pattern).
- **PAT-004**: nanobot lightweight core: memory and skills are **context injections**, not an orchestration layer; the agent loop stays readable.
- **PAT-005**: Gemini CLI conversation checkpointing: `StreamSnapshot` + session store enables deterministic resume identical to Gemini's checkpointing model.
- **PAT-006**: Codex `codex-rs` Rust safety model insight: approval engine enforces a clear `allow/ask/deny` policy per tool; agentsy adopts the same three-state model in TypeScript.
- **PAT-007**: Karpathy wiki: the compiled wiki is a **maintained artifact**, not a retrieval layer. LLM synthesizes raw session data into structured wiki pages. Pages are then vector-indexed. This prevents re-discovery from scratch on every query.

---

## 2. Implementation Steps

> Execution order: R0 → P0 → R1+R2 (parallel) → P1 → X1+X2 (parallel) → P2 → P3 → P4 → P5 → P6 → R3 → X3+X4 (parallel) → P7 → P8 → X5 → X6 → X7 → P9 → P10 → P11 → R4 → X8 → P12

---

### Phase R0 — Package Identity & Naming (blocking)

- **GOAL-R0**: Establish the new package identity before any other work. All subsequent phases depend on this being done first.

| Task        | Description                                                                                                                                                                                               | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-R0-001 | Rename `package.json` `name` field from `@agentsy/core` to `@selfagency/agentsy`. Update `description`, `homepage`, `repository` fields.                                                  |           |      |
| TASK-R0-002 | Update `README.md` title, badges, and install instructions to reference `@selfagency/agentsy`.                                                                                                            |           |      |
| TASK-R0-003 | Create `packages/llm-stream-parser/` compatibility shim package: `package.json` with `peerDependencies: { "@selfagency/agentsy": "*" }` and an `index.ts` that re-exports `* from '@selfagency/agentsy'`. |           |      |
| TASK-R0-004 | Update `pnpm-workspace.yaml` to include the compatibility shim package.                                                                                                                                   |           |      |
| TASK-R0-005 | Verify all existing subpath exports resolve correctly under the new package name by running `task check-types`.                                                                                           |           |      |

---

### Phase R1 — Public Deprecation Notice

- **GOAL-R1**: Communicate the rename to consumers without breaking existing installs.

| Task        | Description                                                                                                                       | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-R1-001 | Add `deprecated` field to the shim `package.json`: `"deprecated": "Renamed to @selfagency/agentsy — please update your imports."` |           |      |
| TASK-R1-002 | Add deprecation notice to top of `README.md` of the shim package.                                                                 |           |      |
| TASK-R1-003 | Publish shim package to npm as `@agentsy/core@0.3.0` after `@selfagency/agentsy@0.3.0` is published.              |           |      |

---

### Phase R2 — Library Repositioning

- **GOAL-R2**: Clearly communicate the library-first mission in all public-facing documentation and API surface.

| Task        | Description                                                                                                                            | Completed | Date |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-R2-001 | Rewrite `docs/index.md` to reflect `agentsy` positioning: "composable agent infrastructure library — bring your own app."              |           |      |
| TASK-R2-002 | Update `docs/getting-started.md` to lead with library installation and `createAgentLoop` usage; remove any CLI references.             |           |      |
| TASK-R2-003 | Add `docs/architecture.md` describing the module map, subpath exports, and the layer separation (stream → processor → agent → memory). |           |      |

---

### Phase P0 — Architecture Contract + Security Baseline (blocking)

- **GOAL-P0**: Freeze the public API contracts, event model, and security invariants before any new module is built. Everything else builds on this.

| Task        | Description                                                                                                                                                                                                                             | Completed | Date   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ |
| TASK-P0-001 | Create `src/types/events.ts`: extend existing `EventType` enum with `CONTEXT_WINDOW_WILL_OVERFLOW`, `CHAT_COMPRESSED`, `LOOP_DETECTED`, `CITATION`, `RETRY`, `INVALID_STREAM`, `COST_THRESHOLD_EXCEEDED`, `MEMORY_INJECTION_SUSPECTED`. |           |        |
| TASK-P0-002 | Create `src/types/hooks.ts`: define `HookEvent`, `HookDecision` (`allow`/`ask`/`deny`/`defer`), `HookContext`, `HookResult` interfaces.                                                                                                 |           |        |
| TASK-P0-003 | Create `src/types/memory.ts`: define `MemoryStore`, `MemoryRetriever`, `MemoryFeedback`, `MemoryMaintenance` interfaces (Layer 0/1/2 contracts).                                                                                        |           |        |
| TASK-P0-004 | Create `src/types/skills.ts`: define `SkillManifest` (name, description, file, triggers, schema) compatible with Agent Skills open standard.                                                                                            |           |        |
| TASK-P0-005 | Create `src/types/plugins.ts`: define `PluginManifest` (id, version, checksum, tools, hooks, entrypoint) compatible with Claude plugin subset.                                                                                          |           |        |
| TASK-P0-006 | Create `src/types/providers.ts`: define `ProviderCapability` matrix (`contextWindow`, `supportsVision`, `supportsTools`, `supportsStreaming`, `costPerInputToken`, `costPerOutputToken`) and `ProviderStrategy` interface.              |           |        |
| TASK-P0-007 | Create `src/types/approval.ts`: define `ApprovalMode` union (`'allow'                                                                                                                                                                   | 'ask'     | 'deny' | 'auto'`),`ApprovalRequest`,`ApprovalResponse`,`ApprovalEngine` interface. |     |     |
| TASK-P0-008 | Export all new types through `src/types/index.ts` and add `./types` subpath export to `package.json` and `tsup.config.ts`.                                                                                                              |           |        |
| TASK-P0-009 | Write unit tests for all new type narrowing helpers and discriminated unions in `src/types/types.test.ts`.                                                                                                                              |           |        |

---

### Phase P1 — Quick Wins (parallel with R1/R2)

- **GOAL-P1**: Ship fast unblocking fixes and additions that don't require new modules.

| Task        | Description                                                                                                                                      | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-P1-001 | Add `openaiResponses` to `NormalizerProvider` union in `src/pipeline/createPipeline.ts` and wire it to `src/normalizers/openaiResponses.ts`.     |           |      |
| TASK-P1-002 | Add `strategy: 'fast' \| 'safe' \| 'aggressive'` option to `autoRepair` in `src/structured/autoRepair.ts` with strategy-driven backoff behavior. |           |      |
| TASK-P1-003 | Move `cli-markdown` from `dependencies` to `peerDependencies` with `optionalPeerDependencies` fallback; guard import with dynamic `import()`.    |           |      |
| TASK-P1-004 | Mark `src/adapters/vscode.ts` as deprecated via `@deprecated` JSDoc; add migration note pointing to MCP adapter pattern.                         |           |      |
| TASK-P1-005 | Add `stepUsage` accumulation fix: ensure `stepUsage` is reset to zero at the start of each step in `createAgentLoop.ts`.                         |           |      |

---

### Phase P2 — Event Vocabulary Completion

- **GOAL-P2**: Emit the missing lifecycle events from `LLMStreamProcessor` so consumers can react to all meaningful state transitions.

| Task        | Description                                                                                                                                                                       | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P2-001 | Add `ContextWindowWillOverflow` event emission to `LLMStreamProcessor.ts` when token count exceeds a configurable `contextWindowWarningThreshold` (default: 90% of model max).    |           |      |
| TASK-P2-002 | Add `ChatCompressed` event emission after `compressConversation()` completes (wired from context-manager, Phase P3).                                                              |           |      |
| TASK-P2-003 | Add `LoopDetected` event emission in `createAgentLoop.ts` when `parametersEqual()` doom-loop detection fires. Currently only logs; must emit typed event.                         |           |      |
| TASK-P2-004 | Add `Citation` event type: emitted when a tool result or memory retrieval result is injected as grounded context. Payload: `{ source: string, content: string, score?: number }`. |           |      |
| TASK-P2-005 | Add `Retry` event: emitted before each provider retry attempt. Payload: `{ attempt: number, maxAttempts: number, delayMs: number, reason: string }`.                              |           |      |
| TASK-P2-006 | Add `InvalidStream` event: emitted when a stream chunk fails schema validation. Payload: `{ chunk: unknown, error: string }`. Currently throws silently.                          |           |      |
| TASK-P2-007 | Write tests for all 6 new events in `src/processor/LLMStreamProcessor.test.ts`, including edge cases (e.g., overflow at exact threshold boundary).                                |           |      |

---

### Phase P3 — Context Window Manager

- **GOAL-P3**: Proactive token budget management that auto-compresses conversations before hitting provider limits, eliminating silent truncation failures.

| Task        | Description                                                                                                                                                                                                                                      | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-P3-001 | Create `src/context-manager/` directory with `index.ts`, `ContextManager.ts`, `compressConversation.ts`, `tokenBudget.ts`.                                                                                                                       |           |      |
| TASK-P3-002 | Implement `TokenBudget`: tracks running input token count against model `contextWindow` from `ProviderCapability` matrix; exposes `remaining()`, `usedFraction()`, `willOverflow(tokens: number)`.                                               |           |      |
| TASK-P3-003 | Implement `compressConversation(messages, options)`: summarize oldest message window using a configured summarization prompt; return compressed messages array + `compressionStats`.                                                             |           |      |
| TASK-P3-004 | Implement `ContextManager` class: wraps `TokenBudget`; auto-triggers `compressConversation()` when `usedFraction()` exceeds `autoCompactThreshold` (default 0.85); emits `ContextWindowWillOverflow` before compression, `ChatCompressed` after. |           |      |
| TASK-P3-005 | Add `contextManager?: ContextManager` optional param to `AgentLoopOptions` in `src/agent/types.ts`. Wire into `createAgentLoop.ts`: call `contextManager.check(messages)` before each step.                                                      |           |      |
| TASK-P3-006 | Add `./context-manager` subpath export to `package.json` and `tsup.config.ts`.                                                                                                                                                                   |           |      |
| TASK-P3-007 | Write tests: overflow detection, compression trigger at threshold, post-compression message count reduction, `ChatCompressed` event emission.                                                                                                    |           |      |

---

### Phase P4 — Cost Tracker

- **GOAL-P4**: Token cost accounting with budget enforcement — inspired by Claude Code's `cost-tracker.ts` (~46K lines insight: cost is tracked at every tool loop iteration).

| Task        | Description                                                                                                                                                                                                                                                                                     | Completed | Date |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P4-001 | Create `src/cost-tracker/` with `index.ts`, `CostTracker.ts`, `pricingMap.ts`.                                                                                                                                                                                                                  |           |      |
| TASK-P4-002 | Implement `pricingMap.ts`: map of `NormalizerProvider` → `{ inputCostPer1kTokens, outputCostPer1kTokens }` with values for all 8 current providers + `openaiResponses`. Keep values in a `PRICING` `Record<string, { input: number, output: number }>` constant; values overridable via config. |           |      |
| TASK-P4-003 | Implement `CostTracker`: accumulates `{ inputTokens, outputTokens, totalCostUsd }` per step and session; exposes `record(usage)`, `sessionTotal()`, `stepTotal()`, `reset()`.                                                                                                                   |           |      |
| TASK-P4-004 | Add optional `budgetUsd?: number` to `CostTracker` constructor; emit `CostThresholdExceeded` event and throw `BudgetExceededError` when `sessionTotal().totalCostUsd` exceeds budget.                                                                                                           |           |      |
| TASK-P4-005 | Add `costTracker?: CostTracker` optional param to `AgentLoopOptions`; wire into `createAgentLoop.ts` to call `costTracker.record(usage)` after each step.                                                                                                                                       |           |      |
| TASK-P4-006 | Add `./cost-tracker` subpath export. Write tests for accumulation, budget enforcement, and per-step reset.                                                                                                                                                                                      |           |      |

---

### Phase P5 — Parallel Tool Executor

- **GOAL-P5**: Safe concurrent tool execution with bounded parallelism — drawn from Claude Code's `AgentTool` + `TeamCreateTool` parallel execution patterns and Codex's `codex-rs` approval-gated execution model.

| Task        | Description                                                                                                                                                                                                                                  | Completed | Date |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P5-001 | Create `src/tool-executor/` with `index.ts`, `ToolExecutor.ts`, `concurrencyPool.ts`.                                                                                                                                                        |           |      |
| TASK-P5-002 | Implement `ConcurrencyPool(maxConcurrent: number)`: token-bucket style pool; `acquire()` / `release()` with `AbortSignal` support; rejects immediately on abort.                                                                             |           |      |
| TASK-P5-003 | Implement `ToolExecutor`: accepts an array of `ToolCall` + an `ApprovalEngine` + a `ConcurrencyPool`; fans out execution; collects results in deterministic submission order (not completion order); re-throws first error after all settle. |           |      |
| TASK-P5-004 | Add `toolExecutor?: ToolExecutor` optional param to `AgentLoopOptions`; when present, replace sequential tool-call loop in `createAgentLoop.ts` with `toolExecutor.executeAll(toolCalls)`.                                                   |           |      |
| TASK-P5-005 | Write tests: sequential ordering guarantee, concurrency cap enforcement, abort cancels pending calls, first-error semantics.                                                                                                                 |           |      |

---

### Phase P6 — Tool Execution Runtime + Safety Controls

- **GOAL-P6**: The approval engine, sandbox modes, and risk classifier — the safety backbone. Directly informed by Claude Code's permission system (`src/hooks/toolPermission/`), Codex's `allow/ask/deny` model in `codex-rs`, and Gemini CLI's trusted-folders + sandboxing docs.

| Task        | Description                                                                                                                                                                                                                                               | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P6-001 | Create `src/runtime/approvals/` with `ApprovalEngine.ts`, `patterns.ts`, `ApprovalStore.ts`.                                                                                                                                                              |           |      |
| TASK-P6-002 | Implement `ApprovalEngine`: evaluates a `ToolCall` against a policy list; returns `ApprovalDecision` (`allow` / `ask` / `deny`). Policy list: array of `{ pattern: string \| RegExp, mode: ApprovalMode, toolNames?: string[] }`.                         |           |      |
| TASK-P6-003 | Implement `ApprovalStore`: persists `allow-always` decisions to a project-scoped JSON file (`.agentsy/approvals.json`), equivalent to Claude Code's allowlist.                                                                                            |           |      |
| TASK-P6-004 | Create `src/runtime/policy/RiskClassifier.ts`: assigns a `RiskLevel` (`low` / `medium` / `high` / `critical`) to a `ToolCall` based on tool name pattern, argument destructive markers (`rm`, `DELETE`, `drop`, `overwrite`), and file-system path scope. |           |      |
| TASK-P6-005 | Create `src/runtime/sandbox/` with `SandboxMode.ts` (`none` / `process` / `container`): `none` = direct exec; `process` = spawn with restricted env vars and no network; `container` = Docker exec (optional, requires Docker).                           |           |      |
| TASK-P6-006 | Wire `RiskClassifier` output into `ApprovalEngine`: `critical` risk always escalates to `ask` regardless of policy.                                                                                                                                       |           |      |
| TASK-P6-007 | Add `approvalEngine`, `riskClassifier`, `sandboxMode` optional params to `AgentLoopOptions`.                                                                                                                                                              |           |      |
| TASK-P6-008 | Add `./runtime/approvals`, `./runtime/policy`, `./runtime/sandbox` subpath exports. Write tests for each risk level, pattern matching, policy override.                                                                                                   |           |      |

---

### Phase R3 — API Surface Stabilization

- **GOAL-R3**: Freeze public contracts at v0.3.0 to give downstream consumers a stable base before extensibility modules land.

| Task        | Description                                                                                                       | Completed | Date |
| ----------- | ----------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-R3-001 | Mark all public interfaces in `src/types/` as `@public` JSDoc and all experimental interfaces as `@experimental`. |           |      |
| TASK-R3-002 | Run `task check-types` and resolve all remaining TypeScript errors introduced by P0–P6 additions.                 |           |      |
| TASK-R3-003 | Bump version to `0.3.0-alpha.0` in `package.json`; publish to npm with `alpha` dist-tag.                          |           |      |

---

### Phase P7 — Session Persistence

- **GOAL-P7**: Durable `StreamSnapshot` checkpoints enabling crash-safe resume — Gemini CLI's checkpointing model applied to agentsy's existing `src/recovery/` module.

| Task        | Description                                                                                                                                                                                                       | Completed | Date |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P7-001 | Create `src/session/` with `index.ts`, `SessionStore.ts`, `FileSystemSessionStore.ts`, `SessionResumeOptions.ts`.                                                                                                 |           |      |
| TASK-P7-002 | Define `SessionStore` interface: `save(sessionId, snapshot: StreamSnapshot): Promise<void>`, `load(sessionId): Promise<StreamSnapshot \| null>`, `list(): Promise<string[]>`, `delete(sessionId): Promise<void>`. |           |      |
| TASK-P7-003 | Implement `FileSystemSessionStore`: writes `StreamSnapshot` as atomic JSON (write to `.tmp` then rename) under `~/.agentsy/sessions/<sessionId>.json`; handles concurrent access via file lock.                   |           |      |
| TASK-P7-004 | Add `sessionStore?: SessionStore` optional param to `AgentLoopOptions`; call `sessionStore.save(runId, snapshot)` after each step completes in `createAgentLoop.ts`.                                              |           |      |
| TASK-P7-005 | Implement `resumeSession(sessionId, options)` factory function: loads snapshot, reconstructs messages array, returns a pre-initialized `AgentLoopHandle` ready to `run()`.                                        |           |      |
| TASK-P7-006 | Extend `src/recovery/index.ts` `captureStreamState` to accept an optional `sessionStore` and auto-persist when provided.                                                                                          |           |      |
| TASK-P7-007 | Add `./session` subpath export. Write tests: round-trip save/load, atomic write (simulate crash mid-write), resume reconstructs correct message history.                                                          |           |      |

---

### Phase P8 — MCP Orchestration

- **GOAL-P8**: First-class MCP 2025-06-18 compliant server lifecycle management — all production agents in the reference set (Claude Code, Hermes, OpenCode, Gemini CLI) use MCP as the primary tool-extension mechanism.

| Task        | Description                                                                                                                                                                                                                                          | Completed | Date |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P8-001 | Create `src/mcp/` with `index.ts`, `MCPOrchestrator.ts`, `MCPServerConfig.ts`, `MCPTrustLevel.ts`, `MCPCapabilityNegotiator.ts`.                                                                                                                     |           |      |
| TASK-P8-002 | Define `MCPServerConfig`: `{ id, command, args, env, trustLevel: 'trusted' \| 'untrusted' \| 'readonly', autoStart: boolean, restartOnCrash: boolean, timeout: number }`.                                                                            |           |      |
| TASK-P8-003 | Implement `MCPOrchestrator`: manages a registry of `MCPServerConfig`s; `start(id)`, `stop(id)`, `restart(id)`, `listTools(id)`, `callTool(id, name, args, signal)` methods; emits `MCPServerStarted`, `MCPServerStopped`, `MCPServerCrashed` events. |           |      |
| TASK-P8-004 | Implement `MCPCapabilityNegotiator`: handshakes with each server on connect per MCP 2025-06-18 spec; caches `ServerCapabilities`; re-negotiates on reconnect.                                                                                        |           |      |
| TASK-P8-005 | Enforce trust-level filtering in `MCPOrchestrator.callTool`: `readonly` servers may not invoke tools with `write` or `exec` in their `annotations`; `untrusted` servers must pass through `ApprovalEngine` regardless of policy.                     |           |      |
| TASK-P8-006 | Add `mcpOrchestrator?: MCPOrchestrator` optional param to `AgentLoopOptions`; auto-discover MCP tools and merge into agent's tool registry at loop start.                                                                                            |           |      |
| TASK-P8-007 | Add `./mcp` subpath export. Write tests: server lifecycle, capability negotiation, trust-level rejection, tool call dispatch.                                                                                                                        |           |      |

---

### Phase P9 — Provider Strategy + Routing

- **GOAL-P9**: Multi-provider capability matrix with configurable fallback chains — inspired by Hermes Agent's provider-agnostic model switching and nanobot's simple provider config.

| Task        | Description                                                                                                                                                                                                                      | Completed | Date |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P9-001 | Create `src/providers/` with `index.ts`, `ProviderRegistry.ts`, `CapabilityMatrix.ts`, `FallbackChain.ts`.                                                                                                                       |           |      |
| TASK-P9-002 | Populate `CapabilityMatrix`: record of all 9 providers (8 existing + `openaiResponses`) with `contextWindow`, `supportsVision`, `supportsTools`, `supportsStreaming`, `inputCostPer1kTokens`, `outputCostPer1kTokens` values.    |           |      |
| TASK-P9-003 | Implement `FallbackChain`: ordered list of `NormalizerProvider` entries; `next(currentProvider)` returns the next in chain; supports `CostThresholdExceeded` and `ContextWindowWillOverflow` as automatic triggers for fallback. |           |      |
| TASK-P9-004 | Implement `ProviderRegistry`: holds the active `FallbackChain` + `CapabilityMatrix`; `selectProvider(requirements: ProviderRequirements)` returns the best matching provider.                                                    |           |      |
| TASK-P9-005 | Wire `ProviderRegistry` into `createPipeline.ts`: when `providerRegistry` is provided in `PipelineOptions`, auto-select provider before creating normalizer.                                                                     |           |      |
| TASK-P9-006 | Add `./providers` subpath export. Write tests: capability filtering, fallback on overflow, fallback on cost limit, cost accounting integration.                                                                                  |           |      |

---

### Phase X1 — Extensibility Contracts

- **GOAL-X1**: Define all extensibility interfaces that X2–X4 implement, so consumers can type-check their hooks, skills, and plugins against stable contracts.

| Task        | Description                                                                                                                                                                                                                                                | Completed | Date |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X1-001 | Create `src/hooks/types.ts`: `HookRegistry` interface, `HookHandler<T extends HookEvent>` type, `HookDispatcher` interface with `dispatch(event): Promise<HookResult>` and `register(eventType, handler)`.                                                 |           |      |
| TASK-X1-002 | Create `src/skills/types.ts`: `SkillManifest` (re-export from `src/types/skills.ts`), `SkillLoader` interface (`load(path): Promise<SkillManifest>`), `SkillRegistry` interface (`register(manifest)`, `lookup(trigger): SkillManifest[]`).                |           |      |
| TASK-X1-003 | Create `src/plugins/types.ts`: `PluginManifest` (re-export from `src/types/plugins.ts`), `PluginLoader` interface (`load(manifest): Promise<LoadedPlugin>`), `PluginRuntime` interface (`getTools(): ToolDefinition[]`, `getHooks(): HookRegistration[]`). |           |      |
| TASK-X1-004 | Add `./hooks`, `./skills`, `./plugins` stub subpath exports (empty barrel exports pointing at types files) so consumers can import types before implementations land.                                                                                      |           |      |

---

### Phase X2 — Hook Runtime Engine

- **GOAL-X2**: The lifecycle dispatch engine. Inspired by Claude Code's `toolPermission` hooks and Hermes Agent's agent turn hardening (user messages persisted early, hooks fire before each turn mutation).

| Task        | Description                                                                                                                                                                                                      | Completed | Date |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X2-001 | Create `src/hooks/HookDispatcher.ts`: ordered handler registry per event type; `dispatch(event, context)` awaits handlers in registration order; first `deny` or `ask` result short-circuits remaining handlers. |           |      |
| TASK-X2-002 | Implement audit trail: every dispatch call appends `{ eventType, decision, handlerName, timestamp }` to an in-memory audit log; expose `getAuditLog()` and `clearAuditLog()`.                                    |           |      |
| TASK-X2-003 | Wire `HookDispatcher` into `createAgentLoop.ts`: dispatch `beforeStep` / `afterStep` / `beforeToolCall` / `afterToolCall` / `onError` / `onAbort` at appropriate points.                                         |           |      |
| TASK-X2-004 | Add `hookDispatcher?: HookDispatcher` to `AgentLoopOptions`.                                                                                                                                                     |           |      |
| TASK-X2-005 | Write tests: handler ordering, short-circuit on deny, audit log correctness, async handler timeout.                                                                                                              |           |      |

---

### Phase X3 — Skill System

- **GOAL-X3**: Agent Skills open standard compatibility — `.agents/skills/**/SKILL.md` progressive disclosure. Hermes Agent's skill system (agentskills.io compatible, `skills/` directory, `SkillTool` invocation) and Claude Code's `SkillTool` are the reference implementations.

| Task        | Description                                                                                                                                                                                                                    | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-X3-001 | Implement `src/skills/SkillLoader.ts`: scans `~/.agents/skills/` and `.agents/skills/` in workspace root; parses `SKILL.md` frontmatter (name, description, triggers, schema); returns `SkillManifest[]`.                      |           |      |
| TASK-X3-002 | Implement `src/skills/SkillRegistry.ts`: in-memory registry; `register(manifest)`, `lookup(trigger: string): SkillManifest[]`, `list(): SkillManifest[]`.                                                                      |           |      |
| TASK-X3-003 | Implement `src/skills/SkillExecutor.ts`: `execute(manifest, context)` — reads the full `SKILL.md` content and injects it as a `<skill_context>` XML tag into the system prompt via existing `splitLeadingXmlContext` pipeline. |           |      |
| TASK-X3-004 | Add `skillRegistry?: SkillRegistry` to `AgentLoopOptions`; at loop start, scan and register skills from configured paths.                                                                                                      |           |      |
| TASK-X3-005 | Write tests: skill discovery from directory, frontmatter parsing, trigger lookup, system prompt injection.                                                                                                                     |           |      |

---

### Phase X4 — Plugin Runtime

- **GOAL-X4**: Claude plugin manifest compatibility subset — signed checksums, trust isolation. Enables third-party tool bundles to be loaded without compromising the core runtime.

| Task        | Description                                                                                                                                                                                                                   | Completed | Date |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X4-001 | Implement `src/plugins/PluginLoader.ts`: loads a `PluginManifest` from a local path or npm package; verifies `checksum` (SHA-256 HMAC over manifest JSON, key = `pluginSigningKey` config value) before executing entrypoint. |           |      |
| TASK-X4-002 | Implement `src/plugins/PluginRuntime.ts`: calls loaded plugin's exported `register(context)` function; collects returned `ToolDefinition[]` and `HookRegistration[]`; enforces that plugins cannot override built-in tools.   |           |      |
| TASK-X4-003 | Add `plugins?: PluginManifest[]` to `AgentLoopOptions`; load and register all plugins at loop initialization.                                                                                                                 |           |      |
| TASK-X4-004 | Write tests: checksum verification pass/fail, plugin tool registration, built-in tool override rejection.                                                                                                                     |           |      |

---

### Phase P10 — Multi-Agent Orchestration

- **GOAL-P10**: Parent→child subagent spawning with depth caps. Modeled directly on Claude Code's `AgentTool` + `coordinator/` (multi-agent coordinator with `TeamCreateTool` for parallel workstreams) and OpenCode's `@general` subagent.

| Task         | Description                                                                                                                                                                                                                                                | Completed | Date |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P10-001 | Create `src/agent/SubagentRunner.ts`: spawns a child `createAgentLoop` with a copy of parent options minus `memoryEngine` (child uses same wiki read but separate session); `run(task: string, options?: Partial<AgentLoopOptions>): Promise<StepResult>`. |           |      |
| TASK-P10-002 | Add `maxSubagentDepth?: number` (default: 3) to `AgentLoopOptions`; pass `_depth` counter through subagent options; throw `MaxDepthExceededError` at limit.                                                                                                |           |      |
| TASK-P10-003 | Implement `SubagentCoordinator`: manages a pool of `SubagentRunner` instances; `spawnParallel(tasks: string[]): Promise<StepResult[]>` with concurrency bounded by `toolExecutor.concurrencyPool`.                                                         |           |      |
| TASK-P10-004 | Add `subagentCoordinator?: SubagentCoordinator` to `AgentLoopOptions`.                                                                                                                                                                                     |           |      |
| TASK-P10-005 | Write tests: sequential subagent, parallel subagents, depth cap enforcement, parent abort propagates to children.                                                                                                                                          |           |      |

---

### Phase P11 — Observability

- **GOAL-P11**: Structured logging, OpenTelemetry spans, audit trail, and health checks. Gemini CLI (OTel + gRPC, lazy-loaded) and Claude Code (OTel ~400KB deferred via dynamic import) both demonstrate: load OTel lazily to avoid startup cost.

| Task         | Description                                                                                                                                                                                                                                   | Completed | Date |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P11-001 | Create `src/telemetry/` with `index.ts`, `spans.ts`, `structuredLogger.ts`, `healthCheck.ts`.                                                                                                                                                 |           |      |
| TASK-P11-002 | Implement `structuredLogger.ts`: JSON-structured log emitter (`info`, `warn`, `error`, `debug`); redacts secrets via regex patterns from `SEC-003`; writes to stderr by default; accepts optional `WritableStream`.                           |           |      |
| TASK-P11-003 | Implement `spans.ts`: wraps `@opentelemetry/api` behind a dynamic `import()` guard; if OTel is not installed, all span operations are no-ops. Exposes `startSpan(name, attributes)`, `endSpan(span, status)`, `recordException(span, error)`. |           |      |
| TASK-P11-004 | Add OTel span instrumentation to: `createAgentLoop` (loop span), `ToolExecutor.executeAll` (tool span per call), `MCPOrchestrator.callTool` (MCP span), `MemoryRetriever.search` (retrieval span).                                            |           |      |
| TASK-P11-005 | Implement `healthCheck.ts`: `checkHealth(options): Promise<HealthStatus>` — verifies provider connectivity, MCP server reachability, session store writability, vector store connectivity.                                                    |           |      |
| TASK-P11-006 | Add `./telemetry` subpath export. Add `@opentelemetry/api` as optional peer dependency. Write tests for structured log redaction and health check status aggregation.                                                                         |           |      |

---

### Phase X5 — Native Memory Engine (3-Layer Blended Architecture)

- **GOAL-X5**: The core memory system. Layer 0 = immutable raw event log. Layer 1 = Karpathy-style compiled wiki maintained by the memelord lifecycle. Layer 2 = vector RAG (Phase X6) over the wiki. This phase delivers Layers 0 and 1.

**Architecture invariants:**

- The wiki is a **maintained artifact** (Layer 1), NOT a retrieval index. The LLM compiles and updates it.
- Raw session events (Layer 0) are append-only and never modified.
- Vector RAG (Layer 2) indexes wiki pages, NOT raw events.
- `memory_capture()` → updates wiki page → triggers re-embedding in Layer 2.
- `contradict()` → deletes stale wiki page + removes from vector index + re-embeds replacement.
- Privacy tags are enforced on all injected memory context.

| Task        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X5-001 | Create `src/memory/` with `index.ts`, `store.ts`, `RawEventLog.ts`, `WikiStore.ts`, `MemoryLifecycle.ts`, `WikiLinter.ts`.                                                                                                                                                                                                                                                                                                                                      |           |      |
| TASK-X5-002 | Define interfaces in `store.ts`: `MemoryStore` (`save`, `load`, `delete`, `list`), `MemoryRetriever` (`search(query, opts): Promise<MemoryResult[]>`), `MemoryFeedback` (`report(insight)`, `contradict(pageId, replacement)`), `MemoryMaintenance` (`decay()`, `lint(): Promise<LintResult[]>`).                                                                                                                                                               |           |      |
| TASK-X5-003 | Implement `RawEventLog`: append-only JSONL file at `~/.agentsy/memory/raw/sessions/<sessionId>.jsonl`; writes `StreamSnapshot` entries; `append(snapshot)`, `readAll(sessionId)`, `list()`.                                                                                                                                                                                                                                                                     |           |      |
| TASK-X5-004 | Implement `WikiStore`: manages `~/.agentsy/memory/wiki/` directory tree (`entities/`, `concepts/`, `sources/`, `synthesis/`); `writePage(id, content)`, `readPage(id)`, `deletePage(id)`, `listPages(category)`, `appendToLog(entry)` (appends to `wiki/log.md`), `updateIndex()` (rewrites `wiki/index.md` catalog).                                                                                                                                           |           |      |
| TASK-X5-005 | Write `schema/AGENT.md` template: LLM-facing structural conventions for wiki page format — frontmatter fields (`id`, `category`, `created`, `updated`, `citations`, `confidence`), heading conventions, citation format.                                                                                                                                                                                                                                        |           |      |
| TASK-X5-006 | Implement `MemoryLifecycle` (memelord pattern): `startTask(taskDescription)` → vector-searches wiki → returns relevant pages as `<memory_context>` XML for injection; `report(insight)` → appends insight to session observations log; `endTask(feedback)` → scores feedback, triggers wiki synthesis pass (LLM call: summarize session into wiki page updates); `contradict(pageId, replacement)` → deletes old page, writes replacement, queues re-embedding. |           |      |
| TASK-X5-007 | Implement `WikiLinter`: `lint()` scans all wiki pages for: (a) contradictions (two pages claiming opposite facts about the same entity), (b) orphan pages (no citations in other pages), (c) stale pages (confidence < 0.3 and last-updated > 30 days). Returns `LintResult[]`. Exposes as `memory_lint()` tool.                                                                                                                                                |           |      |
| TASK-X5-008 | Implement `decay()`: reduces confidence score of wiki pages not cited in the last N sessions (configurable `decayWindow`, default 10); garbage-collects pages below `gcThreshold` (default 0.1).                                                                                                                                                                                                                                                                |           |      |
| TASK-X5-009 | Add `memoryEngine?: MemoryLifecycle` to `AgentLoopOptions`; call `startTask` / `endTask` at agent loop boundaries in `createAgentLoop.ts`.                                                                                                                                                                                                                                                                                                                      |           |      |
| TASK-X5-010 | Add `./memory` subpath export. Write tests: raw event log append/read, wiki page CRUD, lifecycle startTask/endTask, contradiction resolution, linter detection.                                                                                                                                                                                                                                                                                                 |           |      |

---

### Phase X6 — Vector RAG Backend (OpenBrain Tool Surface)

- **GOAL-X6**: Layer 2 of the memory stack. libSQL/Turso `vector32` backend indexes wiki pages. OpenBrain-compatible tool surface exposes retrieval to the agent.

| Task        | Description                                                                                                                                                                                                                                                                                                                                                                                               | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X6-001 | Create `src/retrieval/` with `index.ts`, `VectorStore.ts`, `LibSQLVectorStore.ts`, `ChunkStrategy.ts`.                                                                                                                                                                                                                                                                                                    |           |      |
| TASK-X6-002 | Define `VectorStore` interface: `upsert(id, vector, metadata)`, `search(vector, topK, filter?): Promise<VectorResult[]>`, `delete(id)`, `count()`.                                                                                                                                                                                                                                                        |           |      |
| TASK-X6-003 | Implement `LibSQLVectorStore`: connects to local `~/.agentsy/memory/vector.db` (libSQL); creates `wiki_embeddings` table with `vector32` column; implements `VectorStore` interface. Falls back gracefully if libSQL is not installed (peer dep).                                                                                                                                                         |           |      |
| TASK-X6-004 | Implement `ChunkStrategy`: splits wiki page markdown into chunks with configurable `chunkSize` (default 512 tokens) and `overlap` (default 64 tokens); returns `Chunk[]` with `pageId`, `chunkIndex`, `content`.                                                                                                                                                                                          |           |      |
| TASK-X6-005 | Create `src/embeddings/` with `index.ts`, `EmbeddingProvider.ts`, `OpenAIEmbeddingProvider.ts`, `LocalEmbeddingProvider.ts`. `EmbeddingProvider` interface: `embed(texts: string[]): Promise<number[][]>`.                                                                                                                                                                                                |           |      |
| TASK-X6-006 | Implement wiki indexer: when `WikiStore.writePage()` is called, auto-chunk the page, call `EmbeddingProvider.embed()`, upsert all chunk vectors into `VectorStore`. When `WikiStore.deletePage()` is called, delete all chunk vectors for that page.                                                                                                                                                      |           |      |
| TASK-X6-007 | Implement OpenBrain tool surface functions: `memory_search(query, opts)` → embed query → vector search → return top-K page chunks with scores; `memory_capture(insight)` → call `MemoryLifecycle.report()` + trigger wiki synthesis; `memory_list(category?, filter?)` → list wiki pages; `memory_stats()` → cardinality, freshness, coverage metrics; `memory_lint()` → delegate to `WikiLinter.lint()`. |           |      |
| TASK-X6-008 | Wire retrieval into context injection: `memory_search` results formatted as `<memory_context id="{pageId}" score="{score}">...</memory_context>` tags, fed through `splitLeadingXmlContext` → `dedupeXmlContext` → `stripXmlContextTags` pipeline. Apply `enforcePrivacyTags: true` to strip any privacy-tagged content.                                                                                  |           |      |
| TASK-X6-009 | Add `SEC-009` injection detection: scan retrieved chunk content for instruction-override patterns before injection; emit `MemoryInjectionSuspected` warning event and drop the chunk if detected.                                                                                                                                                                                                         |           |      |
| TASK-X6-010 | Add `./retrieval` and `./embeddings` subpath exports. Add `@libsql/client` as optional peer dep. Write tests: chunk strategy, vector upsert/search, memory_search tool, injection detection.                                                                                                                                                                                                              |           |      |

---

### Phase X7 — Remote Memory Backend Switch

- **GOAL-X7**: Allow swapping the local libSQL vector store for a remote Turso instance via configuration — zero code change for consumers.

| Task        | Description                                                                                                                                                                                                                               | Completed | Date |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X7-001 | Implement `TursoVectorStore` in `src/retrieval/TursoVectorStore.ts`: same `VectorStore` interface as `LibSQLVectorStore` but uses a remote Turso URL + auth token from config.                                                            |           |      |
| TASK-X7-002 | Add `vectorStoreUrl?: string` and `vectorStoreAuthToken?: string` to `MemoryLifecycle` options; if `vectorStoreUrl` is provided and starts with `libsql://` or `https://`, instantiate `TursoVectorStore` instead of `LibSQLVectorStore`. |           |      |
| TASK-X7-003 | Document the local→remote switch in `docs/developer-guide.md` with a config snippet.                                                                                                                                                      |           |      |
| TASK-X7-004 | Write tests: backend selection logic, Turso connection URL parsing.                                                                                                                                                                       |           |      |

---

### Phase R4 — Downstream App Handoff Readiness

- **GOAL-R4**: Produce a starter spec and integration guide so the downstream consumer project can begin in parallel.

| Task        | Description                                                                                                                                                                                                       | Completed | Date |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-R4-001 | Create `docs/downstream-app-starter.md`: describes how to build a CLI app on top of `@selfagency/agentsy` — `createAgentLoop` setup, provider config, tool registration, memory engine wiring, MCP server config. |           |      |
| TASK-R4-002 | Create `examples/minimal-agent/` directory with a 50-line `index.ts` example: minimal agent with one tool, console streaming output.                                                                              |           |      |
| TASK-R4-003 | Ensure all `@public` API surface is covered by TSDoc comments consumable by the downstream project.                                                                                                               |           |      |

---

### Phase X8 — Compliance + Acceptance Matrix

- **GOAL-X8**: Verify conformance to all relevant open standards and performance SLOs before release.

| Task        | Description                                                                                                                                                                                                                                | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-X8-001 | Agent Skills conformance: verify `SkillLoader` correctly parses all frontmatter fields from agentskills.io spec; run against 5 sample skills from agentskills.io Skills Hub.                                                               |           |      |
| TASK-X8-002 | MCP 2025-06-18 conformance: run official MCP conformance test suite against `MCPOrchestrator`.                                                                                                                                             |           |      |
| TASK-X8-003 | Claude plugin subset conformance: verify `PluginLoader` accepts manifests from 3 published Claude plugins (tools subset only).                                                                                                             |           |      |
| TASK-X8-004 | Security suite: run prompt injection test corpus against `SEC-009` detection; verify `SEC-002` path confinement rejects 20 traversal patterns; verify `SEC-003` redaction strips 15 secret patterns.                                       |           |      |
| TASK-X8-005 | Performance suite: measure startup latency (p50/p95), first-token latency (warm provider), streaming repaint budget, memory ceiling (30-min session), memory retrieval latency (local + remote). Assert against SLOs defined in Section 7. |           |      |

---

### Phase P12 — QA Hardening + Launch

- **GOAL-P12**: Production-ready release with full E2E matrix, adversarial tests, and release channel publishing.

| Task         | Description                                                                                                                                                                                                       | Completed | Date |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P12-001 | Write E2E integration tests in `src/**/*.e2e.test.ts` covering: full agent loop (3 steps, 2 tool calls), session resume after simulated crash, MCP tool invocation, memory search injection, wiki synthesis pass. |           |      |
| TASK-P12-002 | Write adversarial test corpus: malformed JSON tool args, truncated SSE stream, oversized context (>200K tokens), wiki page with injection payload, plugin with invalid checksum.                                  |           |      |
| TASK-P12-003 | Add performance benchmarks to `memory-tests/` and `perf-tests/` directories mirroring Gemini CLI's test structure.                                                                                                |           |      |
| TASK-P12-004 | Publish `@selfagency/agentsy@0.3.0` to npm `latest` channel. Publish `@agentsy/core@0.3.0` shim.                                                                                                  |           |      |
| TASK-P12-005 | Tag `v0.3.0` in git. Create GitHub release with `CHANGELOG.md` entry.                                                                                                                                             |           |      |

---

## 3. Alternatives

- **ALT-001**: Use raw SQLite FTS5 instead of libSQL vector32 for memory retrieval. Rejected: FTS5 is keyword-based, not semantic; would fail on paraphrase and concept-level queries that vector similarity handles. libSQL is a drop-in superset of SQLite.
- **ALT-002**: Embed the wiki compilation logic inside the vector store (auto-summarize on upsert). Rejected: violates the Karpathy insight — wiki compilation is an LLM task (synthesis, judgment, cross-page linking), not a mechanical chunking step.
- **ALT-003**: Use a single flat memory model (just RAG over raw events, no wiki). Rejected: pure RAG over raw events produces noisy, redundant results and fails to surface derived insights. The wiki layer is what makes retrieval useful.
- **ALT-004**: Use a separate process for the MCP orchestrator (sidecar pattern). Rejected: adds deployment complexity inappropriate for a library. MCPOrchestrator runs in-process; consumers who want isolation can run MCP servers out-of-process (which they already are by MCP spec).
- **ALT-005**: Use Bun as the primary runtime. Rejected: Bun adds a non-standard runtime requirement for consumers on Node.js infrastructure. Node.js 22 is already in CI and is the broadly supported target.
- **ALT-006**: Merge `cost-tracker` into `processor`. Rejected: cost tracking is a cross-cutting concern (pipeline + agent loop + MCP calls); keeping it as an independent module allows wiring it anywhere without coupling to the stream processor.
- **ALT-007**: Use a plugin-based model for all new modules (context-manager, cost-tracker, etc.). Rejected: core infrastructure must not be optional or pluggable at module level; it must be present as typed options that consumers wire in. Only third-party extensions use the plugin system.

---

## 4. Dependencies

- **DEP-001**: `@libsql/client` — libSQL/Turso client for vector store (Layer 2). Optional peer dependency.
- **DEP-002**: `@opentelemetry/api` — OTel tracing API (Phase P11). Optional peer dependency; loaded via dynamic import.
- **DEP-003**: `@modelcontextprotocol/sdk` — MCP SDK for MCP 2025-06-18 server lifecycle (Phase P8). Already likely available; confirm version supports 2025-06-18 spec.
- **DEP-004**: `saxophone` — SAX-based streaming XML parser. Already a runtime dependency. Used by `XmlStreamFilter`.
- **DEP-005**: `zod` — schema validation. Already used in normalizers. Confirm v4 (referenced in Claude Code source as `zod v4`).
- **DEP-006**: An embedding provider at runtime (OpenAI API, local model, etc.) — not a package dependency; resolved via `EmbeddingProvider` interface by the consumer.
- **DEP-007**: Docker — optional, only required if `SandboxMode.container` is used. Not a package dependency.

---

## 5. Files

### Modified Existing Files

- **FILE-001**: `package.json` — rename, add new subpath exports, bump version, add optional peer deps.
- **FILE-002**: `src/agent/types.ts` — add `skillRegistry`, `sessionStore`, `hookDispatcher`, `memoryEngine`, `costTracker`, `approvalEngine`, `toolExecutor`, `contextManager`, `subagentCoordinator`, `mcpOrchestrator`, `providerRegistry`, `plugins` optional params to `AgentLoopOptions`.
- **FILE-003**: `src/agent/createAgentLoop.ts` — wire all new optional services into the loop lifecycle.
- **FILE-004**: `src/processor/LLMStreamProcessor.ts` — add 6 new event emissions.
- **FILE-005**: `src/pipeline/createPipeline.ts` — add `openaiResponses` to `NormalizerProvider`, add `providerRegistry` to `PipelineOptions`.
- **FILE-006**: `src/recovery/index.ts` — add optional `sessionStore` auto-persist.
- **FILE-007**: `tsup.config.ts` — add all new module entry points.
- **FILE-008**: `src/index.ts` — re-export new public API surfaces.

### New Modules

- **FILE-009**: `src/types/` — `events.ts`, `hooks.ts`, `memory.ts`, `skills.ts`, `plugins.ts`, `providers.ts`, `approval.ts`, `index.ts`
- **FILE-010**: `src/context-manager/` — `index.ts`, `ContextManager.ts`, `compressConversation.ts`, `tokenBudget.ts`
- **FILE-011**: `src/cost-tracker/` — `index.ts`, `CostTracker.ts`, `pricingMap.ts`
- **FILE-012**: `src/tool-executor/` — `index.ts`, `ToolExecutor.ts`, `concurrencyPool.ts`
- **FILE-013**: `src/runtime/approvals/` — `ApprovalEngine.ts`, `patterns.ts`, `ApprovalStore.ts`
- **FILE-014**: `src/runtime/policy/` — `RiskClassifier.ts`
- **FILE-015**: `src/runtime/sandbox/` — `SandboxMode.ts`
- **FILE-016**: `src/hooks/` — `types.ts`, `HookDispatcher.ts`, `index.ts`
- **FILE-017**: `src/skills/` — `types.ts`, `SkillLoader.ts`, `SkillRegistry.ts`, `SkillExecutor.ts`, `index.ts`
- **FILE-018**: `src/plugins/` — `types.ts`, `PluginLoader.ts`, `PluginRuntime.ts`, `index.ts`
- **FILE-019**: `src/session/` — `index.ts`, `SessionStore.ts`, `FileSystemSessionStore.ts`, `SessionResumeOptions.ts`
- **FILE-020**: `src/mcp/` — `index.ts`, `MCPOrchestrator.ts`, `MCPServerConfig.ts`, `MCPTrustLevel.ts`, `MCPCapabilityNegotiator.ts`
- **FILE-021**: `src/providers/` — `index.ts`, `ProviderRegistry.ts`, `CapabilityMatrix.ts`, `FallbackChain.ts`
- **FILE-022**: `src/memory/` — `index.ts`, `store.ts`, `RawEventLog.ts`, `WikiStore.ts`, `MemoryLifecycle.ts`, `WikiLinter.ts`
- **FILE-023**: `src/retrieval/` — `index.ts`, `VectorStore.ts`, `LibSQLVectorStore.ts`, `TursoVectorStore.ts`, `ChunkStrategy.ts`
- **FILE-024**: `src/embeddings/` — `index.ts`, `EmbeddingProvider.ts`, `OpenAIEmbeddingProvider.ts`, `LocalEmbeddingProvider.ts`
- **FILE-025**: `src/telemetry/` — `index.ts`, `spans.ts`, `structuredLogger.ts`, `healthCheck.ts`
- **FILE-026**: `src/agent/SubagentRunner.ts`, `src/agent/SubagentCoordinator.ts`
- **FILE-027**: `schema/AGENT.md` — LLM-facing wiki structural conventions
- **FILE-028**: `packages/llm-stream-parser/` — compatibility shim package
- **FILE-029**: `docs/architecture.md`, `docs/downstream-app-starter.md`
- **FILE-030**: `examples/minimal-agent/index.ts`

---

## 6. Testing

- **TEST-001**: `src/types/types.test.ts` — discriminated union narrowing for all new type unions.
- **TEST-002**: `src/processor/LLMStreamProcessor.test.ts` — 6 new events (overflow, compressed, loop, citation, retry, invalid stream), edge cases at threshold boundaries.
- **TEST-003**: `src/context-manager/contextManager.test.ts` — overflow detection, auto-compact trigger, `ChatCompressed` event, post-compression message structure.
- **TEST-004**: `src/cost-tracker/costTracker.test.ts` — token accumulation, USD calculation, budget enforcement, `CostThresholdExceeded` event, per-step reset.
- **TEST-005**: `src/tool-executor/toolExecutor.test.ts` — sequential ordering under concurrency, cap enforcement, abort propagation, error semantics.
- **TEST-006**: `src/runtime/approvals/approvalEngine.test.ts` — all `ApprovalMode` values, pattern matching, policy override, `ApprovalStore` persistence round-trip.
- **TEST-007**: `src/runtime/policy/riskClassifier.test.ts` — `critical` escalation for destructive markers, `low` for read-only tools, path confinement rejection.
- **TEST-008**: `src/hooks/hookDispatcher.test.ts` — handler ordering, `deny` short-circuit, audit log correctness, async timeout.
- **TEST-009**: `src/skills/skills.test.ts` — discovery from two-directory scan, frontmatter parsing, trigger lookup, `<skill_context>` injection.
- **TEST-010**: `src/plugins/plugins.test.ts` — checksum pass/fail, tool registration, built-in tool override rejection.
- **TEST-011**: `src/session/session.test.ts` — save/load round-trip, atomic write crash simulation, resume message history reconstruction.
- **TEST-012**: `src/mcp/mcp.test.ts` — server lifecycle, capability negotiation, trust-level rejection, tool call dispatch.
- **TEST-013**: `src/providers/providers.test.ts` — capability filtering, fallback on overflow event, fallback on cost limit, cost accounting.
- **TEST-014**: `src/memory/memory.test.ts` — raw log append/read, wiki CRUD, lifecycle startTask/endTask, contradiction resolution, linter (contradiction, orphan, stale detection), decay below threshold.
- **TEST-015**: `src/retrieval/retrieval.test.ts` — chunk strategy correctness, vector upsert/search, memory_search tool result format, `MemoryInjectionSuspected` detection for injection patterns.
- **TEST-016**: `src/telemetry/telemetry.test.ts` — structured log redaction (15 secret patterns), health check status aggregation, OTel no-op when not installed.
- **TEST-017**: `src/agent/subagent.test.ts` — sequential/parallel subagents, depth cap `MaxDepthExceededError`, parent abort propagates.
- **TEST-018**: E2E: full 3-step agent loop with 2 tool calls, session resume after crash, memory search context injection, wiki synthesis pass trigger.
- **TEST-019**: Adversarial: malformed JSON tool args, truncated SSE stream, oversized context, wiki injection payload, invalid plugin checksum.
- **TEST-020**: Performance benchmarks: startup latency (p50 ≤ 500ms, p95 ≤ 900ms), memory retrieval (local p95 ≤ 50ms, remote p95 ≤ 150ms).

---

## 7. Risks & Assumptions

- **RISK-001**: libSQL `vector32` API may change between libSQL releases. **Mitigation**: pin `@libsql/client` to a minor version; wrap all vector operations behind `VectorStore` interface so backend can be swapped.
- **RISK-002**: Wiki synthesis LLM call in `endTask()` may be slow or fail. **Mitigation**: synthesis is async and non-blocking; if it fails, log a warning and continue. The raw event log always captures the truth.
- **RISK-003**: MCP 2025-06-18 spec may have breaking changes from the SDK's current supported version. **Mitigation**: verify `@modelcontextprotocol/sdk` version in TASK-P8-003; file conformance issues if discovered.
- **RISK-004**: The vector embedding dimension must match between the embedding provider used for indexing and the provider used for querying. **Mitigation**: store embedding dimension metadata per-wiki-page; reject queries from a different-dimension provider with a clear error.
- **RISK-005**: `memory_capture()` and wiki synthesis both write to the same wiki page directory; concurrent writes could corrupt pages. **Mitigation**: implement file-level advisory locking in `WikiStore.writePage()`.
- **RISK-006**: Plugin signature verification requires a shared secret (`pluginSigningKey`). If not configured, all plugins are untrusted. **Mitigation**: default to `untrusted` mode (no tools loaded) when no key is configured; emit a `PluginKeyNotConfigured` warning.
- **RISK-007**: Prompt injection via retrieved wiki content (SEC-009). **Mitigation**: regex pattern matching before injection (TASK-X6-009) provides a first defense layer; future hardening via a dedicated injection classifier model is on the roadmap.

### Assumptions

- **ASSUMPTION-001**: PR #46 (Ink renderer) is merged to main before Phase R0 begins. The plan treats the Ink renderer as complete.
- **ASSUMPTION-002**: The downstream consumer application is a separate git repository that will depend on `@selfagency/agentsy` as a published npm package — not a monorepo member.
- **ASSUMPTION-003**: All LLM calls for wiki synthesis in `MemoryLifecycle.endTask()` use the same provider already configured in `AgentLoopOptions`; no separate synthesis model config is needed for v0.3.0.
- **ASSUMPTION-004**: The local libSQL vector store is sufficient for development and single-user production use. Turso remote is an enhancement (X7), not a blocker for any prior phase.
- **ASSUMPTION-005**: Agent Skills spec frontmatter is stable at the agentskills.io 1.0 published version. If the spec changes before X8, only `SkillLoader` needs to be updated.

### SLO Targets

| Metric                                       | Target                                       |
| -------------------------------------------- | -------------------------------------------- |
| Startup latency p50                          | ≤ 500ms                                      |
| Startup latency p95                          | ≤ 900ms                                      |
| First-token latency p50 (warm provider)      | ≤ 350ms                                      |
| Streaming repaint budget                     | ≥ 20 FPS under sustained token stream        |
| Memory ceiling (30-min session)              | ≤ 220MB                                      |
| Tool reliability (non-destructive built-ins) | ≥ 95%                                        |
| Session resume reliability                   | ≥ 99% deterministic restore                  |
| Memory retrieval p95 (local libSQL)          | ≤ 50ms                                       |
| Memory retrieval p95 (remote Turso)          | ≤ 150ms                                      |
| Wiki synthesis latency                       | Async / non-blocking (task-end trigger only) |

---

## 8. Related Specifications / Further Reading

- [Claude Code Leaked Source Analysis (tanbiralam/claude-code)](https://github.com/tanbiralam/claude-code) — architecture reference: `QueryEngine.ts`, `cost-tracker.ts`, `toolPermission/`, `coordinator/`, `memdir/`, `skills/`, `plugins/`
- [OpenCode (anomalyco/opencode)](https://github.com/anomalyco/opencode) — client/server architecture, LSP integration, provider-agnostic model, TUI-as-client-only separation
- [Hermes Agent (NousResearch/hermes-agent)](https://github.com/NousResearch/hermes-agent) — closed learning loop, skill discovery, FTS5 session search, Honcho user modeling, agentskills.io compatibility
- [nanobot (HKUDS/nanobot)](https://github.com/HKUDS/nanobot) — lightweight agent loop, memory as context injection (not orchestration layer), Dream skill lifecycle
- [Gemini CLI (google-gemini/gemini-cli)](https://github.com/google-gemini/gemini-cli) — conversation checkpointing, trusted-folders sandbox policy, token caching, OTel lazy-load pattern
- [OpenAI Codex (openai/codex)](https://github.com/openai/codex) — `codex-rs` Rust safety model, `allow/ask/deny` approval engine, remote plugin skill read API
- [Karpathy LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — the compiled wiki architectural pattern; wiki maintenance operations (ingest, lint, update)
- [Agent Skills Open Standard (agentskills.io)](https://agentskills.io/) — skill manifest spec for progressive disclosure and cross-agent skill portability
- [MCP 2025-06-18 Specification](https://modelcontextprotocol.io) — server lifecycle, capability negotiation, trust model
- [AG-UI Protocol](https://docs.ag-ui.com) — existing `src/ag-ui/` implementation; event vocabulary for `RUN_*`, `STEP_*`, `TEXT_MESSAGE_*`, `TOOL_CALL_*`
- [libSQL / Turso vector32 docs](https://docs.turso.tech/features/vector-similarity-search) — vector store backend for Layer 2 memory
