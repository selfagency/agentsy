---
goal: '@agentsy platform — product requirements document'
version: '1.0'
date_created: '2026-05-02'
last_updated: '2026-05-02'
owner: 'selfagency'
status: 'Planned'
tags: ['prd', 'agentsy', 'requirements', 'product']
---

# @agentsy Platform — Product Requirements Document

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

---

## 1. Problem Statement

Building production-grade AI agents in TypeScript requires stitching together a dozen undocumented abstractions: stream parsing, tool-call routing, approval flows, context compression, session persistence, memory retrieval, and MCP integrations. Every team reinvents these primitives. The existing `@agentsy/core` package solves the stream-parsing slice but leaves the rest to the consumer.

**The gap**: There is no composable, independently installable TypeScript library collection that covers the full agent-infrastructure stack — from raw byte stream to persistent memory — while remaining unopinionated about the application layer (CLI, chat UI, server, background process).

**The solution**: `@agentsy/*` — a family of 15 composable packages and one compatibility shim under a single npm org. Consumers install only the packages they need. The entire stack composes from the same set of primitives with no circular dependencies and no forced framework choices.

---

## 2. Goals

- **G-001**: Provide a complete, independently installable TypeScript library for building production LLM agents — covering stream parsing, agent loop, context management, session persistence, tool execution, approval flows, MCP integration, memory, and vector retrieval.
- **G-002**: Maintain 100% backward compatibility with `@agentsy/core` consumer import paths via a shim package.
- **G-003**: Support selective installation — a developer who only needs stream parsing should not need to install `@agentsy/memory` or `@agentsy/mcp`.
- **G-004**: Provide evidence-based design decisions informed by the most successful open-source agent codebases (Claude Code, Gemini CLI, OpenCode, vercel/ai, TanStack AI, nanobot, Hermes, Codex).
- **G-005**: Enable crash-safe, deterministically resumable agent sessions.
- **G-006**: Provide a 3-layer blended memory architecture (raw event log → synthesized wiki → vector RAG) that is optional and independently installable.
- **G-007**: Publish with three release channels (nightly / preview / latest) for rapid iteration and stable adoption simultaneously.

## 3. Non-Goals

- **NG-001**: `@agentsy` is a **library**, not an application. It provides no CLI binary, no web server, no chat UI. Downstream consumers build those.
- **NG-002**: The platform does not choose or bundle an LLM provider. Provider adapters are thin normalizers; the model client is always caller-supplied.
- **NG-003**: `@agentsy/core` has zero runtime dependencies. It does not bundle any provider SDKs.
- **NG-004**: The library does not implement user authentication, rate limiting, or multi-tenancy. Those belong in the consuming application.
- **NG-005**: React hooks, Vue composables, or any UI framework integration are post-v0.3.0 scope (analogous to `@tanstack/ai-react` — see SRC-8 for precedent).
- **NG-006**: A visual DevTools panel (like TanStack AI DevTools) is a future consideration, not v0.3.0 scope.

---

## 4. User Profiles

### UP-1: Stream Parsing Consumer

**Who**: A developer adding LLM streaming to an existing Node.js application (e.g., a CLI tool, VS Code extension, or backend service).

**Need**: Parse raw model output (text delta, tool-call arguments, thinking) from any provider into a normalized event stream. No agent loop needed.

**Install**: `npm install @agentsy/core @agentsy/normalizers @agentsy/processor`

**Key packages**: `@agentsy/core` (xml-filter, sse, thinking, structured), `@agentsy/normalizers`, `@agentsy/processor`

---

### UP-2: Agent Framework Integrator

**Who**: A developer building a complete agent application — a CLI assistant, background automation agent, or multi-step task runner.

**Need**: A full agent loop with tool execution, approval flows, context compression, and session resumption. Must work with the LLM provider they already use.

**Install**: `npm install @agentsy/orchestrator/agent @agentsy/runtime @agentsy/session @agentsy/context-manager`

**Key packages**: `@agentsy/orchestrator/agent`, `@agentsy/runtime`, `@agentsy/session`, `@agentsy/context-manager`, `@agentsy/cost-tracker`

---

### UP-3: Memory-Augmented Agent Developer

**Who**: A developer building an agent that must remember user preferences, project facts, and past interactions across sessions.

**Need**: A persistent, semantic memory layer that indexes facts into a searchable wiki, with RAG retrieval that injects context automatically.

**Install**: `npm install @agentsy/memory @agentsy/retrieval`

