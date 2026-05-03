---
goal: 'Deep dive synthesis — 9 reference codebase architectural findings and plan enrichment mapping'
version: '1.1'
date_created: '2026-05-02'
last_updated: '2026-05-02'
owner: 'selfagency'
status: 'Completed'
tags: ['research', 'architecture', 'memory', 'agent-loop', 'safety', 'streaming', 'ui-messages']
---

# Deep Dive Synthesis — Reference Codebase Architectural Findings

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Nine reference codebases were studied to extract production-validated architectural patterns for the agentsy platform plan. This document records the highest-signal findings and maps each to the relevant phase in [plan/agentsy-platform-v1.md](./agentsy-platform-v1.md).

---

## 1. Requirements & Constraints

- **REQ-001**: All findings must be mapped to a specific plan phase and task ID.
- **REQ-002**: New findings that warrant plan changes must be classified HIGH / MEDIUM / LOW priority.
- **REQ-003**: Findings that are out-of-scope for v0.3.0 are recorded in Section 5 (Future Roadmap) only.
- **CON-001**: This document is read-only reference material. Implementation tasks live in `agentsy-platform-v1.md`.

---

## 2. Implementation Steps

### Phase 1 — Source Analysis

- **GOAL-001**: Complete analysis of all 7 reference codebases and map findings to plan tasks.

| Task     | Description                                 | Completed | Date       |
| -------- | ------------------------------------------- | --------- | ---------- |
| TASK-001 | Claude Code v2.1.88 source analysis         | ✅        | 2026-05-02 |
| TASK-002 | nanobot memory.md deep dive                 | ✅        | 2026-05-02 |
| TASK-003 | Hermes Agent README + directory analysis    | ✅        | 2026-05-02 |
| TASK-004 | OpenAI Codex (`codex-rs`) crate inventory   | ✅        | 2026-05-02 |
| TASK-005 | Gemini CLI changelog + structure analysis   | ✅        | 2026-05-02 |
| TASK-006 | OpenCode v1.14.33 architecture review       | ✅        | 2026-05-02 |
| TASK-007 | nano-claude-code v3.0 module-level analysis | ✅        | 2026-05-02 |
| TASK-008 | `vercel/ai` SDK architecture review         | ✅        | 2026-05-02 |
| TASK-009 | `TanStack/ai` SDK architecture review       | ✅        | 2026-05-02 |

### Phase 2 — Plan Enrichment Patches

- **GOAL-002**: Apply targeted patches to `agentsy-platform-v1.md` for HIGH-priority findings.

| Task     | Description                                                                                               | Completed | Date |
| -------- | --------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-008 | P7: Add atomic write + lazy session + early user-message persistence sub-tasks                            |           |      |
| TASK-009 | P6: Add `allow_patterns` priority rule + warning-first guardrails to RiskClassifier                       |           |      |
| TASK-010 | P3: Add auto-compact skips active tasks constraint to ContextManager                                      |           |      |
| TASK-011 | P9: Add `plan` mode (read-only agent) as 4th approval mode                                                |           |      |
| TASK-012 | X1: Add `isConcurrencySafe` / `isReadOnly` / `isDestructive` / `interruptBehavior` to tool interface      |           |      |
| TASK-013 | P8: Add ACP reference + WebSocket idle timeout to MCPOrchestrator                                         |           |      |
| TASK-014 | X5: Align MemoryLifecycle with nanobot two-stage flow (Consolidator → Dream)                              |           |      |
| TASK-015 | P12: Add three release channels (preview/stable/nightly) and perf test dirs                               |           |      |
| TASK-016 | P0/P2: Add `prepareStep` callback to `AgentLoopOptions` for per-step model/tool reconfiguration           |           |      |
| TASK-017 | P5: Add `repairToolCall` hook to `ToolExecutor` for malformed LLM tool-call recovery                      |           |      |
| TASK-018 | P5: Lazy `UIMessage` creation in `LLMStreamProcessor` — no message until first content chunk arrives      |           |      |
| TASK-019 | P0: Chunk recording/replay fixture pattern in `StreamProcessor` for deterministic edge-case tests         |           |      |
| TASK-020 | P2: `mergeCallbacks` utility — settings-level + call-level lifecycle callbacks must both fire (no shadow) |           |      |

---

## 3. Findings by Codebase

### 3.1 Claude Code v2.1.88 (`chauncygu/collection-claude-code-source-code`)

**Source**: decompiled `@anthropic-ai/claude-code@2.1.88` npm package (~163K LOC, ~512K lines with tests/docs).

#### 3.1.1 The 12 Progressive Harness Mechanisms

The source analysis README enumerates exactly 12 layered mechanisms needed beyond the bare agent loop. These map directly to agentsy phases:

| Mechanism               | Claude Code module                               | agentsy phase                |
| ----------------------- | ------------------------------------------------ | ---------------------------- |
| s01 THE LOOP            | `query.ts` while-true loop                       | P0 (agent loop baseline)     |
| s02 TOOL DISPATCH       | `Tool.ts` + `tools.ts` registry                  | P0 (type contracts)          |
| s03 PLANNING            | `EnterPlanModeTool` + `TodoWriteTool`            | **P9 (new: plan mode)**      |
| s04 SUB-AGENTS          | `AgentTool` + `forkSubagent.ts`                  | P10                          |
| s05 KNOWLEDGE ON DEMAND | `SkillTool` + `memdir/` lazy-inject              | X3                           |
| s06 CONTEXT COMPRESSION | `services/compact/` three strategies             | P3                           |
| s07 PERSISTENT TASKS    | `TaskCreate/Update/Get/List`                     | **future: task graph**       |
| s08 BACKGROUND TASKS    | `DreamTask` + `LocalShellTask`                   | **future: background tasks** |
| s09 AGENT TEAMS         | `TeamCreate/Delete` + `InProcessTeammateTask`    | P10 + **future: teams**      |
| s10 TEAM PROTOCOLS      | `SendMessageTool` request-response               | P10                          |
| s11 AUTONOMOUS AGENTS   | `coordinator/coordinatorMode.ts` idle+auto-claim | **future: coordinator**      |
| s12 WORKTREE ISOLATION  | `EnterWorktreeTool` / `ExitWorktreeTool`         | **future: worktree**         |

**Key insight**: agentsy plan covers s01–s06 + s09/s10 in v0.3.0. s07–s08 and s11–s12 are post-v0.3.0.

