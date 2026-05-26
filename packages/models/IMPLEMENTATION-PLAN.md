---
goal: @agentsy/models production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: models-maintainers
status: In progress
tags: [feature, architecture, models, selection, routing]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/models` as model catalog and recommendation authority.

## 1. Requirements & Constraints

- **REQ-MODELS-001**: Model catalog normalization includes capabilities, limits, pricing, and context metadata.
- **REQ-MODELS-002**: Selection/ranking pipeline is deterministic and explainable.
- **REQ-MODELS-003**: Local provider probing surfaces health/status metadata for chooser workflows.
- **REQ-MODELS-004**: Selection outputs integrate with CLI slash/chooser flows and orchestration policy.
- **SEC-MODELS-001**: Probe and catalog telemetry redacts private endpoints and secret-bearing fields.
- **SEC-MODELS-002**: Untrusted metadata updates are validated before merge.
- **CON-MODELS-001**: Transport/protocol handling remains in `@agentsy/providers`.
- **CON-MODELS-002**: Runtime execution policy remains outside model selection logic.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-MODELS-001: Contract stabilization.

| Task            | Description                                                                    | Completed | Date |
| --------------- | ------------------------------------------------------------------------------ | --------- | ---- |
| TASK-MODELS-001 | Stabilize model/profile/capability contracts and recommendation output schema. |           |      |
| TASK-MODELS-002 | Add typed tests for deterministic ranking and override precedence.             |           |      |
| TASK-MODELS-003 | Document boundaries with providers/runtime/orchestrator/CLI.                   |           |      |

### Implementation Phase 2

- GOAL-MODELS-002: Core model intelligence completion.

| Task            | Description                                                            | Completed  | Date       |
| --------------- | ---------------------------------------------------------------------- | ---------- | ---------- |
| TASK-MODELS-004 | Finalize model catalog ingestion, enrichment, and normalization logic. | ✅         | 2026-05-17 |
| TASK-MODELS-005 | Implement local-first recommendation and capability filtering paths.   | ✅         | 2026-05-17 |
| TASK-MODELS-006 | Implement provider probing and health signal ingestion.                | ⚠️ partial | 2026-05-17 |

### Implementation Phase 3

- GOAL-MODELS-003: Integration and UX composition.

| Task            | Description                                                            | Completed | Date |
| --------------- | ---------------------------------------------------------------------- | --------- | ---- |
| TASK-MODELS-007 | Integrate chooser/search-select-refine flows with CLI/renderers.       |           |      |
| TASK-MODELS-008 | Validate provider bridge and fallback metadata integration.            |           |      |
| TASK-MODELS-009 | Add integration tests for deterministic route recommendation outcomes. |           |      |

### Implementation Phase 4

- GOAL-MODELS-004: Hardening and release gates.

| Task            | Description                                                    | Completed | Date |
| --------------- | -------------------------------------------------------------- | --------- | ---- |
| TASK-MODELS-010 | Add regression/performance suites for catalog/scoring updates. |           |      |
| TASK-MODELS-011 | Align docs/examples and operator guidance.                     |           |      |
| TASK-MODELS-012 | Pass package and monorepo release gates.                       |           |      |

## 3. Acceptance Criteria

- **ACC-MODELS-001**: Selection/ranking behavior is deterministic and test-validated.
- **ACC-MODELS-002**: CLI/provider integrations are production-ready and documented.
- **ACC-MODELS-003**: Release gates pass with models suites green.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `packages/models/IMPLEMENTATION-PLAN.md`
- `packages/models/src/types.ts`
- `packages/models/src/local-recommendation.test.ts`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/models — Implementation Plan

Last updated: 2026-05-15

## Purpose

`@agentsy/models` is the model intelligence layer for Agentsy:

- model/provider catalog ingestion
- capability + cost-aware selection
- local-vs-remote routing recommendations
- normalized metadata for `@agentsy/orchestrator`

It remains **selection/catalog authority**, while transport/runtime adapters stay in `@agentsy/providers`.

## Architecture Boundary (Canonical)

```text
@agentsy/models        => catalog + scoring + route recommendation
@agentsy/providers     => provider adapters (HTTP/native), auth, streaming protocol handling
@agentsy/orchestrator  => policy + budget + workflow planning
@agentsy/runtime       => execution, approvals, tool loop semantics
```

### Ownership rules

1. `@agentsy/models` must not implement provider wire protocols directly.
2. `@agentsy/providers` owns request/response protocol implementations.
3. `@agentsy/models` publishes provider profile contracts consumed by `@agentsy/providers`.

## Current Source Layout

```text
packages/models/src/
  index.ts
  types.ts
  model-selector.test.ts