**Key packages**: `@agentsy/memory`, `@agentsy/retrieval`, `@agentsy/session` (for raw event log persistence)

---

### UP-4: Multi-Agent System Builder

**Who**: A developer orchestrating multiple cooperative agents — a planner/executor split, a critic/generator pair, or a team of specialized subagents.

**Need**: Parent-child subagent spawning, named subagent addressing, isolated context per agent, and coordination protocols.

**Install**: `npm install @agentsy/orchestrator/agent @agentsy/mcp @agentsy/providers`

**Key packages**: `@agentsy/orchestrator/agent` (SubagentCoordinator), `@agentsy/mcp` (MCP tool servers as subagent transport), `@agentsy/providers` (provider fallback chains)

---

### UP-5: Skill/Plugin Extension Author

**Who**: A developer creating reusable agent capabilities (memory search, file editing, code execution) that others can install and compose.

**Install**: `npm install @agentsy/runtime @agentsy/core`

**Key packages**: `@agentsy/runtime` (PluginLoader, SkillLoader, tool approval), `@agentsy/core` (tool-calls types, structured output)

---

### UP-6: Token-Efficiency Developer

**Who**: A developer or power user who operates under tight context-window budgets — working with long codebases, large documents, or many concurrent agent sessions.

**Need**: Reduce token consumption without sacrificing accuracy. Apply compression at prompt (via SKILL.md injection), at tool descriptions (via `caveman-shrink` MCP proxy), and at subagent outputs (via `cavecrew` variants).

**Install**: `npm install @agentsy/caveman`

**Key packages**: `@agentsy/caveman` (CavemanManager, bundled SKILL.md, `caveman-shrink` MCP proxy, `cavecrew` subagent variants)

---

### UP-7: Chat Platform Operator

**Who**: A developer deploying an AI agent to one or more messaging platforms (Telegram, Discord, Slack) as a chatbot or automation tool.

**Need**: Receive inbound messages from chat channels, route them to an agent session, manage per-conversation context, and deliver responses back to the originating channel. Needs crash-safe session persistence and slash command support in chat.

**Install**: `npm install @agentsy/connectors @agentsy/slash-commands @agentsy/session`

**Key packages**: `@agentsy/connectors` (ConnectorGateway, TelegramAdapter, DiscordAdapter, SlackAdapter, AgentSessionManager), `@agentsy/slash-commands` (SlashCommandRegistry), `@agentsy/session` (per-conversation persistence)

---

## 5. Functional Requirements

Requirements inherited from `agentsy-platform-v2.md` §1. Reproduced here with user-profile mapping.

