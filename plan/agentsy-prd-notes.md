---
goal: 'Research consolidation for @agentsy platform — primary source findings mapped to requirements'
version: '1.0'
date_created: '2026-05-02'
last_updated: '2026-05-02'
owner: 'selfagency'
status: 'Completed'
tags: ['research', 'prd', 'agentsy', 'synthesis']
---

# @agentsy Platform — PRD Research Notes

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Consolidated research from nine reference codebases, mapped to `@agentsy` requirements and implementation phases. Each finding includes a primary source citation and a priority annotation. This document is the evidential foundation for all design decisions in `agentsy-platform-v2.md` and `agentsy-tech.md`.

---

## 1. Research Corpus

| ID     | Project                                | Version Analyzed | Primary Source URL                                                                                        | Key Contribution                                                                                                                                                                          |
| ------ | -------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SRC-1  | Claude Code                            | v2.1.88          | <https://github.com/chauncygu/collection-claude-code-source-code>                                         | 12 harness mechanisms, tool interface, DCE                                                                                                                                                |
| SRC-2  | nanobot                                | HEAD 2026-04-19  | <https://github.com/HKUDS/nanobot>                                                                        | 2-stage memory, cursor-JSONL, atomic writes                                                                                                                                               |
| SRC-3  | Hermes Agent                           | HEAD             | <https://github.com/NousResearch/hermes-agent>                                                            | Closed learning loop, FTS5, warning guardrails                                                                                                                                            |
| SRC-4  | OpenAI Codex                           | codex-rs HEAD    | <https://github.com/openai/codex/blob/main/codex-rs/README.md>                                            | Sandbox modes, WebSocket timeout, thread store                                                                                                                                            |
| SRC-5  | Gemini CLI                             | HEAD             | <https://github.com/google-gemini/gemini-cli>                                                             | 3 release channels, ACP, conversation checkpoint                                                                                                                                          |
| SRC-6  | OpenCode                               | v1.14.33         | <https://github.com/anomalyco/opencode>                                                                   | Plan agent, named subagents, client/server split                                                                                                                                          |
| SRC-7  | vercel/ai                              | HEAD             | <https://github.com/vercel/ai/blob/main/packages/ai/src/agent/tool-loop-agent.ts>                         | StopCondition, prepareStep, mergeCallbacks                                                                                                                                                |
| SRC-8  | TanStack AI                            | HEAD             | <https://github.com/TanStack/ai/blob/main/packages/typescript/ai/src/activities/chat/stream/processor.ts> | StreamProcessor state machine, ChunkStrategy                                                                                                                                              |
| SRC-9  | nano-claude-code                       | v3.0             | <https://github.com/chauncygu/collection-claude-code-source-code/blob/main/README.MD>                     | Minimal tool registry, context injection only                                                                                                                                             |
| SRC-10 | janhq/jan                              | HEAD             | <https://github.com/janhq/jan>                                                                            | Local LLM runner, OpenAI-compatible localhost:1337, MCP integration                                                                                                                       |
| SRC-11 | huggingface/smolagents                 | HEAD             | <https://github.com/huggingface/smolagents>                                                               | CodeAgent code-as-actions (~30% fewer steps), parallel ThreadPoolExecutor tool calls, state dict cross-step passing                                                                       |
| SRC-12 | bytedance/deer-flow                    | HEAD             | <https://github.com/bytedance/deer-flow>                                                                  | Skills-as-markdown progressive loading, context compression, LangGraph orchestrator                                                                                                       |
| SRC-13 | OpenHands/OpenHands                    | HEAD             | <https://github.com/All-Hands-AI/OpenHands>                                                               | Software Agent SDK, RBAC, Slack/Jira/Linear integrations, ToM module                                                                                                                      |
| SRC-14 | The-Pocket/PocketFlow                  | HEAD             | <https://github.com/The-Pocket/PocketFlow>                                                                | 100-line graph core, A2A protocol, LLM-as-judge, heartbeat monitoring                                                                                                                     |
| SRC-15 | FellouAI/eko                           | v4.1.3           | <https://github.com/FellouAI/eko>                                                                         | DAG parallel execution, pause/resume/snapshot, A2A protocol, replan capability, streaming XML workflow generation                                                                         |
| SRC-16 | octotools/octotools                    | HEAD             | <https://github.com/octotools/octotools>                                                                  | Tool Cards (structured metadata), dual-level planning (global+per-step), toolset optimization                                                                                             |
| SRC-17 | wrtnlabs/agentica                      | HEAD             | <https://github.com/wrtnlabs/agentica>                                                                    | Compiler-driven typia schemas, validation feedback loop, parallel divided selection, eliticism, pluggable IAgenticaExecutor                                                               |
| SRC-18 | Pythagora-io/gpt-pilot                 | UNMAINTAINED     | <https://github.com/Pythagora-io/gpt-pilot>                                                               | Named pipeline, step persistence (reference only; unmaintained)                                                                                                                           |
| SRC-19 | bitswired/agentic-loop                 | HEAD             | <https://github.com/bitswired/agentic-loop>                                                               | Minimal reference loop implementation                                                                                                                                                     |
| SRC-20 | lobehub/lobe-chat                      | HEAD             | <https://github.com/lobehub/lobe-chat>                                                                    | 505+ agents, branching CRDT conversation trees, white-box editable memory                                                                                                                 |
| SRC-21 | adolfousier/opencrabs                  | HEAD             | <https://github.com/adolfousier/opencrabs>                                                                | Rust A2A; 3-tier memory (FTS5+vector RRF); RSI feedback ledger; typed sub-agents; self-healing; Bee Colony debate                                                                         |
| SRC-22 | nibzard/awesome-agentic-patterns       | HEAD             | <https://github.com/nibzard/awesome-agentic-patterns>                                                     | 120+ named patterns in 8 categories                                                                                                                                                       |
| SRC-23 | Anthropic "Building Effective Agents"  | 2024             | <https://www.anthropic.com/engineering/building-effective-agents>                                         | Canonical 5-workflow taxonomy (chaining/routing/parallelization/orchestrator-workers/evaluator-optimizer)                                                                                 |
| SRC-24 | evalops/shared-memory-mcp              | HEAD             | <https://github.com/evalops/shared-memory-mcp>                                                            | 6x token efficiency via context dedup and delta updates for multi-agent sharing                                                                                                           |
| SRC-25 | agenticloops-ai/agentic-ai-engineering | HEAD             | <https://github.com/agenticloops-ai/agentic-ai-engineering>                                               | 6-module curriculum: foundations→production; 12-factor agents                                                                                                                             |
| SRC-26 | garrytan/gstack                        | HEAD             | <https://github.com/garrytan/gstack>                                                                      | 88k-star Claude Code skill pack; sprint lifecycle 23 skills; continuous checkpoint WIP commits; GBrain PGLite/Supabase; ML prompt injection defense; taste memory; 10-15 parallel sprints |
| SRC-27 | langwatch/scenario                     | HEAD             | <https://github.com/langwatch/scenario>                                                                   | UserSimulator+JudgeAgent+RedTeamAgent testing framework; Crescendo escalation attack; pass^k consistency; autopilot+scripted modes; cache reproducibility                                 |
| SRC-28 | chaosync-org/awesome-ai-agent-testing  | HEAD             | <https://github.com/chaosync-org/awesome-ai-agent-testing>                                                | Curated testing list; pass^k metric; chaos engineering patterns; OpenTelemetry GenAI semantic conventions; benchmarks: GAIA, tau-bench, WebArena, SWE-Bench                               |

