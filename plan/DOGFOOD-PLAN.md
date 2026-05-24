---
goal: Dogfood-first production implementation order for the final @agentsy CLI app
version: 2.1
date_created: 2026-05-15
last_updated: 2026-05-24
owner: agentsy-core
status: In progress
tags: [feature, architecture, cli, tui, runtime, providers, models, memory, retrieval, production]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the canonical production order for building `@agentsy` by dogfooding `@agentsy/cli` as early as possible. The sequence is intentionally vertical-slice first: establish a usable TUI chat loop immediately, then incrementally attach model selection, stream processing, tools, approvals, memory, retrieval, observability, integrations, and hardening until the CLI itself becomes the primary environment used to build and operate the rest of the platform.

## 1. Requirements & Constraints

- **REQ-001**: First shippable milestone must be a usable interactive TUI chat loop in `@agentsy/cli` (not a backend-only milestone).
- **REQ-002**: TUI milestone must stream responses through canonical pipeline (`@agentsy/providers` -> `@agentsy/core` -> `@agentsy/runtime` -> `@agentsy/renderers` -> `@agentsy/cli`).
- **REQ-003**: `@agentsy/models` must be integrated before multi-provider production routing is enabled.
- **REQ-004**: Destructive tool calls must remain approval-gated from first tool-enabled release onward.
- **REQ-005**: Session durability (`@agentsy/session`) must be enabled before memory/retrieval are marked production-ready.
- **REQ-006**: Memory injection must use deterministic XML context rules and budget-aware packing.
- **REQ-007**: Retrieval must be local-first by default and preserve source attribution.
- **REQ-008**: Observability must provide traceability for model, tool, memory, and approval events before GA.
- **REQ-030**: Cross-domain logging (CLI, runtime, orchestrator, tools, memory, providers, and UI adapters) must use a single structured logger contract based on `tslog` through `@agentsy/observability`.
- **REQ-031**: Network-facing integration and e2e suites should use MSW (`msw` v2) as the default HTTP mocking layer for deterministic cross-package tests.
- **REQ-009**: Every package in `packages/*` with a manifest must be explicitly covered by at least one implementation phase in this plan.
- **REQ-010**: Documentation and CLI help output must reflect actual shipped behavior at each milestone.
- **REQ-011**: All phases must preserve package boundaries from `plan/MASTER-IMPLEMENTATION-PLAN.md`.
- **REQ-012**: Final acceptance requires `pnpm check-types` and `pnpm test` monorepo green.
- **REQ-013**: `@agentsy/orchestrator` must be integrated before multi-step autonomous workflows are enabled in CLI.
- **REQ-014**: Hard token restriction and budget enforcement (`max_input`, `max_output`, `max_context`, per-turn/per-session spend) must be active before tool-autonomous mode.
- **REQ-015**: Prompt policy stack (`@agentsy/prompts`) must be integrated for deterministic system prompt composition and guardrail-ready prompt shaping.
- **REQ-016**: Plugin activation (`@agentsy/plugins`) must be policy-scoped and capability-filtered before third-party extensions are enabled.
- **REQ-017**: Secrets lifecycle (`@agentsy/secrets`) must be integrated into CLI setup/doctor flows before provider and tool production cut.
- **REQ-018**: The product must ship Ink-based components for chat dialog/transcript rendering, stream event visualization, document viewing, diff viewing, git worktree status, terminal-pane presentation, and chooser workflows, with canonical implementation ownership in `@agentsy/renderers/ink` and host composition in `@agentsy/cli`; the visual language should lean into a classic acid ANSI BBS aesthetic with chromed frames, semantic ANSI palettes, and motion-safe animation choices.
- **REQ-019**: Slash commands must be first-class user behavior with manifests/registry in `@agentsy/plugins`, discoverable help and input routing in `@agentsy/cli`, and policy-aware interception/integration through `@agentsy/orchestrator` and `@agentsy/runtime`.
- **REQ-024**: CLI command parsing, help/version/autocomplete, plugin loading, and command discovery should be standardized on `@oclif/core` conventions and the supported oclif plugin ecosystem.
- **REQ-025**: CLI presentation should incorporate Rune-style terminal patterns for frame-based banners, motion-safe ASCII scenes, and reactive status transitions, while preserving renderer ownership boundaries.
- **REQ-020**: User configuration must persist to `~/.agentsy/agentsy.yml`, support layered defaults/overrides, and be editable interactively from the CLI.
- **REQ-021**: Project-specific settings, instructions, and skills must be discoverable from the active workspace and merged into CLI/runtime behavior with explicit precedence rules.
- **REQ-022**: Provider/model search-select-refine flows must be owned by `@agentsy/models` and `@agentsy/providers`, exposed through Ink chooser components in `@agentsy/renderers`, and hosted interactively by `@agentsy/cli` rather than only static command flags.
- **REQ-023**: The chat input must support an `@` command/mention flow for inserting files and folders from the active project directory into context with preview, selection, and budget-aware expansion.
- **REQ-026**: Any package that is useful outside the framework must expose a framework-agnostic public API with typed entry points, stable exports, and external-usage documentation/examples so other projects can reuse it without reaching into host internals.
- **REQ-027**: Agentsy must ship a first-party official superagents plugin through the normal plugin system, while prepackaging it with `@agentsy/cli` for zero-config access.
- **REQ-028**: The official superagents plugin must expose at least three reusable modes: `research`, `plan`, and `agent`, each callable independently outside the CLI.
- **REQ-029**: The CLI must provide an agent-mode picker that lists bundled superagent modes together with user/project-installed modes discovered from `~/.agents`, project `.agents`, and `~/.config/agentsy`.
- **SEC-001**: No hardcoded credentials; all provider secrets via `@agentsy/secrets` and environment/keychain sources.
- **SEC-002**: Runtime must deny-by-default for high-impact actions and require explicit approval for destructive flows.
- **SEC-003**: Retrieved or model-generated content must be treated as untrusted input and sanitized at boundaries.
- **SEC-004**: Logs/traces must redact secret-like values and sensitive fields.
- **CON-001**: Keep protocol adaptation in `@agentsy/providers`; do not fold provider protocol logic into `@agentsy/core`.
- **CON-002**: Keep runtime execution policy in `@agentsy/runtime`; orchestration strategy remains in `@agentsy/orchestrator`.
- **CON-003**: Keep memory long-horizon concerns in `@agentsy/memory`; session continuity in `@agentsy/session`.
- **CON-004**: Keep TUI rendering concerns in `@agentsy/renderers` and command routing in `@agentsy/cli`.
- **CON-005**: Keep orchestration planning/mode-selection in `@agentsy/orchestrator`; runtime remains execution-only.
- **CON-006**: Keep token accounting and enforcement policies in `@agentsy/tokens`; avoid duplicate budget logic in CLI/runtime.
- **CON-007**: Keep durable user configuration ownership in `@agentsy/cli` with typed contracts via `@agentsy/types`; secrets remain in `@agentsy/secrets`, not plaintext config.
- **CON-008**: Orchestrator owns task-board semantics; when available, honker-backed local SQLite is the preferred queue/scheduling substrate; session snapshots active task/todo state; memory stores only promoted durable task knowledge.
- **CON-009**: Consumers must be able to choose orchestration persistence/scheduling backends: honker-backed SQLite by default, PostgreSQL and plaintext/file as supported persistence alternatives, and cron-compatible scheduling as an alternative driver.
- **CON-010**: Ink component implementation belongs in `@agentsy/renderers`; `@agentsy/cli` owns shell composition, keybindings, focus management, and pane routing only.
- **CON-011**: Slash-command manifests, discovery, aliases, and registry belong in `@agentsy/plugins`; `@agentsy/cli` owns input/help UX and `@agentsy/orchestrator` owns pre-model `/` interception semantics.
- **CON-012**: Provider/model chooser data contracts belong in `@agentsy/models` and `@agentsy/providers`; `@agentsy/renderers` owns chooser widgets; `@agentsy/cli` owns workflow composition and operator interaction.
- **CON-013**: `@oclif/core` owns command parsing/lifecycle, plugin discovery, autocomplete, help/version, and update-related CLI behaviors; `@agentsy/cli` should extend it rather than duplicate it.
- **CON-014**: Rune-style motion and banners remain presentation concerns layered over `@agentsy/renderers`, not command logic.
- **CON-015**: Superagent mode definitions, manifests, provenance, and discovery belong in `@agentsy/plugins`; the CLI may prepackage the official plugin but must consume it through the same registry path as external plugins.
- **CON-016**: The agent-mode picker UI belongs in `@agentsy/renderers`; `@agentsy/cli` owns workflow composition, mode persistence, and command routing only.
- **CON-017**: Package code should emit structured logs through the shared observability logger interface (tslog-backed) instead of ad hoc `console.*` usage in production paths.
- **QOS-001**: Interactive TUI first-token latency and streaming continuity must remain stable through each phase.
- **QOS-002**: Context assembly must remain bounded by token budget policies from `@agentsy/tokens`.
- **GUD-001**: Vertical slices must be independently demoable from CLI at end of each phase.
- **PAT-001**: Dogfood progression pattern: build CLI capability -> use CLI capability to build next capability.
- **PAT-002**: Orchestrator-before-autonomy pattern: single-turn chat -> orchestrated multi-step plan/act loops -> constrained autonomous execution.
- **PAT-003**: Budget-first pattern: reject or downscope work when token/cost thresholds are exceeded.
- **PAT-004**: Shell-first workspace pattern: main chat pane coordinates auxiliary Ink panes for logs, terminal state, diffs, documents, and worktree status.
- **PAT-005**: Workspace-aware prompting pattern: global config -> user config -> workspace/project config -> session state -> inline slash-command override.