```

## Current Implementation Snapshot (as of 2026-05-15)

| Area                              | Status     | Notes                                   |
| --------------------------------- | ---------- | --------------------------------------- |
| models.dev fetch client           | ✅ partial | Live fetch + 24h temp-file cache exists |
| selector logic                    | ✅ partial | Requirement matching + scoring exists   |
| cost estimation                   | ✅ partial | Basic token/cost estimation exists      |
| provider profile system           | ❌ missing | Needed for local provider support       |
| local provider discovery          | ❌ missing | No endpoint probing/health yet          |
| deterministic offline fallback    | ❌ missing | Needs bundled baseline catalog snapshot |
| contract tests (no live internet) | ⚠️ partial | Tests currently depend on live API      |

## External Integration Targets (Models Layer)

### A) Primary cloud/global catalog source

- **models.dev API** (`https://models.dev/api.json`) for broad provider/model metadata.

### B) Required local provider families (new)

The models layer must include first-class profile support for:

1. **Ollama** (`/api/*`, local default `http://localhost:11434`)
2. **vLLM OpenAI-compatible server** (`/v1/*`, commonly `http://localhost:8000/v1`)
3. **LM Studio** (`/v1/*` OpenAI-compatible + `/api/v1/*` native)
4. **Lemonade Server** (OpenAI-compatible local API)
5. **Docker Model Runner** (OpenAI/Ollama/Anthropic compatible surfaces)
6. **Jan API Server** (OpenAI-compatible local API)
7. **Apfel** (OpenAI-compatible local API backed by Apple FoundationModels)
8. **Agentsy Local Llama Provider** (new, powered by `node-llama-cpp`)

## Local LLM Support: Canonical Provider Profile Contract

```ts
export type ProviderProtocol =
  | "openai-compatible"
  | "ollama-native"
  | "anthropic-compatible"
  | "lmstudio-native"
  | "node-llama-cpp-native";

export interface LocalProviderProfile {
  id: string; // ollama | vllm | lmstudio | lemonade | docker-model-runner | jan | apfel | agentsy-local-llama
  displayName: string;
  protocol: ProviderProtocol;
  defaultBaseUrl: string;
  healthEndpoint?: string;
  modelsEndpoint?: string;
  supportsApiKey: boolean;
  requiresApiKeyByDefault: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsEmbeddings: boolean;
  supportsResponsesApi?: boolean;
  notes?: string[];
}
```

## Local Provider Coverage Matrix (must ship)

| Provider            | Protocol(s)                                        | Discovery Strategy                                     | Auth Posture                                 |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| Ollama              | `ollama-native` (+ optional OpenAI-compat mapping) | `GET /api/tags` / model listing                        | local no-auth by default; cloud requires key |
| vLLM                | OpenAI-compatible                                  | `GET /v1/models`                                       | optional API key (`--api-key`)               |
| LM Studio           | OpenAI-compatible + native API                     | `GET /v1/models`, optional `/api/v1/models`            | optional token auth                          |
| Lemonade            | OpenAI-compatible                                  | `GET /v1/models`                                       | deployment dependent                         |
| Docker Model Runner | OpenAI/Ollama/Anthropic compatible                 | `GET /engines/v1/models` and engine-specific endpoints | key ignored in OpenAI-compatible mode        |
| Jan                 | OpenAI-compatible                                  | `GET /v1/models`                                       | bearer key required in Jan config            |
| Apfel               | OpenAI-compatible                                  | `GET /v1/models` (`apple-foundationmodel`)             | local no-key default; optional token support |
| Agentsy Local Llama | `node-llama-cpp-native`                            | local runtime model registry                           | local-only; no network key                   |