---

## 2. Architecture Decision Records

### ADR-001: Factory Functions Over Classes

**Decision**: All stateful modules export factory functions (`create*`) rather than classes directly.

**Evidence**:

- SRC-7 (vercel/ai): `ToolLoopAgent` is a class but the _public API_ is `createToolLoopAgent()`. Consumers never call `new`.
- SRC-8 (TanStack): `StreamProcessor` is a class but composed via factory function from the agent loop.
- SRC-9 (nano-claude-code): "Tool registry as extension point" — 98-line registry is a factory-initialized singleton, not a class hierarchy.

**Rationale**: Factory functions are idiomatic for ESM tree-shaking, support dependency injection, allow lazy initialization, and avoid `new` leaking into consumer code. Classes remain as internal implementation detail.

---

### ADR-002: Stop Conditions as Composable Async Predicates

**Decision**: Loop termination is controlled by composable external predicate functions, not inline integer guards.

**Evidence**:

- SRC-7 (vercel/ai) — `stop-condition.ts`: `type StopCondition = (options: { steps: StepResult[] }) => PromiseLike<boolean> | boolean`. Built-in: `isStepCount(20)`, `isLoopFinished()`, `hasToolCall('planTool')`.
  - Source: <https://github.com/vercel/ai/blob/main/packages/ai/src/generate-text/stop-condition.ts>
- SRC-8 (TanStack AI) — `agent-loop-strategies.ts`: `type AgentLoopStrategy = (state: { iterationCount, finishReason, messages }) => boolean`. Built-in: `maxIterations(n)`, `untilFinishReason([...])`, `combineStrategies([...])`.
  - Source: <https://github.com/TanStack/ai/blob/main/packages/typescript/ai/src/activities/chat/agent-loop-strategies.ts>
- SRC-1 (Claude Code): `LoopDetected` event + one-step grace = implicit conditional predicate.

**Cross-project consensus**: 3 of 9 projects independently converged on functional predicates. Settled consensus.

**Rationale**: Predicates are composable, testable in isolation, and allow caller-supplied custom termination logic without forking the agent loop internals.

---

### ADR-003: Per-Message State Map in Stream Processor

**Decision**: `LLMStreamProcessor` tracks stream state per message in a `Map<messageId, MessageStreamState>` rather than flat accumulator fields.

**Evidence**:

- SRC-8 (TanStack): `StreamProcessor` uses `Map<messageId, MessageStreamState>` for text/tool-call/thinking accumulation. `Map<toolCallId, InternalToolCallState>` for tool arguments. `Set<runId>` for concurrent run tracking.
  - Source: `packages/typescript/ai/src/activities/chat/stream/processor.ts`
- SRC-1 (Claude Code): Per-agent `AsyncLocalStorage` context — equivalent isolation pattern.

**Rationale**: Multi-message agentic sessions (where multiple assistant messages arrive per session) cannot be modeled correctly with a single flat accumulator. The Map pattern handles out-of-order events, concurrent runs, and replay without shared mutable state.

---

### ADR-004: Lazy Assistant Message Creation

**Decision**: `LLMStreamProcessor.startStream()` must not push a message to the array until the first content-bearing chunk arrives.

**Evidence**:

- SRC-8 (TanStack): `prepareAssistantMessage()` pattern — previous `startAssistantMessage()` eagerly created the message, causing empty-message flicker. Fixed to lazy creation on first `TEXT_MESSAGE_CONTENT` or `TOOL_CALL_START`.
  - Source: TanStack AI processor.ts, `prepareAssistantMessage` → `createAssistantMessage` deferred path
- SRC-4 (Codex): No session/thread DB row created until first user turn (process-scoped lazy init).
  - Source: <https://github.com/openai/codex/blob/main/codex-rs> (thread-store crate)
- SRC-2 (nanobot): `fix: lazy session creation` commit 2026-04-12.

**Rationale**: Eager creation causes UI flicker (empty message rows), orphan DB records, and wasted session storage on aborted initializations.

---

### ADR-005: Blocking User Message Write, Fire-and-Forget Assistant Writes

**Decision**: `FileSystemSessionStore.save()` for user-turn messages must use `await` (blocking). Assistant messages use a fire-and-forget ordered queue.

**Evidence**:

- SRC-1 (Claude Code) `recordTranscript()`:

  ```text
  User messages  → await write (blocking, crash recovery)
  Assistant msgs → fire-and-forget (order-preserving queue)
  Progress       → inline write (dedup on next query)
  Flush          → on result yield / cowork eager flush
  ```

- SRC-2 (nanobot): `agent turn hardened — user messages persisted early` commit 2026-04-13 explicitly confirms this pattern.

**Rationale**: If the process crashes mid-tool-execution, the user message (which triggered the execution) must be recoverable. Assistant messages are reconstructable from the LLM if lost; user messages are not.

---

### ADR-006: Tool Approval as Pauseable Loop, Not Exception

**Decision**: When tool approval is required, the agent loop halts with a structured `ApprovalRequired` result. It does not throw. Resumption is via `loop.continue({ toolCallId, approved, modifiedInput })`.

**Evidence**:

- SRC-7 (vercel/ai): `toolApproval` is a `StopCondition` variant — loop returns `finishReason: 'tool-calls'` with pending call. Caller provides approval and re-enters.
  - Source: `tool-loop-agent.ts` `toolApproval?: ToolApprovalConfiguration<TOOLS, RUNTIME_CONTEXT>`
- SRC-6 (OpenCode): `plan` mode denies all write/exec tools — same concept expressed as a mode rather than per-call approval.
- SRC-1 (Claude Code) permission flow: 5 stages, the last of which is interactive prompt — not exception-based.

