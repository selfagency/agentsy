---
goal: @agentsy/providers production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-25
owner: providers-maintainers
status: In progress
tags: [feature, architecture, providers, adapters, routing]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/providers` as provider adapter/routing authority.

## 1. Requirements & Constraints

- **REQ-PROVIDERS-001**: Provider adapters normalize auth/request/stream/error behavior into stable contracts.
- **REQ-PROVIDERS-002**: Routing and fallback decisions expose deterministic reasoning metadata.
- **REQ-PROVIDERS-003**: Capability matrix is queryable by models/runtime/orchestrator.
- **REQ-PROVIDERS-004**: Timeout/retry/circuit-breaker policies are configurable per provider.
- **SEC-PROVIDERS-001**: Credentials are sourced via `@agentsy/secrets`; no plaintext embedding.
- **SEC-PROVIDERS-002**: Request/response logging redacts secret-like fields and emits through the shared tslog-backed observability logger contract.
- **CON-PROVIDERS-001**: Core stream normalization contracts remain consistent with `@agentsy/core`.
- **CON-PROVIDERS-002**: UI formatting and interaction concerns remain outside providers.
- **CON-PROVIDERS-003**: Provider network mocking in tests should be MSW-first (shared handlers) instead of custom per-test HTTP monkeypatching.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-PROVIDERS-001: Adapter and routing contract stabilization.

| Task               | Description                                                                 | Completed | Date |
| ------------------ | --------------------------------------------------------------------------- | --------- | ---- |
| TASK-PROVIDERS-001 | Stabilize provider profile/capability schema and routing decision envelope. |           |      |
| TASK-PROVIDERS-002 | Add typed tests for deterministic fallback and override behavior.           |           |      |
| TASK-PROVIDERS-003 | Document boundaries with models/core/runtime/secrets packages.              |           |      |

### Implementation Phase 2

- GOAL-PROVIDERS-002: Core provider infrastructure completion.

| Task               | Description                                                                                                                                                                               | Completed  | Date       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- |
| TASK-PROVIDERS-004 | Finalize first-party provider adapters and protocol bridges.                                                                                                                              | ✅         | 2026-05-17 |
| TASK-PROVIDERS-005 | Implement retries/timeouts/circuit-breakers and capability probes.                                                                                                                        | ⚠️ partial | 2026-05-17 |
| TASK-PROVIDERS-006 | Implement deterministic mock providers and MSW handler sets for provider API surfaces.                                                                                                    | ✅         | 2026-05-17 |
| TASK-008           | DOGFOOD Phase 2: Wire provider request path (minimum OpenAI-compatible + mock provider) with stable adapter interface consumed by runtime. Mock provider built in cli (createMockClient). | ⚠️ partial | 2026-05-25 |

### Implementation Phase 2.5 — LLM Gateway Integration (DOGFOOD Phase 3.5)

- GOAL-PROVIDERS-002.5: Integrate with `@agentsy/llm-gateway` for multi-provider routing, circuit-breaking, and failover.

| Task               | Description                                                                                                                                                              | Completed | Date |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-LB-010        | Update `packages/cli/src/providers/resolve-provider.ts` to call `createLLMGatewayClient(config)` instead of `createUniversalClient()` directly.                          |           |      |
| TASK-PROVIDERS-013 | Expose provider metadata (capabilities, auth state, connectivity, protocol family) in structured form consumed by `@agentsy/models` and `@agentsy/renderers` chooser UI. |           |      |

### Implementation Phase 3

- GOAL-PROVIDERS-003: Integration and observability wiring.

| Task               | Description                                                                                                            | Completed | Date |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-PROVIDERS-007 | Integrate runtime/core streaming and models selection pathways.                                                        |           |      |
| TASK-PROVIDERS-008 | Add integration tests for provider routing and failover.                                                               |           |      |
| TASK-PROVIDERS-009 | Emit provider telemetry with redaction-safe defaults through `@agentsy/observability` logger factories (tslog-backed). |           |      |

### Implementation Phase 4

- GOAL-PROVIDERS-004: Hardening and release gates.

| Task               | Description                                                               | Completed | Date |
| ------------------ | ------------------------------------------------------------------------- | --------- | ---- |
| TASK-PROVIDERS-010 | Add regression/perf tests for streaming correctness and timeout behavior. |           |      |
| TASK-PROVIDERS-011 | Align docs and operational guidance with shipped adapters.                |           |      |
| TASK-PROVIDERS-012 | Pass package and monorepo release gates.                                  |           |      |

## 3. Acceptance Criteria

- **ACC-PROVIDERS-001**: Adapter/routing contracts are stable and test-validated.
- **ACC-PROVIDERS-002**: Runtime/models/core integrations pass end-to-end tests.
- **ACC-PROVIDERS-003**: Security and release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `https://mswjs.io/docs`
- `https://tslog.js.org`
- `docs/packages/providers.md`
- `packages/providers/README.md`
- `packages/providers/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/providers — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/providers` is the provider strategy and capability layer for model routing, fallback chains, and provider feature metadata.