| ID      | Requirement                                                                                                                                                                                                             | Priority | User Profiles | V0.3.0 |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | ------ |
| REQ-001 | All packages publish under `@agentsy` npm org.                                                                                                                                                                          | P0       | All           | ✅     |
| REQ-002 | `@agentsy/core` shim re-exports all existing APIs unchanged.                                                                                                                                                            | P0       | UP-1, UP-2    | ✅     |
| REQ-003 | All existing subpath exports available on shim without modification.                                                                                                                                                    | P0       | UP-1          | ✅     |
| REQ-004 | Agent loop supports hook injection: `beforeStep`, `afterStep`, `beforeToolCall`, `afterToolCall`, `onError`, `onAbort`.                                                                                                 | P1       | UP-2, UP-3    | ✅     |
| REQ-005 | Agent loop calls `memoryEngine.startTask()` / `memoryEngine.endTask()` when memory engine is provided.                                                                                                                  | P1       | UP-3          | ✅     |
| REQ-006 | `LLMStreamProcessor` emits: `ContextWindowWillOverflow`, `ChatCompressed`, `LoopDetected`, `LoopExceeded`, `Citation`, `Retry`, `InvalidStream`.                                                                        | P1       | UP-1, UP-2    | ✅     |
| REQ-007 | Context window manager monitors token budget, triggers compression at threshold, emits `ContextWindowWillOverflow`.                                                                                                     | P1       | UP-2          | ✅     |
| REQ-008 | Cost tracker maintains provider pricing map, enforces optional budget limits, emits `CostThresholdExceeded`.                                                                                                            | P1       | UP-2, UP-4    | ✅     |
| REQ-009 | Parallel tool executor: bounded concurrency, per-call `AbortSignal`, deterministic result ordering.                                                                                                                     | P1       | UP-2          | ✅     |
| REQ-010 | Tool approval engine: `allow` / `ask` / `deny` / `auto` / `plan` modes. Allow rules beat deny rules by specificity.                                                                                                     | P1       | UP-2          | ✅     |
| REQ-011 | Session store persists `StreamSnapshot` checkpoints. Atomic writes. Auto-repair orphan `.tmp` files on startup.                                                                                                         | P1       | UP-2, UP-3    | ✅     |
| REQ-012 | MCP orchestration conforms to MCP 2025-06-18 spec. WebSocket idle timeout (default 30s). Trust-level filtering.                                                                                                         | P2       | UP-2, UP-4    | ✅     |
| REQ-013 | Provider strategy: capability matrix (context window, vision, tool calling, streaming), configurable fallback chains.                                                                                                   | P2       | UP-4          | ✅     |
| REQ-014 | Multi-agent: parent→child spawning with max depth cap. Named subagent addressing (e.g., `@general`).                                                                                                                    | P2       | UP-4          | ✅     |
| REQ-015 | Skill system: Agent Skills open standard (`.agents/skills/**/SKILL.md`, progressive disclosure). Remote URL loading + checksum verify.                                                                                  | P2       | UP-5          | ✅     |
| REQ-016 | Memory engine: 3-layer architecture (Layer 0 raw event log, Layer 1 wiki, Layer 2 vector RAG).                                                                                                                          | P3       | UP-3          | ✅     |
| REQ-017 | Vector RAG indexes wiki pages, NOT raw session events. (Karpathy architectural invariant.)                                                                                                                              | P3       | UP-3          | ✅     |
| REQ-018 | Memory tools: `memory_search()`, `memory_capture()`, `memory_list()`, `memory_stats()`, `memory_lint()`.                                                                                                                | P3       | UP-3          | ✅     |
| REQ-019 | Retrieved memory injected via `<memory_context>` tags using existing `splitLeadingXmlContext`/`dedupeXmlContext` pipeline.                                                                                              | P3       | UP-3          | ✅     |
| REQ-020 | `openaiResponses` provider routable through `@agentsy/normalizers` + `@agentsy/processor`.                                                                                                                              | P1       | UP-1, UP-2    | ✅     |
| REQ-021 | Each package independently installable; installing `@agentsy/processor` does not pull in `@agentsy/memory`.                                                                                                             | P0       | All           | ✅     |
| REQ-022 | Turborepo orchestrates build/test/typecheck/lint with dependency-aware caching.                                                                                                                                         | P0       | All (tooling) | ✅     |
| REQ-023 | `StopCondition` predicates (`isStepCount`, `hasToolCall`, `isLoopFinished`, `untilFinishReason`, `combineStrategies`) exported from `@agentsy/orchestrator/agent`.                                                      | P1       | UP-2          | ✅     |
| REQ-024 | `prepareStep` callback and `mergeCallbacks` utility available in `@agentsy/orchestrator/agent`.                                                                                                                         | P1       | UP-2, UP-4    | ✅     |
| REQ-025 | `@agentsy/caveman` ships bundled `caveman` SKILL.md (JuliusBrussee/caveman v1.7.0) activatable without `npx skills add`.                                                                                                | P2       | UP-6          |        |
| REQ-026 | `@agentsy/caveman` includes `caveman-shrink` MCP stdio proxy that compresses tool descriptions while preserving code, URLs, and identifiers.                                                                            | P2       | UP-6          |        |
| REQ-027 | `@agentsy/caveman` includes `cavecrew` subagent SKILL.md variants (investigator, builder, reviewer) emitting ~60% fewer output tokens.                                                                                  | P2       | UP-6          |        |
| REQ-028 | Caveman mode intensity settable via `CavemanMode`: `'lite'\|'full'\|'ultra'\|'wenyan-lite'\|'wenyan-full'\|'wenyan-ultra'`. Default: `'full'`.                                                                          | P2       | UP-6          |        |
| REQ-029 | `@agentsy/skills` provides `SkillsManager` with `find`, `add`, `list`, `remove`, `update`, `init` — wrapping `npx skills` CLI.                                                                                          | P2       | UP-5, UP-6    |        |
| REQ-030 | `@agentsy/skills` supports natural-language search of the skills.sh registry, returning ranked `SkillSearchResult[]`.                                                                                                   | P2       | UP-5          |        |
| REQ-031 | `@agentsy/mcp` bundles `@mcpmarket/mcp-auto-install v0.2.1`; five `mai_*` tools exposed to agent loop as first-class tools.                                                                                             | P2       | UP-2, UP-4    |        |
| REQ-032 | MCP auto-install supports `dryRun` mode (default: `true`); mutation requires explicit `{ dryRun: false }`.                                                                                                              | P2       | UP-2          |        |
| REQ-033 | `@agentsy/superpowers` bundles obra/superpowers v5.0.7 methodology skills: brainstorming, git-worktrees, writing-plans, subagent-driven-development, tdd, code-review, finish-branch.                                   | P2       | UP-5          |        |
| REQ-034 | Superpowers skills auto-activate on context signals: `tdd` on test files, `code-review` on diff context, `brainstorming` on planning prompts.                                                                           | P2       | UP-5          |        |
| REQ-035 | `@agentsy/slash-commands` provides `SlashCommandRegistry` discovering commands from `.agents/skills/<name>/SKILL.md`.                                                                                                   | P1       | UP-7, All     |        |
| REQ-036 | `@agentsy/slash-commands` ships 12 stock commands: `/skills-find`, `/skills-add`, `/skills-list`, `/mcp-list`, `/mcp-install`, `/caveman`, `/caveman-lite`, `/caveman-ultra`, `/compact`, `/status`, `/new`, `/review`. | P1       | UP-7          |        |
| REQ-037 | Slash command SKILL.md frontmatter supports `allowed-tools`, `description`, `model`, `argument-hint`. Bash execution, `@file`, `$ARGUMENTS` supported.                                                                  | P1       | UP-7, UP-5    |        |
| REQ-038 | `@agentsy/connectors` provides `ConnectorGateway` with `AdapterRegistry`. Gateway model: inbound → `MessageRouter` → `AgentSessionManager` → outbound.                                                                  | P2       | UP-7          |        |
| REQ-039 | `@agentsy/connectors` ships three first-party adapters: `TelegramAdapter`, `DiscordAdapter`, `SlackAdapter`. Additional adapters as `@agentsy/connector-<channel>` packages.                                            | P2       | UP-7          |        |
| REQ-040 | `@agentsy/connectors` `AgentSessionManager` integrates with `@agentsy/session` for per-conversation persistence and crash-safe resume.                                                                                  | P2       | UP-7          |        |
| REQ-041 | `@agentsy/connectors` inbound messages pass through `@agentsy/runtime` approval engine using `'auto'` mode by default.                                                                                                  | P2       | UP-7          |        |
| REQ-042 | `@agentsy/connectors` supports OpenClaw-compatible built-in chat commands: `/status`, `/new`, `/reset`, `/compact`, `/think`, `/verbose`, `/usage`.                                                                     | P2       | UP-7          |        |