**Rationale**: Exception-based approval (throw on denied) is incompatible with async approval UIs (the user needs time to respond). Structured result + resume enables async/remote approval workflows.

---

### ADR-007: Two-Stage Memory (Consolidator → Dream)

**Decision**: `@agentsy/memory` implements a two-stage pipeline: Stage 1 (Consolidator / ContextManager) summarizes to `history.jsonl`; Stage 2 (Dream / MemoryLifecycle) synthesizes to wiki files.

**Evidence**:

- SRC-2 (nanobot) `docs/memory.md` (189 lines, canonical memory design doc):

  ```text
  Stage 1: Consolidator → summarize oldest safe slice → append to history.jsonl
  Stage 2: Dream reads history.jsonl + SOUL.md + USER.md + MEMORY.md
         → surgical edits to long-term files (not full rewrites)
         → runs on cron (intervalH) + manual /dream
         → GitStore records each change
  ```

- SRC-3 (Hermes): "closed learning loop — Agent-curated memory with periodic nudges. Autonomous skill creation after complex tasks."
- SRC-1 (Claude Code): `services/compact/` with three strategies: `autoCompact`, `snipCompact`, `contextCollapse`.

**Rationale**: Separating event summarization (Stage 1, context-budget-triggered) from knowledge synthesis (Stage 2, schedule-triggered) ensures context compression remains fast while wiki synthesis can be thorough and model-expensive.

---

### ADR-008: Warning-First Loop Guardrails

**Decision**: First loop detection emits a `LoopDetected` warning event and allows one more step. Hard abort on second consecutive detection (`LoopExceeded`).

**Evidence**:

- SRC-3 (Hermes): `fix(agent): make tool loop guardrails warning-first` — before this fix, exceeding tool loop limit was immediate error.
- SRC-1 (Claude Code): `LoopDetected` event design implies grace period before escalation.

**Rationale**: LLM behavior is variable. A strict "fail on first detected loop" causes false positives on legitimate multi-step tasks that temporarily look repetitive. One-step grace significantly reduces spurious failures without meaningfully increasing runaway risk.

---

### ADR-009: Allow Rules Take Priority Over Deny Rules

**Decision**: In `ApprovalEngine` policy evaluation: `alwaysDenyRules` → evaluated, then `alwaysAllowRules` — an explicit allow **overrides** a deny if the allow pattern is more specific.

**Evidence**:

- SRC-2 (nanobot): `fix: allow_patterns take priority over deny_patterns in ExecTool` commit 2026-04-13.

**Note**: This is counter-intuitive. Engineers expect "deny wins." The correct model is "most specific wins." Must be explicitly unit-tested.

**Rationale**: Broad deny rules (e.g., "deny all shell execution") should not block explicitly approved narrow operations (e.g., "allow `git status`"). Specificity-wins semantics allow safe broad deny + targeted unlock.

---

### ADR-010: Atomic Session Writes with Auto-Repair on Startup

**Decision**: Session files written as `.tmp` → verify → rename. On startup, scan for `*.json.tmp` orphan files; attempt repair; rename if valid, log-and-delete if invalid.

**Evidence**:

- SRC-2 (nanobot): `feat: atomic session writes with auto-repair` commit 2026-04-19.
- SRC-1 (Claude Code): Atomic JSONL append pattern for transcript recording.

**Rationale**: Process crashes during writes leave partially-written files. Atomic rename prevents corrupt reads. Auto-repair on startup recovers from crash-mid-write scenarios without silent data loss.

---

### ADR-011: TOOL_CALL_END Dual Role (Arguments-Final + Result-Inline)

**Decision**: `TOOL_CALL_END` AG-UI event serves two purposes: (1) arguments finalized (no result field), (2) server tool result inlined (result field present). A separate `TOOL_CALL_RESULT` event is only needed for client-executed tools.

**Evidence**:

- SRC-8 (TanStack): `handleToolCallEndEvent()` handles both cases in a single branch:

  ```text
  if (chunk.result != null) → create output field + tool-result part (server tool)
  else → input-arguments finalized only (client tool, result arrives via addToolResult)
  ```

**Rationale**: Eliminates a round-trip for server-side tools (the common case). Client-tool approval/execution still requires the separate `addToolResult()` path.

---

### ADR-012: Context Compression Skips Active Tool Calls

**Decision**: `ContextManager.check()` accepts an `isToolCallActive: boolean` flag and skips compression when `true`.

**Evidence**:

- SRC-2 (nanobot): `auto-compact skips active tasks` commit 2026-04-13. Compressing during tool execution can corrupt `tool_use`/`tool_result` pairing.

**Rationale**: The message array must maintain matched `tool_use`/`tool_result` pairs. Compressing the `tool_use` message while the `tool_result` hasn't arrived produces an invalid message history that causes model errors.

---

### ADR-013: FTS5 Complementary to Vector RAG

**Decision**: `@agentsy/retrieval` should support FTS5 full-text search over `RawEventLog` as an alternative retrieval path alongside vector similarity search.

**Evidence**:

- SRC-3 (Hermes): "FTS5 session search with LLM summarization for cross-session recall." Built on SQLite FTS5.
- SRC-7 (vercel/ai, SRC-4 Codex): No FTS5, but both rely on structured retrieval. FTS5 complements vector similarity by handling exact-match queries efficiently.

**Implementation note**: libSQL has built-in FTS5 support — no extra dependency required.

---

### ADR-014: WebSocket Idle Timeout for MCP Connections

**Decision**: `MCPServerConfig` must include `connectionIdleTimeoutMs?: number` (default `30_000`). All WebSocket-transport MCP connections enforce this timeout.

**Evidence**:

- SRC-4 (Codex): `Bound websocket request sends with idle timeout (#20751)` merged 2026-05-01. Long-running sessions leave WebSocket connections open indefinitely without this.

**Rationale**: MCP servers may be hosted processes. Stale connections are undetected by default. An idle timeout triggers reconnect, preventing silent hang.

---

### ADR-015: Remote Skill/Plugin Loading via URL

**Decision**: `SkillLoader` and `PluginLoader` must support HTTP(S) URLs in addition to local filesystem paths.

**Evidence**:

- SRC-4 (Codex): `Add remote plugin skill read API (#20150)` — plugins/skills readable from remote URL in both Python and TypeScript SDKs.
- SRC-1 (Claude Code): `SkillTool` + `memdir/` lazy-inject — local only, but the pattern is extensible.

**Implementation**: `remoteUrl?: string` on `SkillManifest`/`PluginManifest`. Use `fetch()` + SHA-256 checksum verification before loading.

---

### ADR-016: Three Release Channels

**Decision**: `nightly` (daily), `preview` (weekly Tuesday UTC), `latest` (weekly Tuesday UTC — promoted from preview).