#### 3.1.2 Tool Interface Capabilities (`Tool.ts`)

Every Claude Code tool implements these predicate methods beyond `call()`:

```typescript
isConcurrencySafe(): boolean   // can run in parallel with other tools?
isReadOnly(): boolean          // no side effects?
isDestructive(): boolean       // irreversible operations?
interruptBehavior(): 'cancel' | 'block'  // cancel in-flight or block on user interrupt?
```

**Plan gap**: `TASK-P0-002` defines `HookEvent` but the tool interface in `src/tool-calls/` does not expose these predicates. The `ToolExecutor` (P5) needs them to decide parallel vs serial execution.

**→ HIGH priority**: Add these four predicates to the tool interface type in `src/types/` and use them in `ToolExecutor.executeAll()`.

#### 3.1.3 Session Persistence Strategy

From the `SESSION PERSISTENCE` section of the source analysis:

```text
├─ User messages  → await write (blocking, for crash recovery)
├─ Assistant msgs → fire-and-forget (order-preserving queue)
├─ Progress       → inline write (dedup on next query)
└─ Flush          → on result yield / cowork eager flush
```

**→ HIGH priority** (maps to P7): `FileSystemSessionStore` must use **blocking await** for user messages and fire-and-forget queue for assistant messages — not uniform async writes.

#### 3.1.4 Context Compression Architecture

Three strategies (not one):

1. `autoCompact` — summarize oldest messages via compact API call when token count exceeds threshold
2. `snipCompact` — removes zombie messages and stale markers (HISTORY_SNIP feature flag)
3. `contextCollapse` — restructures context for efficiency (CONTEXT_COLLAPSE feature flag)

The split point: `getMessagesAfterCompactBoundary()` — returns only messages after the last `compact_boundary` system marker. Older messages are replaced by the compact summary; they do not persist verbatim in the live message array.

**→ MEDIUM priority** (maps to P3): `compressConversation()` must insert a `{ type: 'system', subtype: 'compact_boundary' }` marker into the message array. Resume (`FileSystemSessionStore`) must call `getMessagesAfterCompactBoundary()` during reconstruction to apply the same boundary logic.

#### 3.1.5 Permission System Flow

Five-stage pipeline:

1. `validateInput()` — reject bad args before any permission check
2. `PreToolUse Hooks` — user-defined shell commands; can approve, deny, or modify input
3. `Permission Rules` — alwaysAllowRules / alwaysDenyRules / alwaysAskRules from settings
4. `Interactive Prompt` — fallback: show tool name + input, user decides
5. `checkPermissions()` — tool-specific logic (e.g., path sandboxing)

The hook stage fires **before** the rule-matching stage — hooks can short-circuit rule evaluation entirely.

**→ MEDIUM priority** (maps to P6): `ApprovalEngine` must dispatch `PreToolUse` hooks **before** consulting the policy list. Current plan has hooks in X2 and approval in P6 but does not specify this ordering.

#### 3.1.6 Sub-Agent Spawn Modes

Four modes (not two):

- `default` → in-process, shared conversation state
- `fork` → child process, fresh `messages[]`, shared file cache
- `worktree` → isolated git worktree + fork
- `remote` → bridge to Claude Code Remote / container

**→ MEDIUM priority** (maps to P10): `SubagentRunner` should expose `spawnMode: 'default' | 'fork' | 'worktree' | 'remote'`. v0.3.0 implements `default` and `fork`; `worktree` and `remote` are post-v0.3.0.

#### 3.1.7 Key Design Patterns (Reference Table)

| Pattern                                             | Module               | Apply in agentsy                                   |
| --------------------------------------------------- | -------------------- | -------------------------------------------------- |
| `AsyncLocalStorage` for per-agent context isolation | `utils/`             | P10: SubagentRunner context isolation              |
| Ring buffer for error log (bounded memory)          | `utils/`             | P11: structuredLogger bounded buffer               |
| `lazySchema()` — defer Zod schema evaluation        | `Tool.ts`            | P6: defer approval policy Zod schemas              |
| Fire-and-forget write with order-preserving queue   | `recordTranscript()` | P7: assistant message writes                       |
| `feature()` compile-time DCE                        | Bun bundler          | **tsup conditional exports** for optional features |

#### 3.1.8 Feature Flag / DCE Architecture

```text
feature('FLAG_NAME') → true  → included in bundle
feature('FLAG_NAME') → false → dead-code-eliminated
```

Claude Code uses this to gate: DAEMON, VOICE_MODE, COORDINATOR_MODE, HISTORY_SNIP, CONTEXT_COLLAPSE, KAIROS, PROACTIVE, and 15+ others. The published npm package has 108 internal modules stripped out entirely via DCE.

**→ LOW priority** (no v0.3.0 action): tsup + tree-shaking handles this naturally via optional peer deps and dynamic imports. Document the pattern in `docs/architecture.md` (TASK-R2-003) for downstream consumers who want to gate heavy features.

---

### 3.2 nanobot (`HKUDS/nanobot`) — Memory Architecture

**Source**: `docs/memory.md` (canonical memory design doc, 189 lines).

#### 3.2.1 Two-Stage Memory Flow

nanobot's memory design directly validates and refines the agentsy Layer 0/1 design:

```text
Stage 1: Consolidator
  messages[] grows → Consolidator → summarize oldest safe slice
    → append summary to memory/history.jsonl
    (cursor-based, append-only, machine-first format)

Stage 2: Dream
  Dream reads: history.jsonl + SOUL.md + USER.md + MEMORY.md
  → surgical edits to long-term files (not full rewrites)
  → runs on cron schedule (intervalH) + manual trigger /dream
  → GitStore records each change (auditable, restorable)
```

This maps to agentsy architecture as:

- **Stage 1 = ContextManager auto-compact** (P3) feeding into **RawEventLog** (X5 TASK-X5-003)
- **Stage 2 = MemoryLifecycle.endTask() wiki synthesis** (X5 TASK-X5-006)
- **GitStore = WikiStore version history** — **not in current plan**

**→ HIGH priority** (maps to X5): `WikiStore` should maintain a git-tracked change history of long-term wiki files. After each `endTask()` synthesis pass, commit the diff to a local git repo at `~/.agentsy/memory/wiki/.git/`. Expose `/dream-log` and `/dream-restore` equivalent operations.