## 2. Implementation Steps

### Package Coverage Matrix (authoritative)

| Package                  | Coverage in this plan                                  |
| ------------------------ | ------------------------------------------------------ |
| `packages/cli`           | Phases 2-12                                            |
| `packages/connectors`    | Phase 10                                               |
| `packages/core`          | Phases 2, 7                                            |
| `packages/guardrails`    | Phases 5, 10                                           |
| `packages/mcp`           | Phase 10                                               |
| `packages/memory`        | Phases 7, 8                                            |
| `packages/load-balancer` | Phase 3.5                                              |
| `packages/models`        | Phase 3                                                |
| `packages/observability` | Phases 5, 9                                            |
| `packages/orchestrator`  | Phase 4                                                |
| `packages/plugins`       | Phase 4                                                |
| `packages/prompts`       | Phase 4                                                |
| `packages/providers`     | Phases 2, 3                                            |
| `packages/renderers`     | Phases 2, 5                                            |
| `packages/retrieval`     | Phases 8, 10                                           |
| `packages/runtime`       | Phases 2, 4, 5, 6, 7, 9                                |
| `packages/scripts`       | Phase 12                                               |
| `packages/secrets`       | Phase 4                                                |
| `packages/session`       | Phases 6, 7                                            |
| `packages/testing`       | Phases 8, 11                                           |
| `packages/tokens`        | Phases 1, 4, 9                                         |
| `packages/tools`         | Phases 5, 9                                            |
| `packages/types`         | Phase 1 (cross-package contract stabilization)         |
| `packages/ui`            | Phases 5, 9                                            |
| `packages/vscode`        | Phase 12 (cross-surface parity and release validation) |

### Implementation Phase 1

- GOAL-001: Establish baseline and lock dogfood architecture gates (already in progress/completed foundations).

| Task     | Description                                                                                                                                                                                                               | Completed | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-001 | Confirm canonical package boundaries and execution authority across `plan/MASTER-IMPLEMENTATION-PLAN.md`, `plan/IMPLEMENTATION-PRIORITY.md`, and package plan files.                                                      | ✅        | 2026-05-15 |
| TASK-002 | Confirm Phase 0 token compression APIs and CLI flows are validated in `packages/tokens`, `packages/core/context`, and `packages/cli`.                                                                                     | ✅        | 2026-05-15 |
| TASK-003 | Confirm Phase 1 memory foundation modules and tests in `packages/memory/src/{coordination,wiki,retrieval,scope,tools,observability}` are in place.                                                                        | ✅        | 2026-05-15 |
| TASK-018 | Normalize the CLI implementation plan around `@oclif/core` command/plugin lifecycle and Rune-style presentation layers.                                                                                                   | ✅        | 2026-05-15 |
| TASK-004 | Freeze a dogfood release contract document at `docs/developers/integration-copilot.md` + `docs/developer-guide.md` describing “CLI is primary integration surface”.                                                       |           |            |
| TASK-005 | Add milestone tracker section in `README.md` linking this plan as canonical execution order for production CLI delivery.                                                                                                  |           |            |
| TASK-006 | Add explicit CLI-first release checklist template in `packages/cli/README.md` for all subsequent phases.                                                                                                                  |           |            |
| TASK-067 | Add types-contract stabilization checkpoints for `packages/types` and downstream compile-time contract snapshots used by `core/providers/runtime/ui/renderers`.                                                           |           |            |
| TASK-090 | Audit manifest-bearing packages for reusable external APIs (`index` exports, typed factories, documented examples, and stable entry points) so framework-agnostic packages can be imported directly by external projects. |           |            |
| TASK-091 | Define the official superagents plugin contract in `packages/plugins` with reusable `research`, `plan`, and `agent` mode manifests, provenance metadata, and external-installation semantics.                             |           |            |

### Implementation Phase 2

