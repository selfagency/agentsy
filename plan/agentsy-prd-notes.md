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

| ID    | Project          | Version Analyzed | Primary Source URL                                                                                        | Key Contribution                                 |
| ----- | ---------------- | ---------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| SRC-1 | Claude Code      | v2.1.88          | <https://github.com/chauncygu/collection-claude-code-source-code>                                         | 12 harness mechanisms, tool interface, DCE       |
| SRC-2 | nanobot          | HEAD 2026-04-19  | <https://github.com/HKUDS/nanobot>                                                                        | 2-stage memory, cursor-JSONL, atomic writes      |
| SRC-3 | Hermes Agent     | HEAD             | <https://github.com/NousResearch/hermes-agent>                                                            | Closed learning loop, FTS5, warning guardrails   |
| SRC-4 | OpenAI Codex     | codex-rs HEAD    | <https://github.com/openai/codex/blob/main/codex-rs/README.md>                                            | Sandbox modes, WebSocket timeout, thread store   |
| SRC-5 | Gemini CLI       | HEAD             | <https://github.com/google-gemini/gemini-cli>                                                             | 3 release channels, ACP, conversation checkpoint |
| SRC-6 | OpenCode         | v1.14.33         | <https://github.com/anomalyco/opencode>                                                                   | Plan agent, named subagents, client/server split |
| SRC-7 | vercel/ai        | HEAD             | <https://github.com/vercel/ai/blob/main/packages/ai/src/agent/tool-loop-agent.ts>                         | StopCondition, prepareStep, mergeCallbacks       |
| SRC-8 | TanStack AI      | HEAD             | <https://github.com/TanStack/ai/blob/main/packages/typescript/ai/src/activities/chat/stream/processor.ts> | StreamProcessor state machine, ChunkStrategy     |
| SRC-9 | nano-claude-code | v3.0             | <https://github.com/chauncygu/collection-claude-code-source-code/blob/main/README.MD>                     | Minimal tool registry, context injection only    |

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
- **FILE-002**: `plan/deep-dive-synthesis-v1.md` — detailed synthesis with code snippets

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