**→ HIGH priority** (maps to X5): The `history.jsonl` cursor pattern is superior to the current plan's raw event log design. `RawEventLog` should use an explicit `.cursor` file to track the Consolidator's read position. The `MemoryLifecycle` should track a separate `.dream_cursor` for the Dream/synthesis pass.

#### 3.2.2 Memory File Roles

```text
SOUL.md      → bot voice/personality/communication style
USER.md      → stable knowledge about the user
MEMORY.md    → project facts, decisions, durable context
history.jsonl → append-only compressed summaries (machine-first)
```

This four-file structure maps cleanly onto agentsy's `WikiStore` category directories:

- `entities/` → USER.md role
- `concepts/` → MEMORY.md role
- `synthesis/` → SOUL.md + cross-cutting summaries
- `sources/` → raw source citations

**→ MEDIUM priority** (maps to X5 TASK-X5-004): `WikiStore` should expose these four semantic "well-known" page slots as first-class named accessors alongside the general category directories.

#### 3.2.3 Dream Configuration

```json
{
  "dream": {
    "intervalH": 2,
    "modelOverride": null,
    "maxBatchSize": 20,
    "maxIterations": 10
  }
}
```

- `intervalH` = how often Dream runs (hours); internally uses `every` schedule, not cron
- `modelOverride` = optional separate model for synthesis (e.g., cheaper/faster model)
- `maxBatchSize` = how many history.jsonl entries processed per run
- `maxIterations` = tool budget for the Dream editing phase (safety ceiling)

**→ MEDIUM priority** (maps to X5 `MemoryLifecycle` options): Add `synthesisIntervalHours`, `synthesisModelOverride`, `maxBatchSize`, `maxSynthesisIterations` to `MemoryLifecycle` constructor options.

---

### 3.3 Hermes Agent (`NousResearch/hermes-agent`)

**Source**: README.md (180 lines), directory tree analysis.

#### 3.3.1 Closed Learning Loop Definition

The Hermes value proposition statement (exact quote from README):

> "A closed learning loop — Agent-curated memory with periodic nudges. Autonomous skill creation after complex tasks. Skills self-improve during use. FTS5 session search with LLM summarization for cross-session recall. Honcho dialectic user modeling."

This directly validates the agentsy MemoryLifecycle design. Key elements not yet in the plan:

- **"periodic nudges"** = the `intervalH` cron trigger (nanobot Dream pattern)
- **"autonomous skill creation after complex tasks"** = `endTask()` should offer to create a new skill file when a novel multi-step pattern is identified
- **"FTS5 session search"** = full-text search over `history.jsonl` for cross-session recall (complement to vector RAG)

**→ MEDIUM priority** (maps to X5/X6): Add FTS5 full-text search over `RawEventLog` as a complementary retrieval path alongside vector RAG. Use libSQL's built-in FTS5 support (no extra dependency).

#### 3.3.2 Terminal Backends (Six)

Hermes supports: `local`, `Docker`, `SSH`, `Daytona`, `Singularity`, `Modal`.

Daytona and Modal provide **serverless persistence**: environment hibernates when idle, wakes on demand. This is the "lives where you do" capability.

**→ LOW priority** (post-v0.3.0): Not relevant for the agentsy library itself but important for the downstream consumer app design. Reference in `docs/downstream-app-starter.md` (TASK-R4-001).

#### 3.3.3 Tool Loop Guardrails: Warning-First

Recent Hermes commit: `fix(agent): make tool loop guardrails warning-first`.

Before this fix, exceeding the tool loop limit was an immediate error. After: emit a warning event, continue for one more turn, then error on the second violation. This prevents hard failures from LLM behavior variability.

**→ HIGH priority** (maps to P6): `createAgentLoop.ts` loop detection (currently `TASK-P2-003` emits `LoopDetected`) should emit a **warning** first (allow one more step), then a hard `LoopExceeded` error on the second consecutive detection.

#### 3.3.4 ACP (Agent Communication Protocol)

Hermes has `acp_adapter/` and `acp_registry/` directories. This is the same ACP that Gemini CLI added recently (`fix(acp): resolve agent mode disconnect`).

ACP appears to be an emerging inter-agent communication standard alongside MCP. MCP is tool-server protocol; ACP is agent-to-agent message protocol.

**→ MEDIUM priority** (maps to P8): Reference ACP in `MCPOrchestrator` documentation. Add to Section 8 (Related Specs) of the plan.

---

### 3.4 OpenAI Codex (`codex-rs`)

**Source**: `codex-rs/` directory tree, `codex-rs/README.md`.

#### 3.4.1 Crate Architecture (Reference for agentsy module separation)

```text
core/      → business logic library crate (reusable, not CLI-specific)
exec/      → headless CLI for automation (codex exec PROMPT)
tui/       → fullscreen TUI (Ratatui)
cli/       → multitool dispatcher (routes to exec or tui)
```

This maps to agentsy's intended separation:

- `core/` = `@selfagency/agentsy` (this library)
- `exec/` = headless automation consumer
- `tui/` = downstream CLI app with renderers

The separation is validated: Codex explicitly describes `core` as "ultimately, we hope this becomes a library crate that is generally useful for building other Rust/native applications."

#### 3.4.2 Sandbox Modes

Three codex sandbox modes map cleanly to agentsy's `SandboxMode`:

```text
read-only        → no writes allowed (default)
workspace-write  → writes within current workspace only; ~/.codex/memories also writable
danger-full-access → no sandboxing (container/CI use only)
```

The `workspace-write` mode automatically includes the memories directory in writable roots — this means memory maintenance does not require a separate approval.

**→ HIGH priority** (maps to P6 TASK-P6-005): `SandboxMode.process` should map to `workspace-write` semantics (allow writes within workspace + `~/.agentsy/memory/`). Explicitly document that memory writes are always permitted in `process` sandbox mode.

#### 3.4.3 WebSocket Idle Timeout

Recent commit: `Bound websocket request sends with idle timeout (#20751)` — merged 17 hours before analysis.

Long-running agent sessions that sit idle between tool calls can leave WebSocket connections open indefinitely. The fix bounds all WebSocket request sends with an idle timeout.

**→ HIGH priority** (maps to P8 TASK-P8-003): `MCPOrchestrator` must implement idle timeout on all WebSocket-transport MCP connections. Add `connectionIdleTimeoutMs?: number` (default: `30_000`) to `MCPServerConfig`.

