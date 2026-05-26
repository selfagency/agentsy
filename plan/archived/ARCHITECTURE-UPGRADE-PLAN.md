# Agentsy Architecture Upgrade Plan (Merged)

**Date:** 2026-05-25 (Merged from `.hermes/plans/2026-05-25_033145-arch-review-remediation.md` + external review)
**Status:** Active — Implementation in Progress

---

## Current Context

- Phase 1 (DOGFOOD-PLAN.md) complete — types audit, plugin contract, 8 IMPLEMENTATION-PLAN updates
- Phase 2 partial: Ink TUI components, provider request path, stream-to-events adapter built
- **A1 (Observability):** ✅ Complete — tracer singleton, runtime/provider instrumentation, console/OTLP/Langfuse exporters
- **A2 (Runtime Hooks):** ✅ Complete — 8-event HookRegistry, guardrail interfaces, interruption/checkpoint system

---

## P0: Foundation Prerequisites

### P0-1: Observability Package — ✅ COMPLETE

Built in `packages/observability/`:

- `src/tracer.ts` — OTel TracerProvider singleton
- `src/spans.ts` — SpanNames constants + `withSpan()` helper
- `src/instruments/runtime.ts` — Auto-instrument hook lifecycle
- `src/instruments/provider.ts` — Instrument LLM API calls (token counts, cost, model)
- `src/exporters/otlp.ts` — Batch OTLP HTTP exporter
- `src/exporters/console.ts` — Pretty-print spans to stdout
- `src/exporters/langfuse.ts` — Langfuse-specific adapter
- Subpath exports: `./instrumentation`, `./exporters`

### P0-2: Runtime Hook Taxonomy — ✅ COMPLETE

Built in `packages/runtime/src/`:

- `hooks/types.ts` — 8 event discriminated union: UserPromptSubmit, PreToolCall, PostToolCall, PreCompact, SubagentStop, Stop, PreResponse, PostResponse
- `hooks/registry.ts` — `createRuntimeHookRegistry()` with priority ordering, block chain, transform
- `guardrails/types.ts` — GuardrailResult, InputGuardrail, OutputGuardrail, ToolGuardrail
- `interruption.ts` — `createInterruption()` + `resumeFromCheckpoint()`
- `checkpoint.ts` — `checkpoint()`, `loadCheckpoint()`, `clearCheckpoint()`

### P0-3: Guardrails Redesign

**Why:** Current `@agentsy/guardrails` has two error classes and nothing else.

**What to build in `packages/guardrails/src/`:**

- `input-guardrail.ts` — `createInputGuardrail(name, check)` typed function interface
- `output-guardrail.ts` — `createOutputGuardrail(name, check)` post-model, same shape
- `tool-guardrail.ts` — `createToolGuardrail(name, preCheck, postCheck)` — wraps individual tools, registers into runtime HookRegistry
- `pipeline.ts` — `GuardrailPipeline` composing multiple guardrails: parallel or serial mode
- `prompt-injection.ts` — `createDRIFTGuard()` — DRIFT-style content isolation pattern matching + LLM-as-judge
- `rate-limiter.ts` — Token bucket rate limiter per-user/per-session
- `pii-scrubber.ts` — Regex + pattern-based PII detection (email, phone, SSN, API key patterns)

Built-in guardrails in `packages/runtime/src/guardrails/builtin/`:

- `secret-detection.ts` — Scans tool results for secret patterns before entering model context
- `prompt-injection.ts` — Heuristic classifier for injection patterns
- `pii-scrubbing.ts` — Replaces PII with redacted placeholders

Integration: Guardrails register into runtime HookRegistry. Results logged via observability. Pipeline consumed by CLI REPL.

### P0-4: Session Typed State

**Why:** Plain session state causes bugs where concurrent tool calls produce conflicting updates.

**What to build in `packages/session/src/`:**