## New Plan: Agentsy Local Provider (node-llama-cpp)

### Goal

Introduce an Agentsy-owned local provider powered by `node-llama-cpp` for offline/private execution with native control over:

- model lifecycle
- context reuse
- chat sessions
- embeddings
- deterministic local fallback when remote providers are unavailable

### Boundary and placement

- `@agentsy/models`: catalog profile, capability metadata, route/scoring support.
- `@agentsy/providers`: concrete adapter implementation (`agentsy-local-llama`).

### Node-llama-cpp primitives to leverage

- `getLlama(...)` for runtime/backend initialization
- `LlamaChatSession` for structured chat loops
- `LlamaEmbeddingContext` for embeddings support

### Proposed provider interface contract

```ts
interface AgentsyLocalLlamaProviderConfig {
  modelPath: string;
  contextSize?: number;
  gpuLayers?: number;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}
```

### Delivery phases

## Phase L0 (Design + contracts)

- define provider profile and capability schema in `@agentsy/models`
- add adapter contract tests in `@agentsy/providers`

## Phase L1 (MVP local chat provider)

- initialize llama runtime via `getLlama`
- implement prompt->completion and streaming chunk conversion
- add health + readiness checks

## Phase L2 (Tool calling + structured output parity)

- support tool-call message transforms where model supports it
- add schema-constrained generation fallback strategy

## Phase L3 (Embeddings + retrieval integration hooks)

- expose embeddings via `LlamaEmbeddingContext`
- connect with `@agentsy/retrieval` adapter boundary

## Phase L4 (Optimization + observability)

- model warm pools / context reuse policies
- token/cost telemetry integration with `@agentsy/observability`

## Detailed Feature Plan (Models Package)

### 1) Catalog federation

- merge models.dev catalog with local provider-discovered catalogs
- merge open-model source catalogs (Hugging Face, Ollama library/local registry, additional open providers)
- assign source provenance (`cloud`, `local-http`, `local-native`)
- support stale-while-revalidate cache policy

### 1.1) Open model discovery + fetch planning (NEW)

The models package must support **search and acquisition planning** for runner-managed local models.

```ts
export interface ModelDiscoveryQuery {
  text?: string;
  provider?: "huggingface" | "ollama" | "open-provider";
  modalities?: Array<"text" | "image" | "audio">;
  minContext?: number;
  quantizations?: string[]; // q4_k_m, q8_0, f16, etc.
  licenseAllowlist?: string[];
}

export interface ModelArtifactFetchPlan {
  source: "huggingface" | "ollama" | "open-provider";
  modelId: string;
  artifactType: "gguf" | "safetensors" | "provider-native";
  fetchMethod: "direct-download" | "llama-hf-shortcut" | "ollama-pull" | "conversion";
  estimatedSizeBytes?: number;
  checks?: Array<"checksum" | "license" | "compatibility">;
}
```

Design rule: `@agentsy/models` returns a **fetch plan and recommendation**, while `@agentsy/runtime` + `@agentsy/providers` execute the fetch.

### 2) Capability normalization

- normalize capabilities across OpenAI-compatible and non-OpenAI local APIs
- track tools/streaming/embeddings/reasoning support at model+provider level

### 3) Local endpoint awareness

- endpoint health scoring (reachable, latency, auth state)
- prefer healthy local providers when policy requests local-first execution

### 4) Cost and policy scoring

- cloud: token-pricing based from models.dev
- local: estimated resource cost classes (`cpu-low`, `gpu-mid`, `gpu-high`) and latency priors
- expose confidence + rationale for routing decisions

### 5) Recommendation engine enhancement (LLM Stats integration)

Use `https://llm-stats.com/developer` endpoints to enrich recommendation quality:

- `GET /stats/v1/models`
- `GET /stats/v1/models/{id}`
- `GET /stats/v1/scores`
- `GET /stats/v1/rankings`
- `GET /stats/v1/updates`