#### 3.4.4 Thread Store (Session Store)

`thread-store` crate: **process-scoped** — sessions are scoped to the process lifecycle, not global. Recent: `Make thread store process-scoped (#19474)`.

This prevents cross-contamination between concurrent agent processes sharing the same session storage directory.

**→ HIGH priority** (maps to P7): `FileSystemSessionStore` must scope session IDs with a process-specific prefix (e.g., `<pid>-<sessionId>`) or use file locking to prevent concurrent process cross-contamination.

#### 3.4.5 Remote Plugin Skill Read API

Latest SDK commit: `Add remote plugin skill read API (#20150)` — plugins/skills can now be read from a remote URL, not just local filesystem.

This applies to both `sdk/python` and `sdk/typescript` directories.

**→ MEDIUM priority** (maps to X3 + X4): `SkillLoader` and `PluginLoader` should support HTTP(S) URLs in addition to local paths. Add `remoteUrl?: string` to `SkillManifest` and `PluginManifest`. Implement with `fetch()` + checksum verification.

#### 3.4.6 Key Codex Crates (Additional Context)

| Crate                              | Description                                        | agentsy mapping                           |
| ---------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| `agent-graph-store`                | Agent graph state interface                        | future: multi-agent coordinator graph     |
| `apply-patch`                      | Stateful streaming apply_patch parser              | future: patch tool                        |
| `core-skills`                      | Built-in skill descriptions (separate from plugin) | X3: built-in skills vs user skills        |
| `execpolicy` + `execpolicy-legacy` | Execution policy engine                            | P6: RiskClassifier                        |
| `responses-api-proxy`              | Proxy for OpenAI Responses API                     | P1: openaiResponses wiring                |
| `memories`                         | `feat: seed ad-hoc memory extension instructions`  | X5: instruction seeding for memory engine |

---

### 3.5 Gemini CLI (`google-gemini/gemini-cli`)

**Source**: changelog and directory analysis (previous session).

#### 3.5.1 Three Release Channels (Exact Specification)

```text
preview  → weekly, Tuesday UTC 23:59
stable   → weekly, Tuesday UTC 20:00 (= previous week's preview promoted)
nightly  → daily, UTC 00:00
```

**→ HIGH priority** (maps to P12 TASK-P12-004/005): Adopt this exact cadence for agentsy:

- `nightly` dist-tag: daily automated publish from `develop` branch
- `preview` dist-tag: weekly from `develop` (Tuesday UTC)
- `latest` dist-tag: weekly from `main` (Tuesday UTC, after preview validation)

#### 3.5.2 Test Directory Structure

Gemini CLI has `memory-tests/` and `perf-tests/` as top-level test directories (separate from unit tests).

Plan already references this in TASK-P12-003. Confirmed pattern: memory tests are integration tests that test the full memory lifecycle end-to-end; perf tests assert against SLOs programmatically.

#### 3.5.3 ACP Mode

Recent commit: `fix(acp): resolve agent mode disconnect and improve mode awareness`.

Gemini CLI added ACP alongside MCP. "Mode awareness" = the agent knows which protocol is active for a given connection and adjusts its behavior accordingly.

**→ MEDIUM priority** (cross-references 3.3.4): ACP is confirmed as a real, shipping standard by two independent major projects. Add `acpEnabled?: boolean` flag to `MCPOrchestrator` options for future ACP support.

---

### 3.6 OpenCode (`anomalyco/opencode`)

**Source**: v1.14.33 changelog and architecture analysis (previous session).

#### 3.6.1 Two Built-in Agents

- `build` — full-access default agent
- `plan` — read-only agent: denies all file edits, requires explicit permission before bash

The `plan` agent is invokable by the user as a mode switch, not spawned programmatically.

**→ HIGH priority** (maps to P9 + P0 `TASK-P0-007`): The `ApprovalMode` union should include `'plan'` as a distinct mode meaning "read-only analysis only — deny all write/exec tools automatically." This is different from `'ask'` (prompts user) and `'deny'` (hard deny); `'plan'` specifically denies writes/exec while allowing reads.

#### 3.6.2 `@general` Subagent

`@general` is a general-purpose subagent invokable by name from within conversations. It can be triggered from message content (e.g., user types `@general help me with X`). It's not spawned programmatically by the parent loop — it's a named, registered agent that the message router dispatches to.

**→ MEDIUM priority** (maps to P10): `SubagentCoordinator` should support named/registered subagents that can be addressed by name in tool call arguments, not just spawned ad-hoc per task.

---

### 3.7 nano-claude-code v3.0

**Source**: `collection-claude-code-source-code` README, project structure table.

#### 3.7.1 Tool Registry as Extension Point

`tool_registry.py` (~98 lines) = central registry with a plugin entry point. Custom tools register via this single file. This is the simplest possible extensibility surface.

The 18 built-in tools cover memory (4), agent orchestration (5), skills (2), plus standard file/web/exec. This is a reference for the minimal built-in tool surface for agentsy.

#### 3.7.2 Multi-provider Architecture

nano-claude-code supports 10+ providers via a single `providers.py` adapter file. The key pattern: `message_conversion` adapters transform between internal message format and each provider's wire format. This is exactly what `src/normalizers/` does in agentsy — validates the existing approach.

#### 3.7.3 Context Injection (not Orchestration)

From the comparison table: "memory or skills are pulled in only as context instead of becoming a heavy orchestration layer." The agent loop stays simple. Memory is injected as tool_result content or system prompt XML tags.

This directly validates **PAT-004** in the agentsy plan. No change needed — plan is already correct here.

---

### 3.8 Vercel AI SDK (`vercel/ai`)

**Source**: `packages/ai/src/agent/` directory — `tool-loop-agent.ts`, `tool-loop-agent-settings.ts`, `create-agent-ui-stream.ts`; `packages/ai/src/generate-text/stop-condition.ts`.

#### 3.8.1 `ToolLoopAgent` Class Architecture

The canonical Vercel AI agent is a class implementing an `Agent<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT, OUTPUT>` interface with exactly two public invocation methods:

```typescript
class ToolLoopAgent {
  async generate(params: AgentCallParameters): Promise<GenerateTextResult>;
  async stream(params: AgentStreamParameters): Promise<StreamTextResult>;
}
```

The class holds **settings** (static, per-instance config) separate from **call parameters** (dynamic, per-invocation). A `prepareCall()` private method merges them, applying `prepareCall` hook and runtime context injection.