---

## 6. Security Requirements

| ID      | Requirement                                                                                                                              | Priority | Notes                                                 |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------- |
| SEC-001 | All destructive tool calls (file overwrite, shell exec, network egress) pass through approval engine before execution.                   | P0       | No bypass path                                        |
| SEC-002 | Path confinement: file tools restricted to configurable workspace root; `../` sequences rejected.                                        | P0       | OWASP path traversal                                  |
| SEC-003 | Secret redaction: API key / bearer token regex patterns scrubbed from log output and telemetry.                                          | P1       | Prevent credential leak in structured logs            |
| SEC-004 | Plugin manifests carry signed checksum; runtime verifies before loading.                                                                 | P1       | Prevents supply-chain attack via plugin replacement   |
| SEC-005 | Memory scope isolation: project wiki pages not accessible to global-scope queries without explicit cross-scope permission.               | P2       | Prevents cross-project memory leakage                 |
| SEC-006 | Retrieved wiki content treated as untrusted; `<script>`, HTML injection, executable patterns stripped before system prompt injection.    | P1       | Prevents stored prompt injection (OWASP A03)          |
| SEC-007 | MCP server connections filtered by trust level (`trusted`/`untrusted`/`readonly`); untrusted servers blocked from destructive built-ins. | P1       |                                                       |
| SEC-008 | HTTP fetch tools validate destination URLs against configurable egress allowlist. (SSRF prevention — OWASP A10.)                         | P1       |                                                       |
| SEC-009 | Retrieved memory content carrying instruction-override patterns triggers `MemoryInjectionSuspected` warning and drops chunk.             | P2       | Defense against prompt injection via memory retrieval |

---

## 7. Success Criteria (SLOs)