Recommendation criteria should combine:

1. capability fit (tools, context, modalities)
2. price (models.dev)
3. benchmark/category fit (llm-stats rankings + scores)
4. freshness (recent updates)
5. deployment fit (local availability + artifact compatibility)

### 5.1) CLI search/select/refine support contracts (NEW)

The models package must expose query and refinement contracts specifically designed for Ink-based chooser workflows in `@agentsy/cli`.

```ts
export interface ModelSearchQuery {
  text?: string;
  providerIds?: string[];
  preferLocal?: boolean;
  supportsTools?: boolean;
  supportsStreaming?: boolean;
  supportsEmbeddings?: boolean;
  maxPricePer1mInputUsd?: number;
  minContextWindow?: number;
}

export interface ModelRefinementRequest {
  baseSelectionId?: string;
  tighten?: Array<"cost" | "latency" | "quality" | "privacy" | "tooling">;
  relax?: Array<"cost" | "latency" | "quality" | "privacy" | "tooling">;
  task?: RecommendationCriteria["task"];
}
```

These APIs must return explainable ranking reasons so the CLI can show "why this model" and "why not this one" in selection/refinement panes.

```ts
export interface RecommendationCriteria {
  task: "coding" | "math" | "writing" | "general" | "multimodal";
  budgetTier?: "low" | "mid" | "high";
  preferLocal?: boolean;
  minBenchmarks?: Record<string, number>; // e.g. { HumanEval: 80 }
  preferredLicenses?: string[];
}
```

### 6) Implementation guidance: local automodel selection

The models package should remain the **pure decision layer** for local automodel selection.

Use the existing `recommendLocalModelsBySystemCapabilities(...)` helper as the core scoring function. Keep it deterministic and side-effect free: it should only consume models.dev catalog data, llm-stats benchmark/ranking data, and the caller's current hardware profile.

Recommended implementation tasks:

1. Add a small `LLMStatsClient` helper that fetches `/stats/v1/models`, `/stats/v1/scores`, `/stats/v1/rankings`, and `/stats/v1/updates` and caches them separately from models.dev.
2. Preserve stable ranking for identical inputs so the runtime can reproduce decisions across retries.
3. Emit a recommendation plan that includes runtime family hints, provenance, and fetch/activation hints, not process-launch logic.
4. Prefer local candidates when they fit with comfortable headroom; otherwise return an ordered remote fallback list.
5. Keep `llama-swap` in the runtime layer as the hot-swap execution strategy, not in the models layer.

The recommendation output should be able to hint at the intended runtime family, for example:

- `ollama` for daemon-backed local pulls
- `llama.cpp` for GGUF direct inference
- `llama-swap` for hot-swapped OpenAI/Anthropic-compatible routing across multiple local backends
- `mlx` or `apfel` when Apple Silicon-local support is the best fit

The models package must never decide how to spawn the process or manage the upstream server lifecycle.

### 7) Capability deprecation tracking

Track model capability deprecation (e.g., GPT-4 Vision -> GPT-4o Vision, Claude Opus tool style changes). When a capability is deprecated, emit a RecommendationEvent and surface migration guidance to the caller. Deprecation data is stored in the model registry with sunset dates.

## Implementation Priorities

### Phase 1 (Weeks 1-3): Contract hardening + deterministic tests

- introduce provider profile contracts
- migrate tests away from mandatory live-network dependency
- add fixtures for models.dev payload snapshots

### Phase 2 (Weeks 4-8): Local provider profile support

- implement profile modules for Ollama/vLLM/LM Studio/Lemonade/Docker Model Runner/Jan/Apfel
- add endpoint probing and capability normalization
- add open-model discovery connectors (Hugging Face + Ollama + pluggable open providers)
- add fetch-plan generation for GGUF/local-compatible artifacts

### Phase 3 (Weeks 9-14): Routing improvements

- local-first and hybrid routing policies
- local health + latency-aware scoring
- local fallback chains (e.g., Jan -> Ollama -> vLLM)