**→ MEDIUM priority** (maps to P0 `createAgentLoop`): `createAgentLoop.ts` currently returns a single function. Consider exposing `generate()` + `stream()` as named methods on a returned agent object so callers can switch between streaming and non-streaming without changing call sites.

#### 3.8.2 `StopCondition` as Composable Async Predicates

Stop conditions are external, composable predicates — not inline flags inside the loop:

```typescript
type StopCondition<TOOLS, RUNTIME_CONTEXT> = (options: {
  steps: Array<StepResult<TOOLS, RUNTIME_CONTEXT>>;
}) => PromiseLike<boolean> | boolean;

// Built-in factories:
isStepCount(20); // default: stop after 20 steps
isLoopFinished(); // never stops via condition (natural termination only)
hasToolCall('planTool'); // stop when a named tool is called
```

Stop conditions are evaluated after each step via `isStopConditionMet()` which runs all conditions in parallel via `Promise.all()`. The first `true` wins.

**→ HIGH priority** (validates existing plan): The agentsy `stopConditions` in `createAgentLoop.ts` should expose exactly this API surface (already implied by plan but confirm the async predicate shape). The `isStepCount` factory is the correct default guard, not a hardcoded `maxIterations` number.

**→ HIGH priority** (new): Add `hasToolCall(...toolNames)` stop condition factory to `src/agent/stopConditions.ts`. When the coordinator calls a named planning tool (e.g., `planTool`, `respond`), the loop should terminate — this is a common agentic pattern not yet in the plan.

#### 3.8.3 `prepareStep` — Per-Step Dynamic Reconfiguration

`prepareStep` is a callback fired **before each LLM call** in the loop, allowing the caller to change the model, tools, active tool subset, instructions, or any call setting for that specific step:

```typescript
prepareStep?: PrepareStepFunction<TOOLS, RUNTIME_CONTEXT>
// receives: StepResult[], current settings
// returns: updated model, tools, instructions, stopWhen...
```

This enables production patterns like: use a cheap model for intermediate reasoning steps, switch to a powerful model for the final output step; or disable destructive tools after the planning phase.

**→ HIGH priority** (maps to P0 TASK-P0-005/TASK-P2-002): `AgentLoopOptions` must include `prepareStep?: (step: StepState) => Promise<Partial<AgentLoopOptions>>`. This is how multi-phase agent behavior (plan → act → verify) is implemented without spawning sub-agents.

#### 3.8.4 `toolApproval` as First-Class Stop Condition

Approval is built into the tool-loop termination logic, not a parallel pipeline:

```typescript
stopWhen?: Arrayable<StopCondition<TOOLS>>
toolApproval?: ToolApprovalConfiguration<TOOLS, RUNTIME_CONTEXT>
```

When a tool `needsApproval` or a `toolApproval` configuration matches, the loop stops cleanly — it does not throw an error. The agent returns a result with `finishReason: 'tool-calls'` and the pending tool call. The caller then provides the approval response and re-enters the loop.

**→ HIGH priority** (maps to P6 TASK-P6-003): `ApprovalEngine` in agentsy must halt the loop with a structured `ApprovalRequired` result type (not an exception) and support resumption via `loop.continue({ toolCallId, approved, modifiedInput })`. The current plan describes approval as a blocking prompt — refine this to a pauseable/resumable loop.

#### 3.8.5 `experimental_repairToolCall` Hook

A pluggable function that receives a malformed tool call JSON string and attempts to return a valid one:

```typescript
experimental_repairToolCall?: ToolCallRepairFunction<TOOLS>
```

This fires **after** a tool call JSON parse failure and **before** surfacing the error to the caller. Production implementations typically use a second LLM call with the malformed JSON and schema as context.

**→ HIGH priority** (maps to P5): `ToolExecutor` must expose `repairToolCall?: (toolName, malformedArgs, schema) => Promise<string>`. The `autoRepair.ts` in `src/structured/` implements JSON repair but is not wired into the tool execution pipeline. These should connect.

#### 3.8.6 `mergeCallbacks` Pattern

Both settings-level and call-level lifecycle callbacks are merged so both fire:

```typescript
experimental_onStart: mergeCallbacks(this.settings.experimental_onStart, callParams.experimental_onStart);
```

This prevents call-level callbacks from silently overriding settings-level callbacks. Both always fire, in settings-first order.

**→ HIGH priority** (maps to P2): `createAgentLoop.ts` lifecycle hooks (currently not specified) must use this merge pattern. A `mergeCallbacks` utility must be added to `src/agent/utils.ts`. Without this, downstream consumers who set a global `onStepFinish` in `AgentConfig` and also pass `onStepFinish` per-call will silently lose one.

#### 3.8.7 `createAgentUIStream` — The Agent-to-UIMessage Bridge

```typescript
async function createAgentUIStream({
  agent,
  uiMessages,
  options,
  abortSignal,
  experimental_transform,
  onStepFinish,
  ...uiMessageStreamOptions
}): Promise<AsyncIterableStream<UIMessageChunk>>;
```

This function: (1) validates and converts `UIMessage[]` → `ModelMessage[]`; (2) calls `agent.stream()`; (3) calls `result.toUIMessageStream()`. It is the single integration point between the agent loop and the UI layer.

**→ MEDIUM priority** (maps to P0 + the existing `src/ag-ui/adapter.ts`): agentsy's `createAgentUIStream` equivalent should live in `src/agent/` (not `src/ag-ui/`) and be the public API for connecting `createAgentLoop` output to the AG-UI stream consumer. `src/ag-ui/adapter.ts` is the right place — confirm it handles `UIMessage[]` → `ModelMessage[]` conversion and `ModelMessage[]` → `UIMessage[]` result streaming in one bridge function.

#### 3.8.8 Typed `CALL_OPTIONS` with Schema Validation

```typescript
callOptionsSchema?: FlexibleSchema<CALL_OPTIONS>
prepareCall?: (options: AgentCallParameters & SettingsSubset) => MaybePromiseLike<SettingsSubset>
```

Agent instances can declare a schema for per-call options. The SDK validates options against this schema before `prepareCall` fires. This enables type-safe, per-invocation agent parameterization (e.g., locale, tenant ID, feature flags passed at call time).

**→ MEDIUM priority** (maps to P0 `AgentConfig`): `createAgentLoop` options should include `callOptionsSchema?: ZodSchema` for validating per-invocation context. This enables multi-tenant agent instantiation.