| Metric                                       | Target              | Measurement                              |
| -------------------------------------------- | ------------------- | ---------------------------------------- |
| Agent loop startup (no memory, hot deps)     | p50 ≤ 500ms         | `perf-tests/` benchmark suite            |
| Memory retrieval, local vector store         | p95 ≤ 50ms          | `memory-tests/` integration suite        |
| Turborepo warm cache hit rate                | ≥ 90%               | `turbo run build --dry` cache stats      |
| Test suite coverage (all packages)           | ≥ 80% line coverage | vitest coverage reporter                 |
| TypeScript strict compile (all packages)     | 0 errors            | `turbo run typecheck`                    |
| Shim compatibility (existing consumer tests) | 100% pass           | `@agentsy/core` test suite               |
| Stream processor adversarial inputs          | 0 uncaught throws   | adversarial test suite per parser module |
| Build time (cold, all packages)              | ≤ 60s               | CI build step timer                      |
| Build time (warm cache)                      | ≤ 5s                | CI build step timer after cache warm     |

---

## 8. User Flows

### Flow 1: Install and Use Stream Parsing Only

```text
1. npm install @agentsy/core @agentsy/normalizers @agentsy/processor
2. import { createPipeline } from '@agentsy/processor'
3. const pipeline = createPipeline({ normalizer: 'openai' })
4. for await (const event of pipeline.process(response.body)) { ... }
```

Expected behavior: normalized `StreamEvent[]` without any agent loop, memory, or MCP involvement.

---

### Flow 2: Run an Agent Loop with Tool Approval

```text
1. npm install @agentsy/orchestrator/agent @agentsy/runtime
2. const loop = createAgentLoop({
     model, tools,
     approval: { mode: 'ask', handler: interactivePrompt },
     stopWhen: [isStepCount(20)]
   })
3. const result = await loop.run({ messages })
4. if (result.type === 'approval-required') {
     const answer = await getUserApproval(result.pendingCall)
     await loop.continue(answer)
   }
```

Expected behavior: agent loop pauses at approval gates, resumes cleanly, terminates on stop condition.

---

### Flow 3: Enable Memory and RAG

```text
1. npm install @agentsy/orchestrator/agent @agentsy/memory @agentsy/retrieval
2. const memory = createMemoryEngine({
     wikStore: { path: '~/.agentsy/wiki' },
     retrieval: { backend: 'libsql', path: '~/.agentsy/vectors.db' }
   })
3. const loop = createAgentLoop({ model, tools, memoryEngine: memory })
4. await loop.run({ messages })
   // memory.startTask() / endTask() called automatically
   // retrieved context injected as <memory_context> XML
```

Expected behavior: agent loop auto-injects relevant memory context, synthesizes wiki after task.

---

### Flow 4: Crash-Safe Session Resume

```text
1. const session = createFileSystemSessionStore({ path: '~/.agentsy/sessions' })
2. const loop = createAgentLoop({ model, tools, sessionStore: session })
3. // Process crashes mid-execution
4. const loop2 = createAgentLoop({ model, tools, sessionStore: session })
5. await loop2.resume(sessionId)
   // StreamSnapshot checkpoint loaded, execution continues from last safe state
```

Expected behavior: session resumes from last persisted checkpoint. User message is always recoverable (blocking write). No duplicate tool executions (idempotency via session replay).

---

### Flow 5: MCP Server Integration

```text
1. npm install @agentsy/mcp
2. const mcp = createMCPOrchestrator({
     servers: [
       { name: 'filesystem', transport: 'stdio', command: 'npx', args: ['@modelcontextprotocol/server-filesystem', '.'] },
       { name: 'fetch', transport: 'stdio', command: 'npx', args: ['@modelcontextprotocol/server-fetch'], trustLevel: 'untrusted' }
     ]
   })
3. const tools = await mcp.listTools()
4. const loop = createAgentLoop({ model, tools })
```

Expected behavior: MCP tools proxied transparently. Untrusted server tools blocked from destructive operations via SEC-007.

---

## 9. Package Rationale