Following the latest topology, provider adapters/normalizers also exist in `@agentsy/core/*` subpaths for stream-pipeline compatibility; `@agentsy/providers` remains authoritative for capability matrix, routing policy, and fallback strategy.

### Ecosystem Sketch (Post-Consolidation)

```text
[ @agentsy/runtime ]    [ @agentsy/orchestrator ]
         |                   |
         v                   v
   [ @agentsy/core/universal-client ]
             |
    +--------+--------+
    |        |        |
    v        v        v
[ /adapters ] [ /normalizers ] [ /processor ]
```

## Migration Guidance

Use `@agentsy/providers` for provider selection, capabilities, and fallback routing.

Use `@agentsy/core/*` subpaths for low-level stream adaptation and normalization:

1. **`@agentsy/core/adapters`**: request shaping and wire format transformation.
2. **`@agentsy/core/normalizers`**: standardizing LLM response streams.
3. **`@agentsy/core/universal-client`**: provider-agnostic completion interface.

### Caching and Request Shaping

Prompt caching belongs at the provider boundary. Keep the provider strategy layer responsible for deciding when a request is stable enough to cache and which cache provider to use.

- Prefer CacheLLM-style middleware for stable system prompts, tool schemas, and long conversation prefixes.
- Defer to provider-native cache features when they are a better fit, but keep the policy selection centralized here.
- Never let caching leak into stream normalization or runtime orchestration; those layers should only see normal provider requests and responses.

Recommended cacheable segments:

1. system prompt and policy preamble
2. stable tool definitions and schemas
3. repeated conversation prefixes
4. provider metadata and static routing hints

## Detailed Functionality (Moved to Core)

The following capabilities have been successfully migrated to `@agentsy/core`:

- **Provider Capability Matrix**: Standardized detection of vision, tools, and streaming support.
- **Universal Fetch Wrapper**: Automatic routing and authentication for supported providers.
- **Provider Registry**: A centralized place to add or configure new LLM backends.

## Key Interfaces (Moved to Types)

- `CompletionRequest`
- `CompletionResponse`
- `NormalizedChunk`
- `ProviderCapabilities`

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Provider strategy contracts

```typescript
interface ProviderCapabilities {
  contextWindow: number;
  supportsVision: boolean;
  supportsToolCalling: boolean;
  supportsStreaming: boolean;
  supportsThinking?: boolean;
  supportsCaching?: boolean;
}

interface ProviderStrategy {
  getClient(requirements?: Partial<ProviderCapabilities>): ModelClient;
  withFallback(options: FallbackChainOptions): ModelClient;
  getCapabilities(modelId: string): ProviderCapabilities | undefined;
}
```

### Ownership notes

- Capability matrix and fallback-chain policy belong in `@agentsy/providers`.
- Stream wire adaptation and delta normalization remain exposed from `@agentsy/core` integration subpaths.
- Keep provider dependency graph acyclic and avoid importing orchestration/runtime concerns into provider strategy code.
- Prompt caching strategy selection belongs here as well, so provider-specific cache controls remain consistent across adapters.

---

## Architecture Decision Snapshot (migrated from `plan/DECISION-LOG.md`)

- Provider-layer consolidation direction remains locked: provider-specific normalization/adapters stay under provider boundaries.
- Tooling and provider concerns must not be conflated in interfaces.
- Migration policy remains direct rename/consolidation with import rewrites, not wrapper alias packages.

---

## Provider Capability Matrix (migrated from `plan/provider-capability-matrix.md`)