**Evidence**:

- SRC-5 (Gemini CLI): Exact cadence:

  ```text
  preview  → weekly, Tuesday UTC 23:59
  stable   → weekly, Tuesday UTC 20:00 (= prior week's preview promoted)
  nightly  → daily, UTC 00:00
  ```

---

### ADR-017: Cursor-Based JSONL for Raw Event Log

**Decision**: `RawEventLog` (Layer 0 memory) uses append-only JSONL with two cursor files: `.cursor` for ContextManager reads, `.dream_cursor` for MemoryLifecycle synthesis reads.

**Evidence**:

- SRC-2 (nanobot): `history.jsonl` cursor pattern with separate Consolidator cursor and Dream cursor files (`.cursor` and `.dream_cursor`). Prevents Stage 2 from re-reading events already incorporated into wiki.

---

### ADR-018: Memory Write Scope in Sandbox Mode

**Decision**: `SandboxMode.process` (workspace-write equivalent) automatically permits writes to `~/.agentsy/memory/` without requiring separate approval.

**Evidence**:

- SRC-4 (Codex): `workspace-write` mode includes `~/.codex/memories` in writable roots automatically. Memory maintenance is a background operation, not a user-visible tool call.

---

### ADR-019: Caveman Mode as Bundled Skill, Not Runtime Filter

**Decision**: Token compression in `@agentsy/caveman` is implemented as bundled SKILL.md system-prompt injections, not as a post-processing filter on model output tokens.

**Evidence**: JuliusBrussee/caveman v1.7.0 (52.5k stars): the entire compression mechanism is a SKILL.md that instructs the model to produce compressed output. `caveman-shrink` MCP proxy compresses tool _descriptions_ (input to model) — reducing prompt tokens, not output tokens.

**Rationale**: Post-processing token compression would require streaming token-by-token mutation, which is fragile and destructive to structured output (JSON, code). Prompt-side compression leverages the model's own language capabilities at zero inference-time overhead. The two techniques (prompt injection + tool description compression) are orthogonal and complementary.

---

### ADR-020: Skills CLI as Subprocess, Not Library Import

**Decision**: `@agentsy/skills` wraps `npx skills` as a child subprocess rather than importing vercel-labs/skills internals as a library.

**Evidence**: vercel-labs/skills is designed as a CLI tool with no published programmatic Node.js API surface. `@mcpmarket/mcp-auto-install` uses the same pattern.

**Rationale**: Importing CLI internals creates tight coupling to internal module structure that changes without semver guarantees. Subprocess spawning treats the CLI as a stable, versioned interface. Input validation (SEC-011) on the `ref` argument prevents command injection through the subprocess call.

---

### ADR-021: MCP Auto-Install in dryRun by Default

**Decision**: `mai_install` and `mai_remove` in `@agentsy/mcp` default to `dryRun: true`. Actual MCP client config mutation requires explicit two-step: agent calls `mai_install` (returns dry-run plan), then `/mcp-install` slash command surfaces user confirmation gate before calling `mai_install({ confirm: true })`.

**Evidence**: `@mcpmarket/mcp-auto-install v0.2.1` includes `dryRun` option precisely because MCP config file mutation is non-reversible. SEC-012: any tool mutating user MCP client config must require explicit confirmation.

**Rationale**: MCP server installation modifies persistent system configuration files (e.g., `~/.config/claude/mcp.json`). An agent that auto-installs without user awareness creates a supply-chain trust issue. The dry-run default + confirmation fence mirrors the `ask` approval mode applied to all other destructive operations in `@agentsy/runtime`.

---

### ADR-022: Superpowers Skills as Context-Activated, Not Always-On

**Decision**: `@agentsy/superpowers` skills are activated by context signals (presence of test files, diff context, open-ended planning intent) rather than being injected into every agent session's system prompt.

**Evidence**: obra/superpowers v5.0.7 README describes a "progressive activation" model. ADR-001/GUD-002: avoid over-injecting context; add only what the session needs. Always-on superpowers injection adds ~2000 tokens to every prompt unnecessarily.

**Rationale**: Context-based activation via `SuperpowersActivator.selectSkills(context)` injects only the subset relevant to the current task, preserving context window budget.

---

### ADR-023: Slash Commands Intercept Before Model, Not After

**Decision**: `SlashCommandRegistry` in `@agentsy/agent` intercepts `/`-prefixed user messages _before_ any model call. Matched commands execute directly, returning a synthetic assistant message. Unrecognized `/`-prefixed messages pass through unmodified.

**Evidence**: Claude Code SDK: custom commands in `.claude/commands/<name>.md` are resolved before the message is sent to the model. OpenClaw chat commands are intercepted by the gateway layer. Slash command semantics are fully deterministic — no LLM interpretation needed.

**Rationale**: Sending slash commands to the model creates non-deterministic behavior. Pre-model interception ensures `/new` always creates a new session, `/status` always returns metadata, etc. It also eliminates unnecessary LLM round-trips for operational commands.

---

### ADR-024: Connector Gateway as Pure Library (No Embedded Application)

**Decision**: `@agentsy/connectors` is a library providing `ConnectorGateway`, `ChannelAdapter`, `AgentSessionManager`, and three first-party adapter implementations. It includes no CLI binary, HTTP server, or persistent process manager.

**Evidence**: NanoClaw architecture: gateway logic isolated from host process. CON-010: channel adapter platform SDKs are peer dependencies.

**Rationale**: Embedding process management would conflict with the consumer's own deployment model (serverless, containers, desktop). The library exposes the minimal API surface; process management is the consumer's responsibility.

---

### ADR-025: Connector Inbound Messages Sanitized via Existing XML Pipeline

**Decision**: All inbound messages in `@agentsy/connectors` pass through `stripXmlContextTags` and `dedupeXmlContext` before being forwarded to the agent loop, reusing the existing pipeline.

**Evidence**: SEC-006: retrieved wiki content treated as untrusted; `<script>`, HTML injection, executable patterns stripped before injection. SEC-013: inbound connector message payloads are untrusted external input. The existing pipeline in `@agentsy/core/context` is already designed for untrusted LLM-generated XML — the same threat model applies.

**Rationale**: External chat messages (especially from public channels) are high-risk prompt injection vectors. Reusing the existing XML sanitization pipeline avoids a second code path and ensures consistent defense-in-depth.

---

### ADR-026: Code-as-Actions Execution Mode (CodeAgent Pattern)

**Decision**: `@agentsy/agent` SHOULD support a `mode: "code"` option where the LLM generates executable JS/TS code blocks instead of JSON tool call structures. A sandboxed executor runs the code and returns results as the next iteration's observation.