| Package                       | Rationale                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@agentsy/core`               | Zero-dep foundation — stream primitives, XML processing, structured output, SSE. Widest install base; must never pull in heavy deps. |
| `@agentsy/normalizers`        | Provider-specific wire format adaptation. Keeps `@agentsy/core` provider-agnostic.                                                   |
| `@agentsy/processor`          | Event state machine over normalized events. Event emission, per-message state tracking (ADR-003), lazy message creation (ADR-004).   |
| `@agentsy/orchestrator/agent` | The agent loop itself. Stop conditions, prepareStep, mergeCallbacks, tool dispatch orchestration, subagent spawning.                 |
| `@agentsy/adapters`           | Thin adapter layer for generic and VS Code integrations.                                                                             |
| `@agentsy/ag-ui`              | AG-UI protocol adapter — converts agent loop output to AG-UI events for front-end consumption.                                       |
| `@agentsy/runtime`            | Tool approval engine, sandbox enforcement, plugin/skill loading. The trust enforcement layer.                                        |
| `@agentsy/context-manager`    | Token budget monitoring and context compression. Plugs into agent loop via `beforeStep` hook.                                        |
| `@agentsy/cost-tracker`       | Real-time cost accumulation per model/provider. Optional budget enforcement.                                                         |
| `@agentsy/session`            | Durable session persistence (JSONL + atomic writes). Crash-safe resume (ADR-010).                                                    |
| `@agentsy/mcp`                | MCP 2025-06-18 client — server lifecycle, capability negotiation, WebSocket idle timeout (ADR-014), trust filtering.                 |
| `@agentsy/providers`          | Provider capability matrix and fallback chains. Router between model endpoints.                                                      |
| `@agentsy/memory`             | 3-layer memory (raw log → wiki synthesis → RAG injection). The Karpathy blended memory stack.                                        |
| `@agentsy/retrieval`          | Vector store abstraction over libSQL/Turso. Wiki page indexing and semantic search.                                                  |
| `@agentsy/telemetry`          | OpenTelemetry instrumentation — traces, spans, metrics. Lazy-loaded, zero cost when unused.                                          |
| `@agentsy/core` (shim)        | Backward compat. Re-exports all `@agentsy/*` APIs under existing import paths.                                                       |

---

## 10. Out of Scope (v0.3.0)

- React/Vue/Svelte UI hooks and components
- Visual DevTools panel
- Git-backed wiki versioning (WikiStore GitStore pattern — post-v0.3.0)
- FTS5 full-text search over raw event log (libSQL-native, low effort, deferred to X6)
- ACP (Agent Communication Protocol) SDK integration (not yet stable npm package)
- `worktree` and `remote` subagent spawn modes (post-v0.3.0 per SRC-1 analysis)
- Background task queue (DreamTask / LocalShellTask patterns — post-v0.3.0)
- Agent team coordinator (coordinator mode — post-v0.3.0)
- Serverless/hibernation execution backends (Daytona, Modal — SRC-3)

---

## 11. Risks & Assumptions

- **RISK-001**: npm org `@agentsy` may not be available. **Mitigation**: Verify org claim before MONO-0. (TASK-R0-001)
- **RISK-002**: Turborepo remote cache setup adds CI secret management complexity. **Mitigation**: Remote cache is opt-in; local cache works without configuration.
- **RISK-003**: libSQL Turso vector backend API may change between versions. **Mitigation**: Swappable backend interface (CON-007). Lock dep version in `packages/retrieval/package.json`.
- **RISK-004**: ACP standard not yet on npm — any ACP integration now would target an unstable spec. **Mitigation**: Monitor; defer to post-v0.3.0 (OQ-2).
- **RISK-005**: `isolated-vm` (TanStack code mode) requires Node 24+. **Mitigation**: Not used in agentsy core (CON-001: Node ≥22). Not a risk for this release.
- **ASSUMPTION-001**: Consumers are using TypeScript with strict mode. JavaScript consumers are supported via `d.ts` types but not a primary persona.
- **ASSUMPTION-002**: The primary deployment environment is Node.js server-side. Browser/Deno support is not a v0.3.0 goal.
- **ASSUMPTION-003**: MCP 2025-06-18 spec is stable enough to build against. (REQ-012.)

---

## 12. Related Specifications / Further Reading

- [agentsy-platform-v2.md](./agentsy-platform-v2.md) — complete implementation task plan
- [agentsy-prd-notes.md](./agentsy-prd-notes.md) — research findings with primary source citations
- [agentsy-tech.md](./agentsy-tech.md) — full TypeScript API design
- [agentsy-deep-dive-v1.md](./agentsy-deep-dive-v1.md) — 9-project synthesis analysis
- [MCP 2025-06-18 spec](https://spec.modelcontextprotocol.io)
- [Agent Skills open standard](https://github.com/github/awesome-copilot)
- [Karpathy blended memory architecture](https://karpathy.ai/memory)