- GOAL-002: Ship first dogfoodable TUI chat vertical slice (single provider, streaming, no tools yet).

| Task     | Description                                                                                                                                                                                                                                                   | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-007 | Implement/verify interactive shell loop in `packages/cli/src/commands/chat.ts` and input state manager in `packages/cli/src/tui/` (prompt, history, mode display).                                                                                            |           |      |
| TASK-072 | Implement renderer-owned Ink chat/dialog components in `packages/renderers/src/ink/components/` for transcript bubbles, assistant/user turns, streaming cursor, token meter, and status footer, then compose them into CLI panes.                             |           |      |
| TASK-073 | Implement renderer-owned Ink stream-event components in `packages/renderers/src/ink/components/stream-events/` for model deltas, thinking blocks, tool lifecycle events, and approval state changes, then route them through CLI state.                       |           |      |
| TASK-089 | Establish the shared acid ANSI BBS visual system in `packages/renderers/src/ink/` with semantic palette tokens, chromed frame primitives, ASCII banner support, reduced-motion fallbacks, and accessibility-safe output rules.                                |           |      |
| TASK-085 | Implement renderer-owned Ink provider/model chooser components in `packages/renderers/src/ink/components/model-picker/` for search, select, refine, capability filtering, and local/cloud scope toggling, hosted by CLI and fed by models/providers metadata. |           |      |
| TASK-008 | Wire provider request path in `packages/providers/src/` (minimum OpenAI-compatible + mock provider) with stable adapter interface consumed by runtime.                                                                                                        |           |      |
| TASK-009 | Wire stream normalization and chunk processing through `packages/core/src/{adapters,normalizers,processor}` into runtime events.                                                                                                                              |           |      |
| TASK-010 | Implement runtime turn execution path in `packages/runtime/src/loop/` for text-only model responses (no tool actions yet).                                                                                                                                    |           |      |
| TASK-011 | Implement renderer bridge in `packages/renderers/src/adapters/cli*` for streaming token output, partial delta rendering, and final summary/footer.                                                                                                            |           |      |
| TASK-012 | Add end-to-end test `packages/cli/src/e2e/chat-streaming.e2e.test.ts` validating streamed output from mock provider through full stack.                                                                                                                       |           |      |
| TASK-095 | Add shared MSW bootstrap and reusable HTTP handlers for provider-facing CLI/runtime integration tests to replace bespoke network stubs.                                                                                                                       |           |      |

### Implementation Phase 3

- GOAL-003: Enable model selection and provider routing inside dogfood TUI.

| Task     | Description                                                                                                                                                                                                                                                      | Completed | Date |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-013 | Integrate `@agentsy/models` selector into CLI chat path (`packages/cli/src/commands/chat.ts`, `packages/models/src/model-selector.ts`) with criteria-based model recommendation and renderer-facing chooser contracts.                                           |           |      |
| TASK-014 | Add provider capability/profile bridge between `packages/models/src/` and `packages/providers/src/` for local/cloud capability gating.                                                                                                                           |           |      |
| TASK-015 | Add slash-command manifests/registry in `packages/plugins/src/` plus CLI command routing surfaces for `/model`, `/provider`, `/capabilities`, `/help`, and `/status`.                                                                                            |           |      |
| TASK-086 | Add provider/model search-select-refine flows (`/model search`, `/model select`, `/model refine`, `/provider search`) backed by `@agentsy/models` scoring + `@agentsy/providers` probe APIs, exposed through renderer chooser components and CLI/slash surfaces. |           |      |
| TASK-016 | Implement local provider discovery/probing in `packages/models/src/` (Ollama, vLLM, LM Studio, Lemonade, Docker Model Runner, Jan, Apfel) with health/status output to TUI.                                                                                      |           |      |
| TASK-017 | Add first-party local adapter contract in `packages/providers/src/` for `node-llama-cpp` route option and selection metadata path.                                                                                                                               |           |      |
| TASK-018 | Add tests `packages/models/src/model-selector.integration.test.ts` and CLI tests for deterministic model routing/override behavior.                                                                                                                              |           |      |

### Implementation Phase 3.5 — Load balancer scaffold and CLI provider routing integration

- GOAL-003.5: Scaffold `@agentsy/load-balancer`, implement foundation (Phase 1 of LB plan), and wire `LoadBalancedClient` as the default provider client in the CLI.