---

### 3.9 TanStack AI (`TanStack/ai`)

**Source**: `packages/typescript/ai/src/activities/chat/stream/processor.ts` (~50K LOC), `agent-loop-strategies.ts`, `packages/typescript/ai-client/src/`, `README.md`, docs tree.

#### 3.9.1 `StreamProcessor` — AG-UI State Machine

TanStack's `StreamProcessor` is a single-class AG-UI event state machine that manages the full `UIMessage[]` conversation array. It is the most thoroughly specified streaming implementation reviewed:

- **Per-message state** tracked in `Map<messageId, MessageStreamState>` — text accumulation, tool call tracking, thinking content, completion flags
- **Per-tool-call state** tracked in `Map<toolCallId, InternalToolCallState>` — arguments accumulation, parse state, approval state
- **Active runs tracking** via `Set<runId>` — supports concurrent runs without cross-contamination
- **Recording/replay** — stream chunks stored as JSON fixtures; `StreamProcessor.replay(recording)` for deterministic test execution

**→ HIGH priority** (maps to P0 `LLMStreamProcessor`): The agentsy `LLMStreamProcessor` in `src/processor/` should adopt the per-message `MessageStreamState` Map pattern rather than flat stream state. This is the correct design for multi-message agentic conversations where multiple assistant messages arrive in the same session.

**→ HIGH priority** (maps to all stream tests): Add chunk recording/replay fixture support to `LLMStreamProcessor`. Store raw event sequences as `.json` files in `src/processor/__fixtures__/`. Tests feed fixtures through `processor.process()` for deterministic edge-case coverage. This is the correct alternative to mock stream factories.

#### 3.9.2 `AgentLoopStrategy` — Same Functional Predicate Pattern as Vercel

```typescript
type AgentLoopStrategy = (state: {
  iterationCount: number;
  finishReason: string | null;
  messages: UIMessage[];
}) => boolean;

// Built-in factories:
maxIterations(n); // stop after n iterations
untilFinishReason(['stop', 'length']); // stop on finish reason
combineStrategies([stratA, stratB]); // AND composition
```

Both Vercel (`StopCondition`) and TanStack (`AgentLoopStrategy`) independently converged on the same functional predicate pattern for loop termination. This is confirmed consensus.

**→ HIGH priority** (confirms PAT): `src/agent/stopConditions.ts` pattern is validated. Add `untilFinishReason` and `combineStrategies` factories alongside `isStepCount`. Both SDKs also expose `messages` in the predicate context — agentsy's predicates should too (currently `steps: StepResult[]` but message array access is needed for content-based stop conditions).

#### 3.9.3 `TOOL_CALL_END` Dual Role

TanStack's `TOOL_CALL_END` event has two distinct roles:

1. **Without `result`** — input arguments are finalized (adapter emits after streaming args complete)
2. **With `result`** — tool was server-executed; `result` carries the JSON output

This dual role eliminates a separate `TOOL_CALL_RESULT` event for the common server-tool case. Client tools still require the `onToolCall` callback + `addToolResult()` round-trip.

**→ HIGH priority** (maps to `src/ag-ui/event-converters.ts`): agentsy AG-UI adapters should handle `TOOL_CALL_END.result` by creating both the `output` field on the tool-call part and a `tool-result` part in one pass — matching the TanStack `handleToolCallEndEvent()` implementation. Avoids an extra `TOOL_CALL_RESULT` round-trip for server tools.

#### 3.9.4 Lazy `UIMessage` Creation via `prepareAssistantMessage()`

TanStack separates message **preparation** from message **creation**:

```typescript
processor.prepareAssistantMessage(); // resets stream state, NO message yet
// message is created lazily on first TEXT_MESSAGE_CONTENT or TOOL_CALL_START
```

The previous `startAssistantMessage()` eagerly created the message, causing empty message flicker in the UI when auto-continuation produced no content (e.g., Gemini models sometimes emit only `"\n"`).

Flicker guard: `finalizeStream()` removes whitespace-only assistant messages that were lazily created but contained no meaningful content.

**→ HIGH priority** (maps to `LLMStreamProcessor`): `LLMStreamProcessor.startStream()` should not push an assistant message to the messages array immediately. Create the message on first content-bearing chunk. Add a whitespace-only message guard in `finalizeStream()`.

#### 3.9.5 `ChunkStrategy` Interface — Pluggable Emission Throttling

```typescript
interface ChunkStrategy {
  shouldEmit(chunkPortion: string, currentText: string): boolean;
  reset?(): void;
}

// Built-in:
new ImmediateStrategy(); // emit every chunk (default)
new WordBoundaryStrategy(); // emit only on word boundaries (less re-render churn)
new PunctuationStrategy(); // emit on punctuation (sentence-level batching)
```

The strategy is injected via constructor options and can be swapped at runtime. This decouples the emission rate policy from the core accumulation logic.

**→ MEDIUM priority** (maps to P5 `StreamingOutputManager`): `LLMStreamProcessor` should expose `chunkStrategy?: ChunkStrategy` in constructor options. Default to `ImmediateStrategy`. `WordBoundaryStrategy` reduces React re-render count by ~60–80% for long responses.

#### 3.9.6 `MESSAGES_SNAPSHOT` for Reconnect/Resume

The `MESSAGES_SNAPSHOT` event atomically replaces the entire message array:

```typescript
case 'MESSAGES_SNAPSHOT':
  this.resetStreamState()
  this.messages = [...chunk.messages]
  this.emitMessagesChange()
```

This is the recovery path for: (1) WebSocket reconnect, (2) server-side agent resumption that has ahead-of-time computed messages, (3) tool-call result delivery after client tool execution.

**→ MEDIUM priority** (maps to P7 session resume): `FileSystemSessionStore.load()` should emit a `MESSAGES_SNAPSHOT`-equivalent event after loading a session, not delta-feed individual messages. `LLMStreamProcessor.setMessages()` already exists in TanStack for this purpose — add it to agentsy's processor.

#### 3.9.7 `areAllToolsComplete()` Predicate

```typescript
processor.areAllToolsComplete(): boolean
// Returns true when all tool-call parts in the last assistant message
// are in a terminal state (input-complete, approval-responded, or have output)
```

Used by the auto-continuation loop to decide when to re-submit to the LLM. Avoids the common bug of re-submitting before client tools have reported their results.