**Evidence**: SRC-11 (smolagents CodeAgent): code-as-actions reduces API calls by ~30% because multiple tool calls can be batched in a single code block and arithmetic/string operations happen in the executor without tool overhead. Executor backends: `local`, `e2b`, `docker`, `modal`, `blaxel`, `wasm`. The calling code is backend-agnostic.

**Rationale**: For data-heavy tasks (image processing, statistical analysis, report generation), JSON tool calls round-trip to the LLM for every operation. Code-as-actions batches operations and reduces total LLM calls. The executor abstraction ensures safe isolation.

---

### ADR-027: Skill Progressive Loading

**Decision**: `@agentsy/skills` MUST support runtime lazy loading of skill/tool definitions from markdown or TOML files. Skills are not compiled in — they are discovered and loaded on demand when the agent loop needs them.

**Evidence**: SRC-12 (DeerFlow): skills defined in markdown files loaded progressively. SRC-16 (OctoTools): Tool Cards loaded by the planner as needed. SRC-26 (gstack): 23 skill files, each a self-contained prompt with structured metadata. The pattern is consistent across 3+ frameworks.

**Rationale**: Including all tool definitions in the initial context wastes tokens. Progressive loading means only the tools the planner selects for the current task are included. This directly reduces per-turn token cost on large registries.

---

### ADR-028: Tool Card Metadata Schema

**Decision**: All tool registrations in `@agentsy/agent` MUST include a structured Tool Card with: `name`, `description`, `inputSchema`, `outputSchema`, `version`, `tags[]`, and optional `example_inputs[]`.

**Evidence**: SRC-16 (OctoTools): Tool Cards drive both planning (global planner reads descriptions) and execution (local executor reads schemas). Standardized metadata enables the selector to make principled inclusion/exclusion decisions.

**Rationale**: Ad-hoc tool descriptions (just a string) are insufficient for the parallel divided selector (ADR-032) to reason about tool overlap and coverage. Structured Tool Cards enable automated toolset optimization.

---

### ADR-029: Dual-Level Planning

**Decision**: For complex multi-step tasks, `@agentsy/agent` SHOULD support dual-level planning: a _global_ task plan produced once at task start (listing all major steps), plus a _per-step_ sub-plan produced before each tool invocation (detailing the immediate action).

**Evidence**: SRC-16 (OctoTools): global planner + local planner pattern. SRC-12 (DeerFlow): graph-level plan + node-level execution. The dual-level structure reduces hallucination on multi-step tasks by maintaining task-level context at each step without bloating a single prompt.

**Rationale**: Single-level planning forces the LLM to hold the entire task in context at every step. Dual-level amortizes this: the global plan is a short summary (5-10 items), the local plan focuses the LLM on the immediate action.

---

### ADR-030: Compiler-Driven Function Schema

**Decision**: All function/tool schemas used by `@agentsy/agent` MUST be generated at compile time from TypeScript types, not authored by hand as JSON objects.

**Evidence**: SRC-17 (Agentica): `typia.llm.application<IMyFunctions>()` generates the entire JSON schema from TypeScript types at compile time. Schema drift (code changes but schema not updated) is structurally impossible.

**Rationale**: Hand-authored JSON schemas diverge from code over time — a classic maintenance failure mode. Compiler-generated schemas guarantee schema-code alignment with no developer overhead.

---

### ADR-031: Validation Feedback Loop for Tool Arguments

**Decision**: When an LLM-generated tool call fails schema validation, `@agentsy/agent` MUST inject the structured validation errors as a tool response + system correction prompt and retry, up to `config.retry` attempts, before throwing.

**Evidence**: SRC-17 (Agentica `select.ts`): `emendMessages(failures)` produces: (1) an assistant message repeating the bad tool call, (2) a tool response containing the `typia` validation errors as JSON, (3) a system prompt "Correct it at the next function calling." The retry counter increments; `tool_choice` switches from `"auto"` to `"required"` on retry.

**Rationale**: LLMs reliably produce schema-conformant arguments when shown the specific violation rather than a generic "invalid input" error. The typia/zod validation output is machine-generated structured feedback — the highest-quality correction signal available.

---

### ADR-032: Parallel Divided Selection with Eliticism

**Decision**: When the tool registry exceeds 50 entries, `@agentsy/agent` MUST partition tools into domain groups and run one LLM selector per group in parallel (`Promise.all`), then run a final _eliticism pass_ — one more LLM selector call over the union of all selected tools from all groups — to produce the final selection.

**Evidence**: SRC-17 (Agentica `select.ts`): `ctx.operations.divided` triggers `Promise.all` across groups, each with an isolated `stack`. Eliticism guard: `if ELITICISM && stacks.some(s => s.length !== 0) → step(ctx, stacks.flat().map(...))`. See verbatim code in `agentsy-deep-dive-v2.md` §2.2.

**Rationale**: A single LLM call with 100+ tool descriptions exceeds most models' attention span for precise selection. Dividing reduces per-selector context 3-10x. Eliticism eliminates cross-group false positives by doing one final arbitration. Net: better precision + better recall vs naïve single call.

---

### ADR-033: DAG-Based Parallel Workflow Execution with Snapshot Recovery

**Decision**: Multi-step workflows in `@agentsy/agent` SHOULD be represented as a directed acyclic graph (DAG). Nodes without pending upstream dependencies execute in parallel. A `task_snapshot` POJO captures running state for pause/resume.

**Evidence**: SRC-15 (Eko v3.0+): `plan.ts` `Planner` generates XML workflow streamed to callback (`streamDone: false` for incremental UI). `chain.ts` `Chain` / `AgentChain` / `ToolChain` hierarchy is the audit trail. README: `task_snapshot` captures pending/running/completed nodes + tool results. `a2a.ts` + `replan.ts` for mid-workflow adjustments.

**Rationale**: Sequential execution of independent steps doubles or triples wall-clock time. Snapshot recovery enables long-horizon tasks to survive crashes, context resets, and human-in-the-loop pauses without restarting from scratch.

---

### ADR-034: Agent-to-Agent (A2A) Protocol Support

**Decision**: `@agentsy/runtime` SHOULD expose an A2A protocol endpoint. Agents can invoke other agents as tools via the A2A protocol, with scoped authentication tokens and isolated context boundaries.

**Evidence**: SRC-15 (Eko `a2a.ts`). SRC-14 (PocketFlow A2A). SRC-21 (OpenCrabs typed sub-agent roles). The A2A pattern is emerging as a cross-framework standard for agent composition.

**Rationale**: Direct package imports between agents create tight coupling. A2A protocol-based invocation allows agents to be independently deployed and versioned. Scoped tokens enforce least-privilege between agents.