- `state/schema.ts` — Zod-validated `SessionStateSchema` with version, sessionId, threadId, parent references, messages, toolCallQueue, checkpoints, pinnedMessageIds, metadata
- `state/reducers.ts` — Typed reducers per field: messages (append/replace/truncate), toolCallQueue, pinnedMessageIds, metadata
- `state/branching.ts` — `forkSession()` for session forking, two-level identity (session + thread)
- `pause.ts` — `PauseManager` for human-in-the-loop approval (requestApproval, listPending, resolve)
- `adapters/interface.ts` — `SessionStore` interface: load/save/delete/list/saveCheckpoint/loadCheckpoint/listCheckpoints
- `adapters/sqlite.ts` — better-sqlite3 implementation
- `adapters/memory.ts` — In-memory for testing

---

## P1: Secrets & Security Hardening

### P1-1: Credential Broker

**Why:** Static secret storage is insufficient for tool calls needing task-scoped short-lived credentials.

**What to build in `packages/secrets/src/`:**

- `broker/index.ts` — `CredentialBroker` class: `issue()`, `revoke()`, `listActive()`. Issues task-scoped credentials with TTL (default 5 min)
- `audit/index.ts` — `AuditLog` class: `append()`, `query()` for credential lifecycle events (issued, accessed, expired, revoked)
- `detection/index.ts` — `detectSecrets()` and `redactSecrets()` — pattern matching for API keys, tokens. Wired into PostToolCall hook
- Migration: `keytar` → `@napi-rs/keyring` for macOS keychain

---

## P2: Tool System MCP Compliance

### P2-1: Required Tool Annotations

**Why:** Tool annotations drive the approval UX. Without required annotations, CLI is unusable.

**What to update in `packages/tools/src/`:**

- Make `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` **required** on every `ToolDefinition`
- Add `pagination` support: `list(cursor?, limit?)` → `ToolListPage`
- Add `progress` notifications: `ProgressEmitter` class, wired into `ToolCallCtx`
- REPL kernel persistence: one kernel per session, opt-in `kernel.reset()`

### P2-2: MCP Spec Compliance

**What to update in `packages/mcp/src/`:**

- Audit types against MCP spec 2025-06-18
- Add `authorizationServerUrl`, structured content, `elicitation` capability
- Add `@modelcontextprotocol/sdk` wrappers: `createMcpClient()`, stdio + HTTP transports
- Remove JSON-RPC batching (removed in 2025-06-18)

---

## P3: Plugin System Security

### P3-1: Context-Injection Audit

**What to build in `packages/plugins/src/`:**

- `audit/context-injections.ts` — `ContextInjectionAudit` class: records every context contribution with contentHash, injectionPoint, pluginId. Never stores raw content.
- `skills/loader.ts` — SKILL.md convention: loads plugin skill descriptions, builds system prompt section (2000 char limit per plugin)
- `sandbox/index.ts` — `PluginSandbox` using `isolated-vm` (64MB memory limit, explicit host API exposure)

---

## P4: Provider & Retrieval Upgrades

### P4-1: Structured Output as First-Class Primitive

**What to build in `packages/providers/src/`:**

- Add `schema` parameter to `generate()` — when provided, use native structured output if available, fall back to retry loop with `safeParse()`
- `middleware/types.ts` — `ProviderMiddleware` interface: onRequest, onResponse, onError hooks
- `middleware/builtin/` — cost-tracker, semantic-cache (SQLite), retry (exponential backoff), circuit-breaker
- `capabilities/probe.ts` — Runtime capability discovery via probe request, 24-hour TTL cache

### P4-2: Full 4-Stage RAG Pipeline

**What to build in `packages/retrieval/src/`:**

- `query/processor.ts` — Query classification (factual/reasoning/creative/multi-hop) + HyDE rewriting
- `retrieval/hybrid.ts` — Hybrid sparse + dense retrieval with RRF fusion
- `reranking/index.ts` — Cross-encoder reranker (Cohere API or local BGE via ONNX)
- `context/builder.ts` — Lost-in-the-middle ordering, token budget, citation tracking
- `chunking/` — Hierarchical chunking (sentence-level + paragraph-level)