**→ MEDIUM priority** (maps to P2 auto-continuation): `createAgentLoop.ts` auto-continuation check should call `processor.areAllToolsComplete()` before re-invoking the LLM. If false, wait for `addToolResult()` calls before continuing.

#### 3.9.8 Multi-Package Architecture Reference

TanStack AI's package structure is a reference for agentsy's eventual modularization:

```text
@tanstack/ai               → core (stream processor, agent loop, tool calls)
@tanstack/ai-openai        → OpenAI adapter (text, image, audio, video, TTS, STT)
@tanstack/ai-anthropic     → Anthropic adapter
@tanstack/ai-gemini        → Gemini adapter
@tanstack/ai-react         → React hooks (useChat, useGeneration, useSummarize)
@tanstack/ai-solid         → Solid hooks
@tanstack/ai-vue           → Vue composables
@tanstack/ai-svelte        → Svelte runes
@tanstack/ai-react-ui      → Pre-built React chat UI components
@tanstack/ai-devtools      → DevTools panel (visual chunk inspector, conversation debugger)
@tanstack/ai-code-mode     → Code editing specialized mode
tanstack-ai (PHP)          → SSE server (PHP)
tanstack-ai-python         → SSE server (Python)
```

**→ LOW priority** (validates modular packaging strategy): agentsy's monorepo split (core / adapters / renderers / react-ui) is validated. The DevTools package is worth noting — a visual chunk/event inspector would significantly improve DX for downstream integrators. Note: TanStack requires Node.js v24+ due to `isolated-vm` for code execution sandbox.

---

## 4. Cross-Cutting Patterns (Confirmed Across ≥3 Projects)

These patterns are validated by multiple independent implementations and should be treated as settled consensus rather than speculation.

### 4.1 Lazy Session Creation

**Confirmed in**: nanobot (2026-04-12 `fix: lazy session creation`), Hermes (`tui_gateway/` fix), Codex (`thread-store` process-scoped).

Do not create a session DB row or file until the first user message is actually sent. Avoids orphan session rows from aborted initializations.

**→ HIGH priority** (maps to P7 TASK-P7-003): `FileSystemSessionStore.save()` must not create the session file until the first actual message snapshot is provided.

### 4.2 User Messages Persisted Before Tool Execution

**Confirmed in**: Claude Code (`await write` for user messages), nanobot (2026-04-13 `agent turn hardened — user messages persisted early`).

The user's message must be durably written to disk **before** any tool execution begins. If the process crashes mid-tool-execution, the user message must be recoverable.

**→ HIGH priority** (maps to P7 TASK-P7-004): In `createAgentLoop.ts`, the `sessionStore.save()` call for user turn must use `await` (blocking). Tool results can use fire-and-forget.

### 4.3 Auto-Compact Skips Active Tasks

**Confirmed in**: nanobot (2026-04-13 `auto-compact skips active tasks`).

Context compression must not trigger while a tool call is in-flight. Compressing mid-execution can corrupt the tool_use/tool_result pairing in the message array.

**→ HIGH priority** (maps to P3 TASK-P3-004): `ContextManager.check()` must accept an `isToolCallActive: boolean` flag and skip compression when `true`. `createAgentLoop.ts` must pass this flag.

### 4.4 `allow_patterns` Take Priority Over `deny_patterns`

**Confirmed in**: nanobot (2026-04-13 `fix: allow_patterns take priority over deny_patterns in ExecTool`).

In the permission rule engine, explicit allow rules must be evaluated before deny rules. An explicit allow for a specific path/tool beats a broad deny glob.

**→ HIGH priority** (maps to P6 TASK-P6-002): `ApprovalEngine` policy evaluation order must be: `alwaysDenyRules` → `alwaysAllowRules` → `alwaysAskRules` → fallback. An allow rule can override a deny rule if the allow pattern is more specific. Document this explicitly.

> **Implementation note**: This is unintuitive. Most engineers assume "deny wins." The correct model is "most specific wins" or "allow trumps deny." Enforce via unit tests.

### 4.5 Warning-First Tool Loop Guardrails

**Confirmed in**: Hermes Agent (`fix(agent): make tool loop guardrails warning-first`), implied by Claude Code's `LoopDetected` event design.

Do not hard-fail on the first loop detection. Emit a warning event and allow one more step. Hard-fail on the second consecutive detection.

**→ HIGH priority** (maps to P2 TASK-P2-003, P6): `LoopDetected` event = warning (step continues). New `LoopExceeded` event = hard abort.

### 4.6 Atomic Session Writes with Auto-Repair

**Confirmed in**: nanobot (2026-04-19 `feat: atomic session writes with auto-repair`), Claude Code (atomic JSONL append).

Session file writes must be atomic (write to `.tmp`, verify, rename). If a `.tmp` file is found on startup (indicating a crash mid-write), the store must attempt to repair/parse it rather than silently discard it.

**→ HIGH priority** (maps to P7 TASK-P7-003): `FileSystemSessionStore` atomic write already specified. Add: on startup, scan for `*.json.tmp` files in the session directory; attempt JSON parse; if valid, rename to `*.json`; if invalid, log warning and delete.

### 4.7 WebSocket Idle Timeout

**Confirmed in**: Codex (`Bound websocket request sends with idle timeout #20751`), implied by long-running agent session patterns.

WebSocket-transport connections must have an idle timeout. Without it, connections to MCP servers can stall indefinitely.

**→ HIGH priority** (maps to P8 TASK-P8-003): `MCPServerConfig` must include `connectionIdleTimeoutMs?: number` (default `30_000`). `MCPOrchestrator` WebSocket transport must enforce this.

### 4.8 Stop Conditions as Functional Predicates (Not Flags)

**Confirmed in**: Vercel AI (`StopCondition<TOOLS>` async predicates), TanStack AI (`AgentLoopStrategy` sync predicates), Claude Code (`LoopDetected` event with one-step grace).

Three independent major SDKs converged on the same pattern: loop termination is controlled by **composable external predicate functions**, not inline `if (steps >= max)` guards or enum flags. Predicates receive full loop state (steps/messages/finishReason) and return `boolean | Promise<boolean>`. Multiple predicates are OR-composed.

**→ HIGH priority** (maps to P2 `createAgentLoop.ts`): Confirm agentsy exports `isStepCount`, `hasToolCall`, `untilFinishReason`, and `combineStrategies` factory functions from `src/agent/stopConditions.ts`. These are the canonical API — not an integer `maxSteps` option.