---

### ADR-035: White-Box Editable Memory

**Decision**: `@agentsy/memory` MUST expose a white-box API: users (via UI or CLI) can read, create, update, and delete individual memory entries at runtime without restarting the agent loop.

**Evidence**: SRC-20 (LobeHub): memory entries displayed as editable key-value pairs. SRC-2 (nanobot): `memory lint` CLI command for inspecting and cleaning entries. GBrain (SRC-26): per-page trust tiers with explicit promote/demote.

**Rationale**: Black-box memory erodes user trust. Users who can see and correct what the agent remembers about them are more willing to engage with persistent memory features. White-box also enables debugging of memory-induced misbehavior.

---

### ADR-036: Branching Conversation Trees

**Decision**: `@agentsy/session` SHOULD support conversation branching: a conversation can be forked at any turn, the fork explored independently, and branches compared side-by-side. CRDT-based merge for reconnection.

**Evidence**: SRC-20 (LobeHub): branching conversation trees with CRDT merge. Enables A/B prompt testing within a single session. Design analogy: git branch/merge applied to conversation history.

**Rationale**: Users often want to explore "what if I had phrased this differently." Branching makes prompt engineering first-class UX rather than requiring the user to manually copy-paste conversation history.

---

### ADR-037: Sprint Lifecycle Skills Architecture

**Decision**: `@agentsy/skills` SHOULD include a stock set of sprint lifecycle skills following the gstack model: `office-hours`, `plan-eng-review`, `review`, `qa`, `ship`, with structured context-passing between skills via persistent files.

**Evidence**: SRC-26 (gstack): 23 skills forming a complete sprint lifecycle. Each skill reads prior skill output from a shared context file. `/office-hours` → `/plan-ceo-review` → `/plan-eng-review` → `/design-shotgun` → implementation → `/review` → `/qa` → `/ship`.

**Rationale**: Structuring the development workflow as a sequence of skill invocations with explicit context hand-offs produces higher-quality outputs than ad-hoc prompting. The explicit hand-off structure also makes the workflow auditable.

---

### ADR-038: Continuous Checkpoint Mode with WIP Commits

**Decision**: `@agentsy/agent` SHOULD support a `checkpoint_mode: "continuous"` option that auto-commits after each significant action with a `WIP:` prefix and a structured `[agentsy-context]` body capturing `decisions`, `remaining`, and `failed_approaches`. A `/context-restore` command reconstructs session state from these commits.

**Evidence**: SRC-26 (gstack): `checkpoint_mode` auto-commits with `[gstack-context]` structured body. `/context-restore` reads WIP commits to reconstruct prior context after crash. `/ship` filter-squashes WIP commits before PR creation.

**Rationale**: LLM context windows are ephemeral. WIP commits in git provide durable, zero-infrastructure session recovery. Filter-squashing before PR keeps `git bisect` and blame clean while preserving the recovery trail during active work.

---

### ADR-039: Simulation-Based Agent Testing with User Simulator and Judge

**Decision**: `@agentsy/agent` test infrastructure MUST support simulation-based scenario testing with three roles: (1) `UserSimulatorAgent` generating realistic user messages guided by scenario description, (2) `JudgeAgent(criteria=[...])` evaluating conversation quality at each turn, (3) optional `RedTeamAgent` for adversarial testing.

**Evidence**: SRC-27 (langwatch/scenario): `scenario.run(name, description, agents=[...], script=[...], max_turns=N)`. Hybrid script/autopilot: fixed messages at critical checkpoints, auto-generated turns between. `JudgeAgent` can trigger early termination on clear success/failure. `cache_key` for deterministic replay.

**Rationale**: Unit tests with hardcoded inputs test code, not agent behavior. Simulation tests with a LLM-powered user simulator test the full conversation dynamics including multi-turn coherence, context retention, and tool invocation correctness.

---

### ADR-040: pass^k Consistency Metric for Agent Test Suites

**Decision**: All agent scenario tests in `@agentsy/agent` MUST be run k ≥ 3 times. Test suites MUST report both average task completion rate and `pass^k = P(all k runs succeed)`. A regression where `pass^k` drops while average rate holds stable MUST surface as a CI failure.

**Evidence**: SRC-28 (awesome-ai-agent-testing): `pass^k` metric from tau-bench and Berkeley Function Calling Leaderboard. Agents with high average completion rate but low `pass^k` are unpredictable and unsuitable for production. The metric is the industry standard for evaluating agent reliability.

**Rationale**: Average success rate hides variance. An agent that succeeds 80% of the time but always fails the same 20% of tasks has `pass^3 = 0.512` (borderline). An agent that randomly fails 20% has `pass^3 = 0.512` too — but the predictable failure case is fundamentally worse for UX. Tracking both exposes the difference.

---

### ADR-041: Crescendo Multi-Turn Red Team Testing

**Decision**: `@agentsy/agent` security test suite MUST include Crescendo-style adversarial testing: a `RedTeamAgent` starts with benign requests and incrementally escalates across up to 50 turns toward a specified attack target, scoring each turn and backtracking on refusals.

**Evidence**: SRC-27 (langwatch/scenario): `RedTeamAgent.crescendo(target=..., model=..., total_turns=50)`. Per-turn scoring, refusal detection (agent refused, reduce escalation), backtracking (try alternative path). Industry standard for LLM safety evaluation.

**Rationale**: Point-in-time injection tests miss multi-turn manipulation patterns. Crescendo simulates how a sophisticated attacker builds up to a harmful request across a long conversation — the realistic threat model for production agents.

---

### ADR-042: RSI Feedback Ledger

**Decision**: `@agentsy/agent` SHOULD maintain a per-session RSI (Reinforcement Signal Index) feedback ledger: every tool execution outcome (success, failure, partial) is appended with structured context. The ledger is read by the selector to de-prioritize failing tools and avoid repeating known-bad approaches.

**Evidence**: SRC-21 (OpenCrabs): RSI feedback ledger with tool execution outcomes. Outcomes feed back into tool selection weight. Self-healing engine uses the ledger to identify and replace tools that have failed multiple times.

**Rationale**: Without feedback, an agent retrying the same failing tool wastes tokens and time. The ledger provides an intra-session learning signal without requiring model fine-tuning or cross-session persistence.

---

### ADR-043: Multi-Agent Debate with Confidence-Weighted Consensus

**Decision**: For high-stakes decisions (architecture reviews, security analysis), `@agentsy/agent` SHOULD support spawning N debate agents with different role prompts (advocate, critic, neutral), collecting their outputs, and aggregating via confidence-weighted consensus.