| Provider     | Base Protocol            | Tool Call Delta                  | Reasoning/Thinking Field | Strict Schema | Notes                                   |
| ------------ | ------------------------ | -------------------------------- | ------------------------ | ------------- | --------------------------------------- |
| DeepSeek     | OpenAI-compatible        | `tool_calls` + `delta`           | `reasoning_content`      | Yes           | Capture reasoning deltas explicitly     |
| Kimi         | OpenAI-compatible        | `tool_calls` + `delta` + `index` | N/A                      | Yes           | Preserve delta index ordering           |
| Qwen         | OpenAI/Ollama-compatible | `tool_calls` + `delta`           | Inline tags in `content` | Partial       | Parse `<tool_call>` from content safely |
| Llama (Meta) | OpenAI/Ollama-compatible | `tool_calls` + `delta`           | N/A                      | No            | Standard OpenAI-compatible behavior     |
| Granite      | OpenAI-compatible        | `tool_calls` + `delta`           | N/A                      | No            | IBM Granite compatibility path          |

### Capability routing metadata

Expose capability metadata per provider/model for the LLM Gateway's routing layer: supported tool types, context window, modalities (text/image/audio), streaming support, rate limits, latency percentile data.

### Cross-ref LLM Gateway

This package provides the model capability metadata that feeds the LLM Gateway's routing decisions. The Gateway does not live in this package — it consumes provider metadata via a narrow interface in @agentsy/types.

### Internal contract mapping

- `StreamChunk.thinking` must capture DeepSeek `reasoning_content`.
- `nativeToolCallDeltas` must preserve indexed deltas (`index`) for Kimi/OpenAI-style streaming.
- Outbound adapter role support remains: `system`, `user`, `assistant`, `tool`.
- Universal outbound part model remains: text, image, tool-call, tool-result.

## Sources Synthesized

`agentsy-connectors-v1.md`, `provider-capability-matrix.md`, `agentsy-tech.md`, `DECISION-LOG.md`, `research/AI-PLATFORMS-ANALYSIS.md`, `research/LLM-INTEGRATION-ANALYSIS.md`, `packages/providers/IMPLEMENTATION-PLAN.md`.

---

## Local LLM Provider Expansion Plan (2026-05-15)

### Why this is in `@agentsy/providers`

Per canonical boundaries:

- `@agentsy/models` owns model/provider metadata, scoring, and route recommendation.
- `@agentsy/providers` owns concrete protocol adapters and runtime transport behavior.

Therefore, all local LLM protocol implementations live here.

Additionally, `@agentsy/providers` owns **model source adapters** used by the runner to search/fetch open model artifacts from registries (while `@agentsy/models` owns scoring/recommendation).

### Model source adapters for Agentsy runner (NEW)

1. **Hugging Face source adapter**
   - search models compatible with local apps (especially llama.cpp/GGUF workflows)
   - resolve artifact metadata (format, quantization, size, license)
   - emit executable fetch plans for runtime download flow

2. **Ollama source adapter**
   - search/pull models from Ollama registry and inspect local manifests
   - map Ollama model references to local artifact metadata
   - optional conversion path planning via `OllamaToGGUF` when direct GGUF export is needed

3. **Open provider source adapter (pluggable)**
   - adapter interface for additional open registries/providers
   - normalized source contract for search, inspect, and fetch execution

### llama-swap integration guidance (NEW)

Treat `llama-swap` as the **local hot-swap proxy** for multi-backend execution, not as a model source.

Use it when a selected local model can be served by multiple interchangeable backends or when the runtime wants to hot-swap the upstream server behind a single OpenAI/Anthropic-compatible endpoint.

Core facts to preserve in the provider boundary:

- one config file controls model → command/runtime mapping
- supports OpenAI-compatible endpoints (`/v1/chat/completions`, `/v1/responses`, `/v1/models`, embeddings, audio, images)
- supports Anthropic-compatible endpoints (`/v1/messages`, token counting)
- exposes operational endpoints for running models, logs, health, and metrics
- can apply request filters (`stripParams`, `setParams`, `setParamsByID`) before forwarding

Implementation guidance:

1. Add a `llama-swap` runtime adapter that renders a config entry from a local recommendation plan.
2. Treat the upstream server command as opaque process metadata owned by runtime, not the provider layer.
3. Expose compatibility checks so the runtime can decide whether to route through llama-swap or talk directly to Ollama/vLLM/LM Studio/etc.
4. Preserve streaming behavior by disabling buffering in proxy integrations and by marking SSE responses as non-buffered.
5. Keep log/metrics passthrough available for observability and debugging.

### Required local provider adapters

1. **Ollama adapter**
   - Native Ollama API support (`/api/*`)
   - Optional OpenAI-compatible bridge mode if configured

2. **vLLM adapter**
   - OpenAI-compatible server support (`/v1/*`)
   - Extra body parameter pass-through support for vLLM-specific options