| Task        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-LB-001 | Create `packages/load-balancer/` package scaffold: `package.json` (`@agentsy/load-balancer`), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`. Add to monorepo turbo pipeline.                                                                                                                                                                                                                                                                                                                                      |           |      |
| TASK-LB-002 | Define `ProviderProfileConfigSchema` (Zod) and `ProviderProfile` code interface in `packages/load-balancer/src/profiles/types.ts`. Types must be consistent with `NormalizerProvider` from `packages/providers/src/pipeline/create-pipeline.ts` and `ProviderCapabilities` from `packages/types/src/providers.ts`.                                                                                                                                                                                                        |           |      |
| TASK-LB-003 | Implement `fromConfig()` converter (`ProviderProfileConfig → ProviderProfile`) in `packages/load-balancer/src/profiles/from-config.ts`, `genericHeaderParser()`, `genericErrorClassifier()`, and `genericProbe()`.                                                                                                                                                                                                                                                                                                        |           |      |
| TASK-LB-004 | Implement `ProfileRegistry` (`register`, `get`, `detectFromUrl`, `detectFromHeaders`) in `packages/load-balancer/src/profiles/registry.ts`.                                                                                                                                                                                                                                                                                                                                                                               |           |      |
| TASK-LB-005 | Implement built-in provider profile configs in `packages/load-balancer/src/profiles/builtins/`: `generic-openai.ts` (covers 15+ providers), plus Tier 0 (`ollama-local.ts`, `zai.ts`), Tier 1 (`openai.ts`, `anthropic.ts`, `gemini.ts`, `bedrock.ts`, `mistral.ts`, `deepseek.ts`, `xai.ts`, `perplexity.ts`, `ollama-cloud.ts`), and Tier 2 (`deepinfra.ts`).                                                                                                                                                           |           |      |
| TASK-LB-006 | Implement `ModelAliasMap` (`packages/load-balancer/src/registry/model-alias.ts`) for logical model name → per-provider model name mapping. Seed with aliases for `gpt-4o`, `claude-opus-4`, `gemini-2.5-pro`, `llama-3.3-70b`. Consume `ModelSelector` from `packages/models/src/index.ts` to inform routing weights.                                                                                                                                                                                                     |           |      |
| TASK-LB-007 | Implement `ProviderRegistry` (`packages/load-balancer/src/registry/index.ts`) that creates a `UniversalClient` instance (from `packages/providers/src/universal-client/client.ts`) per provider entry. Entries are sourced from `LoadBalancerConfig.providers` after profile resolution. Wire API key retrieval via `@agentsy/secrets` keychain — **never accept raw keys in config at runtime**.                                                                                                                         |           |      |
| TASK-LB-008 | Implement the `LoadBalancedClient` interface (`packages/load-balancer/src/client.ts`) as a drop-in replacement for `UniversalClient`. Phase 3.5 implementation: single-provider passthrough with `getRoutingState()`, `markProviderUnhealthy()`, `markProviderHealthy()`, `getUsageSnapshot()`, and `shutdown()` stubs returning safe no-ops.                                                                                                                                                                             |           |      |
| TASK-LB-009 | Define `LoadBalancerConfigSchema` (Zod) in `packages/load-balancer/src/config.ts` covering: `providers` (array of `ProviderEntrySchema`), `strategy` (`StrategyNameSchema` — default `adaptive`), `model` (alias string), `circuitBreaker` (`CircuitBreakerConfigSchema`), `retry` (`RetryConfigSchema`). Re-export `ProviderRetryPolicy` from `packages/types` or `packages/providers` rather than re-defining it.                                                                                                       |           |      |
| TASK-LB-010 | Update `packages/cli/src/providers/resolve-provider.ts` (TASK-008-A) to call `createLoadBalancedClient(config)` instead of `createUniversalClient()` directly. The `LoadBalancerConfig` is built from the CLI config's `providers` array (supporting multiple entries per model). Fall back to single-provider `LoadBalancedClient` when only one provider is configured — behaviour is identical.                                                                                                                        |           |      |
| TASK-LB-011 | Implement `CircuitBreaker` state machine (CLOSED/OPEN/HALF-OPEN), `HealthTracker` (error counting, latency tracking), and `LatencyTracker` (rolling percentile window) in `packages/load-balancer/src/health/`. Wire health-aware provider filtering into the selection pipeline. Reuse `ProviderErrorCode.RateLimited` from `packages/vscode/src/types/errors.ts` and `STATUS_TO_ERROR_CODE` from `packages/vscode/src/error-handling/error-mapper.ts` for error classification.                                         |           |      |
| TASK-LB-012 | Implement `parseRateLimitHeaders()` for OpenAI, Anthropic, Meta, and generic profiles in `packages/load-balancer/src/usage/header-parser.ts`. Create `__tests__/fixtures/header-samples.ts` with real header examples. Implement `LocalCounter` (RPM/TPM/concurrency window), `UsageTracker`, and `QuotaChecker` (pre-flight quota validation) in `packages/load-balancer/src/usage/`.                                                                                                                                    |           |      |
| TASK-LB-013 | Implement all six routing strategies in `packages/load-balancer/src/strategies/`: `RoundRobinStrategy`, `WeightedStrategy`, `LeastConnectionsStrategy`, `LatencyBasedStrategy`, `PriorityFallbackStrategy`, `CostBasedStrategy`, and `AdaptiveStrategy` (composite scorer). Strategy is selected via `LoadBalancerConfig.strategy`. Adaptive is the default.                                                                                                                                                              |           |      |
| TASK-LB-014 | Implement `retryWithFailover()` and `retryStreamWithFailover()` in `packages/load-balancer/src/retry/`. Reuse `retry()` from `packages/core/src/retry/index.ts` for exponential backoff. Throw `AllProvidersExhaustedError` (with full diagnostic payload) when all providers fail. Wire into `LoadBalancedClient.complete()` and `LoadBalancedClient.stream()`.                                                                                                                                                          |           |      |
| TASK-LB-015 | Implement active usage probing (`packages/load-balancer/src/probes/`) using the `usageProbe` config field from each `ProviderProfileConfig`. Probes call provider usage APIs (e.g. DeepInfra `GET /v1/me/rate_limit`) on a configurable interval and update `UsageTracker`. Adding a new provider's probe requires only a 3-line config addition — no TypeScript code.                                                                                                                                                    |           |      |
| TASK-LB-016 | Add `agentsy lb status` command (`packages/cli/src/commands/lb-status.ts`) that calls `client.getRoutingState()` and `client.getUsageSnapshot()` and prints a color-coded per-provider table (circuit state, RPM/TPM remaining, average latency, error rate, last used).                                                                                                                                                                                                                                                  |           |      |
| TASK-LB-017 | Register `/lb status`, `/lb providers`, `/lb strategy <name>`, `/lb reset <providerId>` slash commands in `packages/plugins/src/slash-commands/registry.ts`. Handlers delegate to the session-scoped `LoadBalancedClient` instance.                                                                                                                                                                                                                                                                                       |           |      |
| TASK-LB-018 | Add `packages/load-balancer/src/__tests__/` unit tests covering: config validation and `fromConfig()` conversion; `ProfileRegistry` lookup; model alias resolution; circuit breaker state transitions; header parsing for all built-in providers (using `header-samples.ts` fixtures); quota check pre-flight; each routing strategy with varied provider states; `retryWithFailover` exhaustion producing `AllProvidersExhaustedError`.                                                                                  |           |      |
| TASK-LB-019 | Add `packages/cli/src/e2e/load-balancer.e2e.test.ts` covering: (a) primary provider returns 429 → automatic failover to secondary, transcript uninterrupted; (b) all providers exhausted → `AllProvidersExhaustedError` surfaces as user-facing message in CLI; (c) circuit breaker opens after 5 consecutive 500 errors → provider skipped; (d) `/lb strategy round-robin` changes strategy mid-session; (e) cost-based routing selects cheapest healthy provider. Use `packages/testing/src/msw/providers.ts` handlers. |           |      |
| TASK-LB-020 | Add `packages/load-balancer/src/index.ts` public exports: `createLoadBalancedClient`, `LoadBalancedClient`, `LoadBalancerConfig`, `LoadBalancerConfigSchema`, `ProviderEntry`, `RoutingState`, `ProviderStatus`, `ProviderUsageSnapshot`, `StrategyName`, `AllProvidersExhaustedError`. Add TSDoc to all public symbols. Add `packages/load-balancer/README.md` with migration guide (from direct `UniversalClient` to `LoadBalancedClient`), zero-config example, and multi-key failover configuration example.          |           |      |

### Implementation Phase 4

- GOAL-004: Add orchestration control plane and hard token-governance restrictions before autonomous tool usage.

| Task     | Description                                                                                                                                                                                                                  | Completed | Date |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-061 | Integrate orchestrator entrypoints in CLI/runtime path (`packages/orchestrator/src/*`, `packages/cli/src/commands/chat.ts`, `packages/runtime/src/loop/*`) for multi-step plan->act execution.                               |           |      |
| TASK-062 | Add explicit execution modes in CLI (`/mode single`, `/mode orchestrated`, `/mode autonomous`) backed by orchestrator policy profiles.                                                                                       |           |      |
| TASK-063 | Implement hard token restriction middleware using `@agentsy/tokens` in runtime request path (input/output/context caps + per-turn and per-session spend ceilings with fail-closed behavior).                                 |           |      |
| TASK-064 | Integrate prompt policy stack (`packages/prompts/src/*`) for deterministic prompt assembly and token-aware truncation/compression before provider calls.                                                                     |           |      |
| TASK-065 | Integrate plugin capability filtering (`packages/plugins/src/*`) and secrets bootstrap (`packages/secrets/src/*`) into CLI doctor/setup + runtime capability negotiation.                                                    |           |      |
| TASK-074 | Add plugin-registered slash commands for orchestration and budget control (`/mode`, `/budget`, `/prompt`, `/plugins`, `/doctor`) with explainable rejection messages, interactive help, and orchestrator-aware interception. |           |      |
| TASK-066 | Add orchestration + budget e2e tests (`packages/cli/src/e2e/orchestration-budget.e2e.test.ts`) covering over-budget rejection, downscoping, and deterministic orchestrator fallback paths.                                   |           |      |
| TASK-092 | Implement bundled-superagent registration so the official plugin ships with CLI defaults but still resolves through standard plugin discovery/loading paths.                                                                 |           |      |
| TASK-093 | Add agent-mode selection flows (`/agent-mode`, picker UI, config persistence) backed by plugin manifests and discovery from bundled, user, and project plugin directories.                                                   |           |      |

### Implementation Phase 5

- GOAL-005: Add tools + approvals so CLI can safely execute actions to build the product.

| Task     | Description                                                                                                                                                                                                                               | Completed | Date |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-019 | Implement baseline tool registry wiring in `packages/tools/src/` and `packages/runtime/src/loop/` (REPL + file ops + shell wrappers with schemas).                                                                                        |           |      |
| TASK-020 | Implement approval engine integration in `packages/runtime/src/approval/` and CLI approval prompts in `packages/cli/src/tui/approvals.ts`.                                                                                                |           |      |
| TASK-021 | Enforce deny-by-default high-impact command policy in runtime policy hooks (`packages/runtime/src/sandbox/` + `packages/guardrails` when promoted).                                                                                       |           |      |
| TASK-022 | Add renderer components for tool-call lifecycle (`packages/renderers/src/components/tool-calls.ts`) and CLI status panes for pending approvals.                                                                                           |           |      |
| TASK-075 | Implement renderer-owned Ink document viewer, diff viewer, git worktree status pane, and terminal pane components in `packages/renderers/src/ink/components/{document,diff,git,terminal}/`, then compose them into CLI workspace layouts. |           |      |
| TASK-076 | Add supporting data adapters in `packages/renderers` and `packages/ui` for structured document/diff/worktree/terminal events and pane state transitions.                                                                                  |           |      |
| TASK-087 | Implement `@` project path insertion flow in `packages/cli/src/tui/input/` and `packages/cli/src/commands/slash/` for fuzzy file/folder selection, preview, and context-budget-aware attachment.                                          |           |      |
| TASK-023 | Add e2e tests `packages/cli/src/e2e/tool-approval.e2e.test.ts` covering approve/reject paths and refusal behavior.                                                                                                                        |           |      |
| TASK-024 | Add audit event assertions in `packages/observability` tests ensuring tool calls and approvals are traceable with redacted payloads.                                                                                                      |           |      |
| TASK-068 | Add `packages/ui` parity adapters so tool/approval/memory states are consumable by UI store contracts used by CLI and other surfaces.                                                                                                     |           |      |

### Implementation Phase 6

- GOAL-006: Add session durability + resume so CLI dogfood sessions survive restarts and long-running work.

| Task     | Description                                                                                                                                                           | Completed | Date |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-025 | Integrate session snapshot save/resume in `packages/runtime/src/loop/` with `packages/session/src/{state,store,manager}`.                                             |           |      |
| TASK-026 | Add CLI commands `/resume`, `/sessions`, `/checkpoint`, `/status` in `packages/cli/src/commands/interactive-commands.ts`.                                             |           |      |
| TASK-027 | Persist reusable context metadata in session snapshots (`packages/session/src/core/session.ts`) for cache-aware context reuse on resume.                              |           |      |
| TASK-028 | Implement crash/stale-session detection display in CLI and recovery flows in runtime/session managers.                                                                |           |      |
| TASK-077 | Persist TUI workspace layout/session UI state (active pane, selected document/diff/worktree context, terminal view mode) through session snapshots where appropriate. |           |      |
| TASK-029 | Add e2e tests `packages/cli/src/e2e/session-resume.e2e.test.ts` for interruption and deterministic replay behavior.                                                   |           |      |
| TASK-030 | Add docs `docs/packages/session.md` + CLI README usage examples for checkpoint/resume workflows.                                                                      |           |      |

### Implementation Phase 7

- GOAL-007: Integrate memory capture/retrieval into live CLI chat so the product learns while being used.

| Task     | Description                                                                                                                                                                                           | Completed | Date |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-031 | Wire memory capture hooks in runtime post-turn pipeline (`packages/runtime/src/hooks/`) to `packages/memory/src/tools/memory-capture.ts`.                                                             |           |      |
| TASK-032 | Inject memory retrieval context via deterministic XML path (`packages/memory/src/retrieval/injection.ts` + core context assembly integration).                                                        |           |      |
| TASK-033 | Add CLI slash commands for memory operations (`/memory search`, `/memory list`, `/memory stats`, `/memory lint`) mapped to `packages/memory/src/tools/*`.                                             |           |      |
| TASK-034 | Enable cache-aware context segment reuse in core/runtime/session/memory boundary (`packages/core/src/context/*`, `packages/runtime/src/*`, `packages/session/src/*`, `packages/memory/src/reuse.ts`). |           |      |
| TASK-035 | Add cross-package integration tests validating memory scope isolation and prompt budget adherence during injection.                                                                                   |           |      |
| TASK-036 | Add docs updates for memory dogfood workflows in `docs/examples/stateful-ops-copilot.md` and `docs/packages/memory.md`.                                                                               |           |      |

### Implementation Phase 8

- GOAL-008: Add retrieval/RAG augmentation to CLI while preserving local-first defaults.

| Task     | Description                                                                                                                                                   | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-037 | Promote/finish retrieval package boundary (`packages/retrieval` manifest + exports) and wire into runtime context assembly contract.                          |           |      |
| TASK-038 | Integrate `packages/memory/src/retrieval/rag/*` with retrieval package adapters for unified query interface (local docs + semantic + optional web).           |           |      |
| TASK-039 | Add CLI retrieval commands (`/index`, `/search`, `/sources`) and interactive citations display in renderer output.                                            |           |      |
| TASK-040 | Enforce source allowlist and provenance tagging for web/document ingestion flows.                                                                             |           |      |
| TASK-041 | Add benchmark tests for retrieval quality uplift over vector-only baseline and citation coverage thresholds.                                                  |           |      |
| TASK-078 | Add document-open and diff-open slash commands that route retrieval/document results into the Ink document and diff viewers with keyboard navigation support. |           |      |
| TASK-042 | Add docs pages for CLI retrieval operations and operational fallback modes in `docs/examples/` and `docs/packages/retrieval.md`.                              |           |      |

### Implementation Phase 9

- GOAL-009: Add observability-first operations so CLI is production-debuggable and cost-governed.

| Task        | Description                                                                                                                                                                                                                                                                                                                                                                                                                     | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-043    | Standardize runtime/event tracing instrumentation across `packages/runtime`, `packages/orchestrator`, `packages/tools`, `packages/memory`, and `packages/providers`.                                                                                                                                                                                                                                                            |           |      |
| TASK-094    | Standardize structured logging across CLI/runtime/orchestrator/tools/memory/providers/ui adapters using `@agentsy/observability` logger factories backed by `tslog` sub-loggers and shared correlation fields.                                                                                                                                                                                                                  |           |      |
| TASK-044    | Add token/cost telemetry integration from `packages/tokens` into CLI status bar and post-turn summaries (input/output/cost/latency).                                                                                                                                                                                                                                                                                            |           |      |
| TASK-045    | Add `agentsy status --json`, `agentsy trace`, and UI-focused slash commands (`/trace`, `/events`, `/terminal`, `/worktrees`) for machine-readable operations and debugging.                                                                                                                                                                                                                                                     |           |      |
| TASK-046    | Add redaction processor defaults in `packages/observability/src/` ensuring traces are safe to export.                                                                                                                                                                                                                                                                                                                           |           |      |
| TASK-047    | Add regression tests for trace completeness (model selected, provider used, tools called, approvals requested, memory injected, retrieval source counts).                                                                                                                                                                                                                                                                       |           |      |
| TASK-048    | Update docs `docs/packages/observability.md` and examples for production incident diagnosis from CLI traces.                                                                                                                                                                                                                                                                                                                    |           |      |
| TASK-069    | Add `packages/ui` and `packages/tools` observability hooks so UI state transitions and tool lifecycle telemetry are emitted in the same trace graph.                                                                                                                                                                                                                                                                            |           |      |
| TASK-LB-OBS | Implement `MetricsCollector` in `packages/load-balancer/src/metrics/` with per-provider and per-model breakdowns (requests, tokens, latency percentiles, failover counts, circuit-open durations). Integrate with `@agentsy/observability` OpenTelemetry exporter when available. Add `getRoutingState()` and `getUsageSnapshot()` as structured log fields on every agent-loop turn via `packages/observability/src/audit.ts`. |           |      |

### Implementation Phase 10

- GOAL-010: Add persistent interactive user configuration and operator ergonomics.

| Task     | Description                                                                                                                                                                                            | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-079 | Implement typed config model in `packages/cli/src/config/` with load/save/merge support for defaults, workspace overrides, env overrides, and persisted file `~/.agentsy/agentsy.yml`.                 |           |      |
| TASK-080 | Add interactive config editor flow in CLI (`/config`, `/settings`, setup wizard) for editing provider defaults, model preferences, budgets, approval policy, pane layout, slash aliases, and UI prefs. |           |      |
| TASK-081 | Integrate config serialization safeguards so secrets are referenced via `@agentsy/secrets` and never persisted as plaintext in `~/.agentsy/agentsy.yml`.                                               |           |      |
| TASK-082 | Add CLI config doctor and migration logic for schema version upgrades and invalid setting detection.                                                                                                   |           |      |
| TASK-083 | Add tests for config layering, interactive editing, migration, and YAML round-trip correctness.                                                                                                        |           |      |
| TASK-084 | Document `~/.agentsy/agentsy.yml` schema, interactive editing workflow, and safe-secret handling in `packages/cli/README.md` and `docs/getting-started.md`.                                            |           |      |
| TASK-088 | Add workspace/project config discovery (`.agentsy/agentsy.yml`, `.agents/AGENTS.md`, `.github/copilot-instructions.md`, project skills dirs) and explicit precedence/merge diagnostics in CLI.         |           |      |

### Implementation Phase 11

- GOAL-011: Complete integration surfaces across all in-development packages and external bridges.

| Task     | Description                                                                                                                                                                    | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-049 | Finalize `packages/guardrails` integration and wire runtime policy hooks to it as canonical enforcement layer.                                                                 |           |      |
| TASK-050 | Finalize `packages/mcp` integration and CLI server management commands (`agentsy mcp list/add/remove/check`).                                                                  |           |      |
| TASK-051 | Finalize `packages/connectors` integration and expose minimal bridge commands for channel adapters (without blocking core CLI release).                                        |           |      |
| TASK-052 | Finalize `packages/retrieval` integration and align package exports/documentation with runtime memory-retrieval contracts.                                                     |           |      |
| TASK-053 | Add integration tests validating CLI -> runtime -> mcp -> tool loop path and guardrail interception path.                                                                      |           |      |
| TASK-096 | Ensure networked integration suites (providers/retrieval/connectors/memory-sync) run against MSW handlers with deterministic fixture payloads and explicit per-test overrides. |           |      |
| TASK-054 | Update `README.md`, `docs/packages.md`, and migration docs to reflect fully promoted package set and canonical boundaries.                                                     |           |      |

### Implementation Phase 12

- GOAL-012: Production hardening, release gating, and dogfood operations as default development workflow.

| Task     | Description                                                                                                                                                                                      | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-055 | Add release readiness checklist in `packages/scripts/src/release/` including package boundary checks, docs sync checks, and integration smoke tests.                                             |           |      |
| TASK-056 | Add CLI smoke-test suite (`packages/cli/src/e2e/smoke/`) for scripted end-to-end scenarios: fresh chat, provider switch, tool approval, resume, memory search, retrieval citation, trace export. |           |      |
| TASK-057 | Enforce CI gates in `.github/workflows/tests.yml` for monorepo `pnpm check-types`, `pnpm test`, and selected e2e smoke paths.                                                                    |           |      |
| TASK-058 | Add performance budget assertions for TUI responsiveness, first-token latency, and long-session memory/context bounds.                                                                           |           |      |
| TASK-059 | Publish final production runbook in `docs/developers/releasing.md` and `docs/developer-guide.md` defining CLI dogfood workflows for daily engineering operations.                                |           |      |
| TASK-060 | Record final closure artifact in `plan/PHASE-CLI-PRODUCTION-COMPLETION.md` with evidence links and sign-off checklist.                                                                           |           |      |
| TASK-070 | Add cross-surface parity validation for `packages/vscode` + `packages/ui` + `packages/cli` to ensure shared runtime/orchestrator behaviors and policy enforcement consistency.                   |           |      |
| TASK-071 | Add test-factory and fixture hardening in `packages/testing` used by all package-level e2e/smoke suites for deterministic cross-package validation.                                              |           |      |

## 3. Alternatives

- **ALT-001**: Build memory/retrieval first and CLI last. Rejected because it delays dogfooding and increases architecture drift risk.
- **ALT-002**: Build orchestration/plugins/connectors before interactive TUI loop. Rejected because there is no daily-use surface to validate behavior.
- **ALT-003**: Ship tools before approval engine. Rejected because it violates safety requirements for high-impact actions.
- **ALT-004**: Add cloud-first retrieval before local-first baseline. Rejected because privacy and offline resilience are core constraints.
- **ALT-005**: Treat some manifest-backed packages as optional and leave them unaccounted for. Rejected because plan completeness requires explicit ownership for every package.
- **ALT-006**: Keep observability for post-GA hardening. Rejected because production agent systems require traceability from first operational release.

## 4. Dependencies

- **DEP-001**: `packages/cli` interactive command router, shell composition layer, and host UX.
- **DEP-002**: `packages/renderers` CLI/TUI stream adapters, Ink component implementations, and chooser/pane widgets.
- **DEP-003**: `packages/runtime` loop, approvals, sandbox, and hook systems.
- **DEP-004**: `packages/providers` provider protocol adapters and universal client layer.
- **DEP-005**: `packages/models` selection and capability metadata.
- **DEP-006**: `packages/core` stream normalization, processing, and context assembly.
- **DEP-007**: `packages/session` snapshot persistence and resume semantics.
- **DEP-008**: `packages/memory` long-horizon memory store, retrieval, tools, scope, and reuse metadata.
- **DEP-009**: `packages/retrieval` indexing/search package promotion and integration.
- **DEP-010**: `packages/observability` telemetry and redaction processors.
- **DEP-026**: `tslog` as the universal structured logger implementation used by `@agentsy/observability`.
- **DEP-011**: `packages/tokens` token/cost accounting and compression utilities.
- **DEP-012**: `packages/tools` tool definition implementations and registry contracts.
- **DEP-013**: `packages/types` cross-package contract stability and discriminated union consistency.
- **DEP-014**: `packages/ui` store/event bridge parity with CLI/runtime/renderers.
- **DEP-015**: `packages/orchestrator` mode/policy planner and multi-step execution contracts.
- **DEP-016**: `packages/prompts` prompt composition and token-aware shaping policies.
- **DEP-017**: `packages/plugins` plugin capability registry and policy filters.
- **DEP-018**: `packages/secrets` keychain/env/file precedence and redaction helpers.
- **DEP-019**: `packages/testing` shared fixtures, scenario harnesses, and benchmark infrastructure.
- **DEP-027**: Shared MSW handler/server setup (`msw` v2) for Node/browser request interception in integration and e2e suites.
- **DEP-020**: `packages/scripts` release and validation automation used in Phase 12.
- **DEP-021**: `packages/vscode` parity validation with shared runtime/orchestrator behavior.
- **DEP-022**: Documentation surfaces in `README.md`, `docs/packages.md`, `docs/examples/*`, `docs/developers/*`.
- **DEP-023**: Ink-based CLI UI architecture and supporting TUI state contracts across `cli`, `renderers`, and `ui`.
- **DEP-024**: YAML configuration parsing/serialization with schema versioning for `~/.agentsy/agentsy.yml`.
- **DEP-025**: Workspace instruction/skill discovery rules across repository-local config, instruction files, and packaged skill manifests.

## 5. Files

- **FILE-001**: `plan/feature-cli-dogfood-production-order-1.md` — canonical dogfood-first production sequence.
- **FILE-002**: `packages/cli/src/commands/chat.ts` — interactive chat entrypoint and routing.
- **FILE-003**: `packages/cli/src/commands/interactive-commands.ts` — in-session command registry.
- **FILE-004**: `packages/cli/src/tui/*` — TUI view state, approvals, status, prompts.
- **FILE-005**: `packages/renderers/src/adapters/*` and `packages/renderers/src/components/*` — stream and tool rendering.
- **FILE-006**: `packages/runtime/src/{loop,approval,sandbox,hooks}/*` — execution engine and policy hooks.
- **FILE-007**: `packages/providers/src/*` — provider adapter/normalizer/protocol implementations.
- **FILE-008**: `packages/models/src/*` — selector, profiles, discovery, recommendation logic.
- **FILE-009**: `packages/core/src/{adapters,normalizers,processor,context}/*` — canonical processing and context assembly.
- **FILE-010**: `packages/session/src/*` — persistence and resume APIs.
- **FILE-011**: `packages/memory/src/{coordination,wiki,retrieval,scope,tools,reuse,observability}/*` — memory services.
- **FILE-012**: `packages/retrieval/src/*` — indexing/search package promotion and APIs.
- **FILE-013**: `packages/observability/src/*` — tracing metrics and redaction pipeline.
- **FILE-014**: `packages/tools/src/*` — concrete tool modules and runtime bridge.
- **FILE-015**: `packages/{guardrails,mcp,connectors,retrieval}/src/*` — integration completion artifacts (all manifest-backed).
- **FILE-016**: `.github/workflows/tests.yml` — production gates and smoke test integration.
- **FILE-017**: `docs/packages.md`, `docs/developer-guide.md`, `docs/developers/releasing.md`, `README.md` — docs alignment.
- **FILE-018**: `plan/PHASE-CLI-PRODUCTION-COMPLETION.md` — final closure evidence.
- **FILE-019**: `packages/orchestrator/src/*` — orchestration policies, mode routing, and workflow planner.
- **FILE-020**: `packages/tokens/src/*` + runtime budget middleware integration files — hard restriction enforcement.
- **FILE-021**: `packages/prompts/src/*` — prompt policy and token-aware composition modules.
- **FILE-022**: `packages/plugins/src/*` — plugin policy filtering and activation controls.
- **FILE-023**: `packages/secrets/src/*` — credential lifecycle and CLI setup integration.
- **FILE-024**: `packages/types/src/*` — shared type contracts and compatibility updates.
- **FILE-025**: `packages/ui/src/*` — UI store bridge and parity adapters.
- **FILE-026**: `packages/testing/src/*` + `packages/testing/fixtures/*` — deterministic shared test assets.
- **FILE-027**: `packages/scripts/src/*` — release/readiness automation updates.
- **FILE-028**: `packages/vscode/src/*` — cross-surface parity checkpoints.
- **FILE-029**: `packages/renderers/src/ink/components/*` — Ink chat, stream-event, chooser, document, diff, git, and terminal panes.
- **FILE-030**: `packages/cli/src/config/*` — persisted YAML configuration model, migrations, and editor flows.
- **FILE-031**: `~/.agentsy/agentsy.yml` — user configuration file path and schema target (documented artifact, not repository source).
- **FILE-032**: `packages/renderers/src/ink/components/model-picker/*` — provider/model search-select-refine Ink components.
- **FILE-033**: `packages/cli/src/tui/input/*` — `@` insertion parser, selector, and preview logic.

## 6. Testing

- **TEST-001**: CLI vertical-slice streaming e2e test (provider -> core -> runtime -> renderer -> cli).
- **TEST-002**: Model selector integration tests with deterministic provider/model routing outcomes.
- **TEST-003**: Tool execution + approval e2e tests including reject/timeout/abort paths.
- **TEST-004**: Session save/resume deterministic replay tests across interrupted turns.
- **TEST-005**: Memory capture/retrieval/scope isolation tests with injection budget constraints.
- **TEST-006**: Retrieval hybrid ranking + citation coverage benchmark tests.
- **TEST-007**: Observability trace completeness and redaction tests.
- **TEST-029**: Cross-domain logging contract tests verifying tslog-backed field shape consistency, correlation IDs, redaction, and sink routing across CLI/runtime/orchestrator/providers/tools.
- **TEST-030**: MSW handler contract tests ensuring provider/retrieval/connectors/sync request mocks remain deterministic and reusable across package suites.
- **TEST-008**: Guardrail policy interception tests for high-risk tool calls.
- **TEST-009**: MCP integration tests for server lifecycle and tool invocation path.
- **TEST-010**: Connectors adapter contract tests for message normalization and session mapping.
- **TEST-011**: CLI smoke suite for full user journeys in `packages/cli/src/e2e/smoke/`.
- **TEST-012**: Performance tests for TUI responsiveness, first-token latency, and long-session memory bounds.
- **TEST-013**: Package-level gates for touched packages: `pnpm --filter <package> check-types` and `pnpm --filter <package> test`.
- **TEST-014**: Monorepo gates: `pnpm check-types`, `pnpm test`, and any required e2e smoke pipeline stage.
- **TEST-015**: Orchestrator mode-transition tests (`single` -> `orchestrated` -> `autonomous`) with deterministic step planning assertions.
- **TEST-016**: Token restriction tests for hard cap enforcement, budget exhaustion behavior, and graceful degradation/downscoping.
- **TEST-017**: Prompt policy tests validating deterministic prompt stack order and truncation/compression invariants.
- **TEST-018**: Plugin and secrets integration tests ensuring denied capabilities stay blocked and missing credentials fail with actionable diagnostics.
- **TEST-019**: Types-compatibility tests ensuring package contract changes remain backward-compatible where required.
- **TEST-020**: UI-store parity tests validating runtime events map consistently to CLI and UI state models.
- **TEST-021**: VS Code parity tests validating shared runtime/orchestrator behavior across CLI and VS Code surfaces.
- **TEST-022**: Scripts-driven release gate tests ensuring automated readiness checks fail fast on missing package coverage.
- **TEST-023**: Ink component tests for transcript rendering, stream event rendering, document/diff panes, worktree status, and terminal pane behavior.
- **TEST-024**: Slash-command parsing/execution tests for help, config, budget, memory, retrieval, orchestration, and pane-control commands.
- **TEST-025**: YAML config persistence tests for layered config resolution, migrations, and secret redaction boundaries.
- **TEST-026**: Provider/model chooser tests for search, select, refine, and capability-filtered ranking behavior.
- **TEST-027**: `@` insertion tests for file/folder discovery, fuzzy matching, preview rendering, ignore rules, and context budget enforcement.
- **TEST-028**: Workspace instruction/skill precedence tests covering user config, project config, project instructions, and inline overrides.

## 7. Risks & Assumptions

- **RISK-001**: Early TUI coupling could lock poor UX patterns; mitigate via renderer abstraction and integration tests.
- **RISK-002**: Provider/model fragmentation could cause routing drift; mitigate via explicit selector contracts and snapshot tests.
- **RISK-003**: Tool capability growth could outpace policy controls; mitigate by blocking merge without approval-path tests.
- **RISK-004**: Memory/retrieval complexity could bloat context; mitigate with token budget gates and context packing assertions.
- **RISK-005**: Integration completion across the broader package surface may slip and delay final GA; mitigate by sequencing integration closure before final hardening phase.
- **RISK-006**: Cross-package integration churn may cause regressions; mitigate via strict monorepo gates and smoke suites.
- **RISK-007**: Orchestration policies may cause non-deterministic mode behavior; mitigate with explicit mode contracts and step-level snapshot tests.
- **RISK-008**: Budget enforcement too strict may degrade usability; mitigate with transparent CLI diagnostics and configurable but bounded policy profiles.
- **RISK-009**: Rich Ink surface area may become brittle; mitigate with pane-scoped components, UI-store contracts, and dedicated component tests.
- **RISK-010**: Interactive config editing may encourage plaintext secret storage; mitigate by forcing secret indirection through `@agentsy/secrets`.
- **RISK-011**: Project-specific instruction and skill precedence may become ambiguous; mitigate with explicit merge order, diagnostics, and test fixtures.
- **ASSUMPTION-001**: Phase 0/1 completion artifacts accurately reflect current branch baseline.
- **ASSUMPTION-002**: Existing package-level implementation plans remain aligned with master architecture boundaries.
- **ASSUMPTION-003**: Node 22 + pnpm + turbo workflow remains stable across all planned phases.
- **ASSUMPTION-004**: Local-first operation is mandatory baseline even when optional cloud integrations are enabled.

## 8. Related Specifications / Further Reading

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/IMPLEMENTATION-PRIORITY.md`
- `plan/PHASE-0-COMPLETION.md`
- `plan/PHASE-1-COMPLETION.md`
- `plan/2026-05-15-cache-aware-context-reuse.md`
- `packages/cli/IMPLEMENTATION-PLAN.md`
- `packages/runtime/IMPLEMENTATION-PLAN.md`
- `packages/providers/IMPLEMENTATION-PLAN.md`
- `packages/models/IMPLEMENTATION-PLAN.md`
- `packages/core/IMPLEMENTATION-PLAN.md`
- `packages/session/IMPLEMENTATION-PLAN.md`
- `packages/memory/IMPLEMENTATION-PLAN.md`
- `packages/retrieval/IMPLEMENTATION-PLAN.md`
- `packages/observability/IMPLEMENTATION-PLAN.md`
- `https://tslog.js.org`
- `https://mswjs.io/docs`
- `packages/tools/IMPLEMENTATION-PLAN.md`
- `packages/vscode/IMPLEMENTATION-PLAN.md`
- `docs/getting-started.md`
- `ETHICS.md`
- `SAFETY.md`
- `GOVERNANCE.md`