### 4.9 Lazy Message Creation on First Content

**Confirmed in**: TanStack AI (`prepareAssistantMessage()` lazy pattern), Claude Code (deferred assistant message hydration), Codex (no message row until first turn).

Do not create the assistant message (UI row, DB row, session record) until the first meaningful content chunk arrives. Creating eagerly causes empty flicker in UIs and orphan rows in DBs.

**→ HIGH priority** (maps to P5 `LLMStreamProcessor`): The `LLMStreamProcessor.startStream()` method must not push an empty message. Emit only on first text/tool-call content. Add a whitespace-only message cleanup in `finalizeStream()`.

### 4.10 Chunk Recording/Replay for Stream Tests

**Confirmed in**: TanStack AI (`StreamProcessor.replay(recording)`, `ChunkRecording` type), implied by the existence of `src/processor/LLMStreamProcessor.test.ts` complexity.

Stream processors that handle complex AG-UI event sequences are best tested via **recorded fixture files** rather than synthetic mock factories. Record real stream chunks as JSON, replay through the processor for deterministic edge-case coverage.

**→ HIGH priority** (maps to P0 test infrastructure): Add `processor.startRecording()` / `processor.getRecording()` to `LLMStreamProcessor`. Store real LLM stream recordings in `src/processor/__fixtures__/` as `.json` files. Wire `StreamProcessor.replay(fixture)` as a static method.

---

## 5. Alternatives

- **ALT-001**: Apply all findings as additive tasks in the existing plan (chosen approach). Alternative: create new phases. Rejected: the plan's phase structure is sound; findings enrich existing tasks rather than requiring new phases.
- **ALT-002**: Implement FTS5 session search (Hermes pattern) in v0.3.0 alongside vector RAG. Rejected: FTS5 is a useful complement but adds scope; libSQL already supports it and it can be added in X6 as an optional retrieval path.
- **ALT-003**: Implement the full nanobot memory git versioning (GitStore) in v0.3.0. Rejected: adds git dependency to the library. Defer to post-v0.3.0. Plan should note the design intent.
- **ALT-004**: Adopt `ToolLoopAgent` class pattern (Vercel) instead of `createAgentLoop` factory function. Deferred: factory function is idiomatic for the existing codebase and ESM tree-shaking. Class pattern is valid but not worth migration cost now.
- **ALT-005**: Adopt TanStack `ChunkStrategy` interface verbatim in `LLMStreamProcessor`. Considered: agentsy should implement an equivalent interface, but naming and API should match the existing codebase conventions rather than being a direct port.

---

## 6. Dependencies

- **DEP-001**: libSQL FTS5 support — built into libSQL, no extra dependency. Needed for 3.3.1 FTS5 pattern.
- **DEP-002**: ACP SDK — not yet a stable npm package. Monitor; add as optional peer dep when available.
- **DEP-003**: `@ai-sdk/provider-utils` (Vercel) — not a direct dependency; `StopCondition` / `mergeCallbacks` patterns are reference implementations, not imports.
- **DEP-004**: `isolated-vm` (TanStack `ai-code-mode`) — requires Node.js v24+. Not relevant to agentsy core but constrains downstream code-execution tool implementations.

---

## 7. Files

- **FILE-001**: `plan/agentsy-platform-v1.md` — primary file to patch with HIGH-priority findings.
- **FILE-002**: `plan/deep-dive-synthesis-v1.md` — this document (read-only reference).

---

## 8. Related Specifications / Further Reading

- [Claude Code v2.1.88 Source Analysis](https://github.com/chauncygu/collection-claude-code-source-code/blob/main/claude-code-source-code/README.md) — 12 harness mechanisms, tool interface predicates, session persistence strategy, DCE feature flags
- [nanobot memory.md](https://github.com/HKUDS/nanobot/blob/main/docs/memory.md) — Consolidator → Dream two-stage flow, cursor-based JSONL, GitStore versioning, Dream config
- [Hermes Agent README](https://github.com/NousResearch/hermes-agent/blob/main/README.md) — closed learning loop, six terminal backends, ACP adapter, FTS5 session search
- [Codex-rs README](https://github.com/openai/codex/blob/main/codex-rs/README.md) — sandbox modes (read-only/workspace-write/full-access), crate separation (core/exec/tui/cli), WebSocket idle timeout
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) — three release channels (preview/stable/nightly), memory-tests/ + perf-tests/ structure, ACP mode
- [OpenCode](https://github.com/anomalyco/opencode) — `plan` agent (read-only mode), `@general` named subagent, client/server separation
- [nano-claude-code](https://github.com/chauncygu/collection-claude-code-source-code/blob/main/README.MD) — minimal tool registry pattern, multi-provider adapter, context-injection-not-orchestration
- [Vercel AI SDK — `tool-loop-agent.ts`](https://github.com/vercel/ai/blob/main/packages/ai/src/agent/tool-loop-agent.ts) — `ToolLoopAgent` class, `generate()` + `stream()` split, `prepareStep`, `mergeCallbacks`, `repairToolCall`
- [Vercel AI SDK — `stop-condition.ts`](https://github.com/vercel/ai/blob/main/packages/ai/src/generate-text/stop-condition.ts) — `StopCondition` predicate type, `isStepCount`, `isLoopFinished`, `hasToolCall` factories
- [Vercel AI SDK — `create-agent-ui-stream.ts`](https://github.com/vercel/ai/blob/main/packages/ai/src/agent/create-agent-ui-stream.ts) — `UIMessage[]` → `ModelMessage[]` → `UIMessageStream` bridge function
- [TanStack AI — `processor.ts`](https://github.com/TanStack/ai/blob/main/packages/typescript/ai/src/activities/chat/stream/processor.ts) — `StreamProcessor` AG-UI state machine, lazy message creation, chunk recording/replay, `TOOL_CALL_END` dual role, `MESSAGES_SNAPSHOT`
- [TanStack AI — `agent-loop-strategies.ts`](https://github.com/TanStack/ai/blob/main/packages/typescript/ai/src/activities/chat/agent-loop-strategies.ts) — `maxIterations`, `untilFinishReason`, `combineStrategies` factories
- [agentsy-platform-v1.md](./agentsy-platform-v1.md) — the primary implementation plan this document enriches