### Phase 4 (Weeks 15-22): Agentsy local llama provider integration

- integrate `agentsy-local-llama` profile + selection semantics
- surface embeddings capability and runtime constraints
- complete orchestrator integration docs and examples

### Phase 5 (Weeks 23-28): recommendation intelligence

- integrate llm-stats-based ranking overlays
- implement criteria-driven recommendations API for runtime and CLI
- add offline fallback when llm-stats unavailable

## Testing Requirements

1. **Unit tests** for profile normalization and scoring.
2. **Fixture-based integration tests** for each local provider API shape.
3. **No-network default test mode** in CI.
4. **Contract tests** with `@agentsy/providers` adapter expectations.
5. **Performance tests** for selection latency (<100ms on warm cache).
6. **Recommendation quality tests** (criteria-based ranking stability).
7. **Acquisition planning tests** (Hugging Face/Ollama/open-provider fetch plan generation).
8. **Chooser contract tests** for search/select/refine APIs consumed by Ink model-picker components.

## Export Surface (target)

```ts
export * from "./types.js";
export * from "./catalog/index.js";
export * from "./selector/index.js";
export * from "./providers/profiles/index.js";
```

## Risks and Mitigations

- **Protocol drift risk:** local servers evolve quickly.
  - Mitigation: profile versioning + fixture regression tests.
- **False capability claims:** endpoint advertises support but fails runtime.
  - Mitigation: active probe tests + runtime fallback logic.
- **Boundary leakage:** selection logic accidentally performs wire calls.
  - Mitigation: strict package contract tests (`models` vs `providers`).

## Success Metrics

- Local provider profile coverage for all 7 external local servers + Agentsy local llama.
- 95%+ successful model discovery on supported local endpoints.
- Selection reliability: valid fallback choice returned for 99% of provider outage simulations.
- Zero circular dependency regressions between `models`, `providers`, `orchestrator`.
- 90%+ recommendation acceptance in internal eval harness for criteria-driven tasks.

## Sources Reviewed for This Plan Update (2026-05-15)

- <https://docs.ollama.com/api/introduction>
- <https://docs.vllm.ai/en/latest/api/>
- <https://lmstudio.ai/docs/developer/rest>
- <https://lemonade-server.ai/docs/api/openai/>
- <https://docs.docker.com/ai/model-runner/>
- <https://node-llama-cpp.withcat.ai/api/functions/getLlama>
- <https://www.jan.ai/docs/desktop/api-server>
- <https://github.com/Arthur-Ficial/apfel>
- <https://llm-stats.com/developer>
- <https://huggingface.co/docs/hub/gguf-llamacpp>
- <https://huggingface.co/docs/hub/agents-local>
- <https://github.com/mattjamo/OllamaToGGUF>
- <https://www.danielcorin.com/til/llama-cpp/running-huggingface-models/>
- <https://martinuke0.github.io/posts/2026-01-07-mastering-llamacpp-a-comprehensive-guide-to-local-llm-inference/>
- <https://markaicode.com/tutorial/how-to-use-llamacpp/>
- <https://medium.com/@jallenswrx2016/llama-cpp-the-gateway-to-huggingface-model-bonanza-5586b3166a9f> (access-limited)

Additional referenced pages (recursively reviewed):

- <https://docs.ollama.com/llms.txt>
- <https://docs.ollama.com/api/authentication>
- <https://docs.vllm.ai/en/latest/serving/openai_compatible_server/>
- <https://lmstudio.ai/docs/developer/openai-compat>
- <https://lmstudio.ai/docs/developer/core/authentication>
- <https://docs.docker.com/ai/model-runner/api-reference/>
- <https://docs.docker.com/ai/model-runner/inference-engines/>
- <https://docs.docker.com/ai/model-runner/configuration/>
- <https://www.jan.ai/docs/desktop/api-preference>
- <https://node-llama-cpp.withcat.ai/api/classes/LlamaChatSession>
- <https://node-llama-cpp.withcat.ai/api/classes/LlamaEmbeddingContext>