**Evidence**: SRC-21 (OpenCrabs): Bee Colony debate — multiple agents with different roles debate hypotheses. Confidence-weighted aggregation similar to ensemble ML methods. SRC-23 (Anthropic): parallelization workflow with voting/aggregation.

**Rationale**: Single-agent analysis is subject to anchoring and confirmation bias from the prompt framing. Multi-agent debate with diverse roles surfaces objections that a single agent would suppress. Confidence weighting reduces the impact of poorly-grounded positions.

---

### ADR-044: Shared Memory MCP for Multi-Agent Token Efficiency

**Decision**: In multi-agent `@agentsy` sessions, shared context MUST be stored once via a shared memory MCP server, referenced by ID. Agents receive delta updates rather than full context snapshots.

**Evidence**: SRC-24 (evalops/shared-memory-mcp): 6x token efficiency in collaborative coding tasks via context deduplication and delta updates. Each agent subscribes to a shared context channel; only diffs are transmitted.

**Rationale**: Naïve multi-agent coordination broadcasts the full context to every agent on every turn. For 10 agents with 100k token context, this is 10M tokens per turn. Shared memory + deltas reduces this to ~1M tokens (the base) + incremental diffs.

---

### ADR-045: Evaluator-Optimizer Workflow Pattern

**Decision**: For quality-sensitive generative tasks, `@agentsy/agent` SHOULD expose an evaluator-optimizer sub-pattern: generate candidate → evaluate against rubric → provide structured feedback → regenerate, up to `config.optimizerMaxIterations` cycles.

**Evidence**: SRC-23 (Anthropic "Building Effective Agents"): evaluator-optimizer as one of the five canonical agentic workflows. Demonstrated value in tasks like translation (evaluate naturalness), code generation (evaluate test pass rate), and content writing (evaluate against style guide).

**Rationale**: Single-shot generation quality is model-limited. Iterative evaluation and regeneration with structured feedback consistently improves output quality, especially for tasks with a clearly articulable quality criterion.

---

### ADR-046: State Dict Pattern for Cross-Step Large Object Passing

**Decision**: `@agentsy/agent` MUST implement a per-session `state` dictionary. Tool return values that are binary or large objects (images, DataFrames, audio, embeddings) are stored in `state` under a string key. Subsequent tool calls receive the string key as an argument and the framework resolves it to the actual object at call time, never serializing to JSON.

**Evidence**: SRC-11 (smolagents `_substitute_state_variables`): `self.state["image_1"] = AgentImage(bytes)`. Later: `tool_call(input="image_1")` → framework substitutes `self.state["image_1"]` before invoking the tool. ThreadPoolExecutor workers receive `copy_context()` so the state dict is accessible.

**Rationale**: Serializing a 5MB image to base64 JSON and back adds ~6.6MB of token overhead per round-trip. The state dict pattern keeps large objects in memory on the server side — tools receive opaque references.

---

### ADR-047: Pluggable Executor Architecture (IAgenticaExecutor Pattern)

**Decision**: The `createAgentLoop()` factory MUST accept an `executor` option conforming to an `IAgentExecutor` interface with optional step overrides: `initialize`, `select`, `call`, `describe`, `cancel`. Default implementations are pure functions. Passing `null` for any step disables it.

**Evidence**: SRC-17 (Agentica `execute.ts`): `export function execute(executor: Partial<IAgenticaExecutor> | null)`. Each step falls back to the default: `await (executor?.select ?? select)(ctx)`. Passing `{ describe: null }` disables description generation. Full code in `agentsy-deep-dive-v2.md` §2.2.

**Rationale**: This is the cleanest hexagonal architecture pattern seen across all 28 sources. Every step is independently testable and replaceable. Mock executors enable deterministic unit testing of agent logic without LLM calls.

---

### ADR-048: 12-Factor Agent Design Principles

**Decision**: `@agentsy/agent` architecture MUST conform to the 12-factor agent design principles: (1) stateless execution, (2) externalized configuration, (3) declared dependencies, (4) environment parity, (5) structured telemetry, (6) explicit session boundaries, (7) idempotent tool calls, (8) graceful degradation, (9) fail-fast validation, (10) observable context, (11) versioned schemas, (12) reproducible runs.

**Evidence**: SRC-25 (agenticloops-ai/agentic-ai-engineering): 6-module curriculum covering foundations to production; 12-factor agents chapter. Analogy to 12-factor app (Heroku) applied to agent systems.

**Rationale**: Agents that violate these principles are hard to test, debug, and operate in production. Stateful execution makes parallel testing impossible. Non-externalized configuration prevents environment parity. Non-reproducible runs make `pass^k` measurement meaningless.

---

### ADR-049: Design Taste Memory with Temporal Decay

**Decision**: `@agentsy/skills` design review workflow SHOULD maintain a per-project taste profile: approval/rejection signals from design reviews are recorded with timestamps and decay 5% per week. New design generation uses the profile to bias toward confirmed preferences.

**Evidence**: SRC-26 (gstack `gstack-taste-update`): taste profile per project, 5%/week decay, feeds into `design-shotgun` generation. The temporal decay prevents stale preferences from dominating (e.g., a style approved 6 months ago when the product direction was different).

**Rationale**: Design quality is contextual and temporal. A pure accumulation of preferences without decay leads to stale bias. The decay constant ensures only recent (~last 3 months at 5%/week) preferences significantly influence generation.

---

### ADR-050: LLM-as-Judge Evaluation at Every Turn

**Decision**: `@agentsy/agent` SHOULD support a `JudgeAgent(criteria: string[])` that evaluates agent responses against a rubric at each conversation turn, emitting a `JudgeEvent` with score and verdict. Enable early termination on clear success or failure.

**Evidence**: SRC-27 (langwatch/scenario): `JudgeAgent(criteria=["answered correctly", "used the tool", "did not hallucinate"])` evaluates each turn. Early termination reduces token cost 40-60% on test runs. Used in both production quality monitoring and test scenarios.

**Rationale**: End-of-conversation evaluation misses turn-level quality signals and allows low-quality intermediate steps to continue consuming tokens. Per-turn evaluation enables both early termination (cost reduction) and fine-grained quality metrics.

---

## 3. Cross-Cutting Patterns (Consensus ≥ 3 Projects)