---

## P5: LLM Gateway Expansion

### P5-1: Gateway Routing & Caching

**What to build in `packages/gateway/src/`:**

- `routing/semantic.ts` — Semantic routing rules (simple-factual → cheap, code → powerful)
- `cache/semantic.ts` — Semantic cache with cosine similarity threshold (default 0.97)
- `audit/index.ts` — Unified audit log: provider, model version, tokens, cost, latency, cache hit, routing rule
- `config/models.ts` — Pinned model versions (resolve alias → exact version at request time)

---

## P6: CLI Agent Mode

### P6-1: Input Classification Pipeline

**What to build in `packages/cli/src/input/`:**

- `classifier.ts` — Classify input as slash_command, agent_task, conversation_continuation, clarification_response, empty
- `commands/slash/` — Router + handlers for /compact, /clear, /model, /tools, /history, /session, /plugins, /help
- CLI flags: `--continue`, `--resume <id>`, `--model`, `--provider`, `--json`, `--no-stream`
- `ui/` — Ink reducer architecture: App.tsx, store.ts, reducers.ts, components (MessageList, StreamingMessage, ToolCallCard, ProgressBar, PausePrompt, SlashCommandHelp)
- `non-interactive.ts` — NDJSON stdout renderer for `--json` and CI/scripted use

---

## P7: Config System Hardening

### P7-1: XDG + Schema Versioning

**What to build in `packages/config/src/`:**

- `paths.ts` — XDG Base Directory paths (~/.config/agentsy, ~/.local/share/agentsy, ~/.cache/agentsy)
- Project-level config: `.agentsy/config.json` walking up to git root, deep merge (arrays replace)
- `schema/versions/` — v1→v2→v3 migration runner
- Structural secret separation: no apiKey/token/password fields in config type

---

## P8: Memory System Completion

### P8-1: Fact Extraction & Memory-as-Tool

**What to build in `packages/memory/src/`:**

- `extraction/index.ts` — `FactExtractor`: extracts typed facts (preference, entity, procedure, constraint) from conversation turns
- Register `memory_append` and `memory_search` as always-available agent tools
- Compaction strategy: retrieval-augmented (not summarization). Non-pinned messages older than N turns → episodic store → semantic retrieval at turn start

---

## Cross-Cutting: Build & Dependency Wiring

### Turbo pipeline update

Add `@agentsy/observability` to build dependency graph. Update `turbo.json`.

### Package dependency additions

| Package | Add dependency |
|---|---|
| `@agentsy/runtime` | `@agentsy/observability`, `@agentsy/secrets` |
| `@agentsy/tools` | `@agentsy/observability`, `@agentsy/secrets` |
| `@agentsy/plugins` | `@agentsy/observability`, `isolated-vm` |
| `@agentsy/session` | `@agentsy/observability`, `better-sqlite3` (optional) |
| `@agentsy/retrieval` | `@agentsy/observability` |
| `@agentsy/memory` | `@agentsy/observability`, `@agentsy/retrieval` |
| `@agentsy/providers` | `@agentsy/observability` |
| `@agentsy/gateway` | `@agentsy/observability`, `@agentsy/providers` |
| `@agentsy/cli` | `@agentsy/observability`, `ink`, `react` |
| `@agentsy/secrets` | `@napi-rs/keyring` (replace `keytar`) |

---

## Implementation Order

```text
P0-3 (Guardrails)  →  P0-4 (Session Typed State)  →  P1 (Secrets)
  →  P2 (Tools + MCP)  →  P3 (Plugins)  →  P4 (Providers + Retrieval)
  →  P5 (Gateway)  →  P6 (CLI)  →  P7 (Config)  →  P8 (Memory)
```

**Currently at:** P0-3 (Guardrails) — next to implement.