3. **LM Studio adapter**
   - OpenAI-compatible mode (`/v1/*`)
   - Optional native LM Studio API support (`/api/v1/*`) for model lifecycle ops

4. **Lemonade adapter**
   - OpenAI-compatible APIs including chat/completions/embeddings/responses where available

5. **Docker Model Runner adapter**
   - OpenAI-compatible engine endpoints
   - Optional explicit engine targeting (`llama.cpp`, `vllm`) when configured

6. **Jan adapter**
   - OpenAI-compatible server with required bearer token support

7. **Apfel adapter**
   - OpenAI-compatible local server (`/v1/*`) on macOS/Apple Silicon
   - Capability-aware constraints (single model profile, no embeddings support)

8. **Agentsy Local Llama adapter (NEW)**
   - Native local provider powered by `node-llama-cpp`

### New provider: Agentsy Local Llama (`node-llama-cpp`)

#### Scope

Implement a first-party provider adapter for fully local inference and embedding generation without HTTP dependency.

#### Core runtime primitives

- `getLlama(...)` for runtime/bootstrap
- `LlamaChatSession` for chat session execution
- `LlamaEmbeddingContext` for embeddings generation

#### Contract expectations

- streaming response chunk conversion into normalized provider chunks
- cancellation/abort signal support
- deterministic error taxonomy and retry classification
- capability advertisement: `supportsStreaming`, `supportsEmbeddings`, `supportsToolCalling` (model-dependent)
- GGUF compatibility checks before load (arch, quantization, context constraints)
- model provenance metadata capture (source, checksum, license)

#### Local model intake paths (fleshed out)

1. **Hugging Face GGUF direct path**
   - acquire GGUF artifact (or llama.cpp `-hf` shorthand execution plan)
   - validate file + metadata
   - register model in local runner catalog

2. **Ollama registry path**
   - acquire via `ollama pull` or use existing local model
   - for native llama runtime usage, optionally convert split blobs to GGUF via `OllamaToGGUF`
   - persist provenance marker indicating conversion source

3. **Local file path**
   - user-provided GGUF path
   - compatibility and trust checks prior to activation

### Delivery phases

**P1 — Adapter scaffolding + conformance tests**

- define local adapter interface shared by all local providers
- add fixture-backed protocol tests for OpenAI-compatible and Ollama-native paths

**P2 — External local adapters**

- implement adapters for Ollama, vLLM, LM Studio, Lemonade, Docker Model Runner, Jan, Apfel
- include health checks and model discovery contracts

**P2.5 — Runner source adapters**

- implement Hugging Face/Ollama/open-provider source adapters
- define retry, checksum validation, and partial-download resume semantics
- add adapter contracts shared with runtime acquisition service

**P2.6 — llama-swap runtime adapter**

- add config rendering for model-to-backend swap rules
- add request/response compatibility checks for OpenAI and Anthropic endpoints
- add log and health endpoint wiring for runtime diagnostics

**P3 — node-llama-cpp first-party adapter**

- implement chat/streaming completion path
- add embeddings support
- add lifecycle management (`load`, `ready`, `dispose`)

**P4 — Fallback and policy integration**

- integrate local adapter chain fallback policies
- expose latency/error/capability metrics to `@agentsy/observability`

### Testing and quality gates

1. Contract tests for each local adapter against frozen API fixtures.
2. Live smoke tests behind optional env flags (`LOCAL_PROVIDER_SMOKE=1`).
3. No-network deterministic test suite by default in CI.
4. Cross-package compatibility tests with `@agentsy/models` provider profile contracts.

### CLI-facing provider discovery support (NEW)

`@agentsy/providers` must expose health, auth posture, and protocol metadata in a shape that the CLI can present inside provider search/select/refine Ink components.

Required metadata for chooser UI:

- connectivity state
- auth requirement state
- streaming/tools/embeddings support
- local/cloud provenance
- protocol family (`openai-compatible`, `ollama-native`, etc.)
- last probe latency and last error summary

This package should not render UI, but it must make provider refinement possible by returning structured probe and capability summaries to `@agentsy/models` and `@agentsy/cli`.

### Documentation updates required with implementation

- `docs/packages/providers.md`: local provider matrix + config examples
- `docs/migration/*`: provider migration guide for local-first setups
- examples: one end-to-end local-only workflow (Jan/Ollama/vLLM) + one native node-llama-cpp workflow
- examples: one end-to-end model acquisition workflow (Hugging Face -> GGUF -> agentsy-local-llama)
- examples: one local hot-swap workflow (llama-swap behind a single OpenAI-compatible endpoint)