| Pattern                                   | Sources             | Priority | Maps To               |
| ----------------------------------------- | ------------------- | -------- | --------------------- |
| Lazy session creation                     | SRC-2, SRC-4, SRC-3 | HIGH     | P7 TASK-P7-003        |
| User message written before tool exec     | SRC-1, SRC-2        | HIGH     | P7 TASK-P7-004        |
| Stop conditions as predicates             | SRC-7, SRC-8, SRC-1 | HIGH     | P2, agent/stopConds   |
| Lazy assistant message creation           | SRC-8, SRC-1, SRC-4 | HIGH     | P5 LLMStreamProcessor |
| Chunk recording/replay for tests          | SRC-8, SRC-1        | HIGH     | P0 test infra         |
| Warning-first guardrails                  | SRC-3, SRC-1        | HIGH     | P2 TASK-P2-003        |
| WebSocket idle timeout                    | SRC-4, SRC-5        | HIGH     | P8 TASK-P8-003        |
| Atomic session writes + auto-repair       | SRC-2, SRC-1        | HIGH     | P7 TASK-P7-003        |
| Allow-rules beat deny-rules (specificity) | SRC-2, SRC-1        | HIGH     | P6 TASK-P6-002        |
| Two-stage memory (compact → synthesize)   | SRC-2, SRC-1, SRC-3 | HIGH     | X5 memory lifecycle   |
| Approval as pauseable loop                | SRC-7, SRC-6, SRC-1 | HIGH     | P6 TASK-P6-003        |
| Context compression skips active calls    | SRC-2, SRC-1        | HIGH     | P3 TASK-P3-004        |
| prepareStep per-step reconfiguration      | SRC-7               | HIGH     | P0 TASK-P0-005        |
| mergeCallbacks (both levels fire)         | SRC-7               | HIGH     | P2 utils              |
| repairToolCall hook                       | SRC-7               | HIGH     | P5 ToolExecutor       |
| Per-message state Map                     | SRC-8, SRC-1        | HIGH     | P5 processor          |
| TOOL_CALL_END dual role                   | SRC-8               | HIGH     | ag-ui converters      |
| MESSAGES_SNAPSHOT for resume              | SRC-8               | MEDIUM   | P7 session resume     |
| areAllToolsComplete() predicate           | SRC-8               | MEDIUM   | P2 auto-continuation  |
| ChunkStrategy interface                   | SRC-8               | MEDIUM   | P5 StreamingOutput    |
| FTS5 alongside vector RAG                 | SRC-3               | MEDIUM   | X6 retrieval          |
| ACP alongside MCP                         | SRC-3, SRC-5        | MEDIUM   | P8 MCPOrchestrator    |
| Remote skill/plugin URL loading           | SRC-4, SRC-1        | MEDIUM   | X3, X4                |
| Named/registered subagents                | SRC-6               | MEDIUM   | P10                   |
| Feature flag compile-time DCE             | SRC-1               | LOW      | tsup tree-shaking     |
| GitStore for wiki version history         | SRC-2               | LOW      | post-v0.3.0           |

---

## 4. Open Questions

| ID   | Question                                                                                 | Status        | Notes                                                   |
| ---- | ---------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------- |
| OQ-1 | Should `@agentsy/retrieval` expose FTS5 as first-class API in v0.3.0 or post-v0.3.0?     | Deferred      | libSQL supports it, but scope concern; X6 post-release  |
| OQ-2 | ACP SDK — is there a stable npm package yet?                                             | Monitoring    | Neither Hermes nor Gemini CLI has published ACP npm pkg |
| OQ-3 | Should `WikiStore` maintain a git repo for version history in v0.3.0?                    | Deferred      | Adds git dep; post-v0.3.0 (see ALT-003 in synthesis)    |
| OQ-4 | Is `isolated-vm` (Node 24+) needed for any agentsy core package?                         | No for v0.3.0 | TanStack ai-code-mode uses it; agentsy core does not    |
| OQ-5 | Should `createAgentLoop` expose `.generate()` + `.stream()` as methods (Vercel pattern)? | Open          | Factory returns object with methods; see ADR in tech.md |
| OQ-6 | Plan agent mode (`read-only deny-all-writes`) — implement in v0.3.0 or defer?            | Open          | OpenCode precedent; low-effort addition to ApprovalMode |

---

## 5. Alternatives Considered

- **ALT-001**: Apply findings as additive tasks in existing plan (chosen). Alternative: new phases. Rejected — plan phase structure is correct.
- **ALT-002**: FTS5 in v0.3.0. Rejected — deferred to X6 post-release.
- **ALT-003**: Full nanobot GitStore for wiki versioning in v0.3.0. Rejected — adds git runtime dependency.
- **ALT-004**: `ToolLoopAgent` class pattern (Vercel). Deferred — factory function idiomatic for ESM.
- **ALT-005**: Verbatim TanStack `ChunkStrategy` API name. Reconsidered — equivalent interface with agentsy naming conventions.

---

## 6. Dependencies

- **DEP-001**: libSQL FTS5 — built-in, no extra dep.
- **DEP-002**: ACP SDK — monitor; add as optional peer dep when available on npm.
- **DEP-003**: `@ai-sdk/provider-utils` — reference only, not imported.
- **DEP-004**: `isolated-vm` — not needed in agentsy core (Node 22; requires Node 24).

---

## 7. Files

- **FILE-001**: `plan/agentsy-platform-v2.md` — master plan (read-only reference for this doc)
- **FILE-002**: `plan/agentsy-deep-dive-v1.md` — detailed synthesis with code snippets

---

## 8. Related Specifications / Further Reading

- [Claude Code v2.1.88 Source](https://github.com/chauncygu/collection-claude-code-source-code) — tool interface predicates, session persistence, DCE
- [nanobot memory.md](https://github.com/HKUDS/nanobot/blob/main/docs/memory.md) — Consolidator→Dream, cursor-JSONL, GitStore, Dream config
- [Hermes Agent README](https://github.com/NousResearch/hermes-agent/blob/main/README.md) — closed learning loop, FTS5, ACP, warning-first
- [codex-rs README](https://github.com/openai/codex/blob/main/codex-rs/README.md) — sandbox modes, crate separation, WebSocket timeout
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) — 3 release channels, ACP mode, memory-tests/perf-tests
- [OpenCode](https://github.com/anomalyco/opencode) — plan agent, @general subagent, client/server separation
- [vercel/ai tool-loop-agent.ts](https://github.com/vercel/ai/blob/main/packages/ai/src/agent/tool-loop-agent.ts)
- [vercel/ai stop-condition.ts](https://github.com/vercel/ai/blob/main/packages/ai/src/generate-text/stop-condition.ts)
- [TanStack AI processor.ts](https://github.com/TanStack/ai/blob/main/packages/typescript/ai/src/activities/chat/stream/processor.ts)
- [TanStack AI agent-loop-strategies.ts](https://github.com/TanStack/ai/blob/main/packages/typescript/ai/src/activities/chat/agent-loop-strategies.ts)
