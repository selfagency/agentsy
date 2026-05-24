# Load Balancer Package for agentsy — Exhaustive Implementation Plan

> **Objective:** Design and implement a `@agentsy/load-balancer` package that automatically routes the same model across multiple LLM providers, switching based on real-time availability, remaining usage quotas (from provider APIs or rate-limit response headers), and configurable routing strategies.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Provider Rate-Limit Research Findings](#2-provider-rate-limit-research-findings)
   - 2.1 [Per-Provider Rate-Limit Profiles](#21-per-provider-rate-limit-profiles)
   - 2.2 [Rate-Limit Headers Cross-Reference](#22-rate-limit-headers-cross-reference)
   - 2.3 [Usage / Quota Query APIs](#23-usage--quota-query-apis)
   - 2.4 [Rate-Limit Error Codes](#24-rate-limit-error-codes)
3. [Industry Load-Balancing Patterns](#3-industry-load-balancing-patterns)
   - 3.1 [Routing Strategies](#31-routing-strategies)
   - 3.2 [Circuit Breaker Pattern](#32-circuit-breaker-pattern)
   - 3.3 [Proactive vs Reactive Rate-Limit Avoidance](#33-proactive-vs-reactive-rate-limit-avoidance)
   - 3.4 [Key Lessons from Production Systems](#34-key-lessons-from-production-systems)
4. [agentsy Codebase Architecture Analysis](#4-agency-codebase-architecture-analysis)
   - 4.1 [Monorepo Structure](#41-monorepo-structure)
   - 4.2 [Existing Abstractions to Leverage](#42-existing-abstractions-to-leverage)
   - 4.3 [Current Gaps](#43-current-gaps)
5. [Package Design — `@agentsy/load-balancer`](#5-package-design--agentsyload-balancer)
   - 5.1 [Module Layout & File Tree](#51-module-layout--file-tree)
   - 5.2 [Core Interfaces](#52-core-interfaces)
   - 5.3 [Provider Registry](#53-provider-registry)
   - 5.4 [Usage Tracker](#54-usage-tracker)
   - 5.5 [Health Tracker & Circuit Breaker](#55-health-tracker--circuit-breaker)
   - 5.6 [Routing Strategies](#56-routing-strategies)
   - 5.7 [Provider Profile System — Config-Driven Architecture](#57-provider-profile-system--modular-config-driven-architecture)
   - 5.8 [Rate-Limit Header Extractors](#58-rate-limit-header-extractors)
   - 5.9 [Usage Probes](#59-usage-probes)
   - 5.10 [Retry with Provider Fallback](#510-retry-with-provider-fallback)
   - 5.11 [Metrics & Observability](#511-metrics--observability)
   - 5.12 [Configuration Schema](#512-configuration-schema)
6. [Data Flow — End-to-End Request Lifecycle](#6-data-flow--end-to-end-request-lifecycle)
7. [Provider Profile Catalog](#7-provider-profile-catalog)
   - 7.1 [Profile Config Schema Reference](#71-profile-config-schema-reference)
   - 7.2 [Built-in Profile Configs](#72-built-in-profile-configs)
   - 7.3 [Generic OpenAI-Compatible Profile](#73-generic-openai-compatible-profile)
   - 7.4 [Adding a New Provider — Zero Code](#74-adding-a-new-provider--zero-code)
   - 7.5 [Ollama Cloud](#75-ollama-cloud)
   - 7.6 [Ollama Local](#76-ollama-local)
8. [Model Aliasing & Cross-Provider Mapping](#8-model-aliasing--cross-provider-mapping)
9. [Testing Strategy](#9-testing-strategy)
10. [Implementation Phases & Milestones](#10-implementation-phases--milestones)
11. [Appendix A — Full Rate-Limit Header Matrix](#appendix-a--full-rate-limit-header-matrix)
12. [Appendix B — Open Source Reference Libraries](#appendix-b--open-source-reference-libraries)

---

## 1. Executive Summary

This plan proposes a new `@agentsy/load-balancer` package for the [agentsy](https://github.com/selfagency/agentsy) monorepo — a TypeScript/ESM project built with pnpm + Turborepo containing 23 packages for LLM agent orchestration. The load balancer will sit between application code and the existing `UniversalClient`, implementing intelligent multi-provider routing for the same logical model.

**Core capabilities:**

- **Model aliasing** — map a single logical model name (e.g., `gpt-4o`) to multiple provider endpoints (OpenAI direct, Azure OpenAI, AWS Bedrock, DeepInfra, OpenRouter, etc.)
- **Real-time usage tracking** — parse rate-limit response headers to maintain per-provider, per-model counters for remaining RPM/TPM/concurrency
- **Active quota probing** — periodically call provider usage APIs (e.g., DeepInfra's `GET /v1/me/rate_limit`, OpenAI's usage dashboard data) to get absolute remaining quotas
- **Health-aware routing** — circuit breakers, latency tracking, and error-rate monitoring per provider endpoint
- **Pluggable strategies** — round-robin, weighted, least-latency, cost-optimized, priority-fallback, and adaptive hybrid strategies
- **Automatic failover** — on 429 or 5xx errors, retry with the next healthy provider transparently
- **Streaming support** — full compatibility with `UniversalClient.stream()` including mid-stream error detection
- **Zero-config defaults** — sensible out-of-the-box behavior with deep customization via configuration

The design draws heavily on production patterns documented by Bifrost/Maxim, TrueFoundry, and the LangChain/Reddit community, incorporating proactive rate-limit avoidance (shifting traffic _before_ 429s occur), gradual recovery after circuit breaks, and multi-dimensional routing that combines latency, cost, and availability.

---

## 2. Provider Rate-Limit Research Findings

### 2.1 Per-Provider Rate-Limit Profiles

| Provider         | Limit Types                         | Algorithm                        | Spend Tiers             | Scope                               | Key Quirk                                                                          |
| ---------------- | ----------------------------------- | -------------------------------- | ----------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| **OpenAI**       | RPM, RPD, TPM, TPD                  | Fixed-window (bursty)            | 6 tiers ($0–$1,000+)    | Organization + project              | Failed requests count toward limits; some models share pooled limits               |
| **Anthropic**    | RPM, ITPM, OTPM                     | Token bucket (continuous refill) | 5 tiers ($5–$400+)      | Organization (workspace sub-limits) | Cache-read tokens do NOT count toward ITPM (major advantage); `retry-after` header |
| **xAI**          | RPM, TPM                            | Fixed-window                     | 6 tiers ($0–$5,000+)    | Per-account                         | Cached tokens still count toward TPM; no rate-limit headers exposed                |
| **DeepSeek**     | Concurrency (in-flight requests)    | —                                | None (free expansion)   | Account-level                       | Only concurrency — no RPM/TPM; `user_id` for scheduling isolation                  |
| **DeepInfra**    | Concurrent requests + TPM per model | —                                | Per-model dynamic       | Per-model                           | Has programmatic `GET /v1/me/rate_limit` API; rate-limit increase via API          |
| **Perplexity**   | QPS/RPM (leaky bucket)              | Leaky bucket                     | 6 tiers ($0–$5,000+)    | Per-tier                            | Search API limits are tier-independent; burst capacity                             |
| **Meta (Llama)** | RPM + TPM                           | Fixed-window                     | None (preview)          | Per-team (aggregated across keys)   | Very low limits (10 RPM / 250K TPM); still in preview                              |
| **OpenCode**     | Dollar-spend caps                   | —                                | Single tier ($5–$10/mo) | Per-subscription                    | No RPM/TPM — limits expressed as $/time-window                                     |
| **Z.AI**         | Concurrency (projects)              | Dynamic (off-peak boost)         | Lite/Pro/Max            | Per-account                         | Strict individual-use policy; risk-control auto-ban                                |
| **Ollama Cloud** | RPM, TPM, concurrent requests       | Token bucket / fixed-window      | Free tier + paid tiers  | Per-account                         | Separate from local Ollama; cloud-hosted inference with API rate limits            |
| **Ollama Local** | None                                | —                                | None (self-hosted)      | Operator-controlled                 | Rate limiting is the operator's responsibility; track GPU memory locally           |

**Providers not yet profiled but that will need `ProviderProfile` modules** (this list is non-exhaustive — the modular design means any new provider can be added without modifying core load-balancer code):

| Provider                        | Category             | Notes                                                                               |
| ------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| **OpenRouter**                  | Aggregator / gateway | Routes to 200+ models; has its own rate limits and per-model pricing; own usage API |
| **Together AI**                 | Inference provider   | Pay-per-token; RPM + TPM limits; OpenAI-compatible API                              |
| **Fireworks AI**                | Inference provider   | Fast inference; RPM + TPM; some models have dedicated throughput                    |
| **Groq**                        | Fast inference       | LPU-based ultra-low-latency; RPM + TPM; strict rate limits                          |
| **Mistral AI**                  | First-party provider | Own API format; RPM + TPM; La Plateforme console                                    |
| **Google Gemini / Vertex AI**   | First-party + cloud  | RPM + TPM + RPD; quota project-based; separate per-region limits                    |
| **AWS Bedrock**                 | Cloud marketplace    | Per-model throttling; uses `ThrottlingException`; quota via Service Quotas API      |
| **Azure OpenAI**                | Cloud marketplace    | Same models as OpenAI but separate rate limits per deployment; separate PTU quotas  |
| **Cerebras**                    | Fast inference       | Wafer-scale engine; RPM + TPM; OpenAI-compatible                                    |
| **SambaNova**                   | Fast inference       | Enterprise-focused; RPM + TPM; OpenAI-compatible                                    |
| **AI21 Labs**                   | First-party provider | Jamba models; RPM + TPM                                                             |
| **Cohere**                      | First-party provider | Command/Rerank/Embed; RPM + TPM; trial vs production tiers                          |
| **Voyage AI**                   | Embeddings provider  | Specialized embedding models; RPM + TPM                                             |
| **Anyscale**                    | Cloud marketplace    | Ray-based serving; RPM + TPM                                                        |
| **Replicate**                   | Serverless inference | Per-model cold/warm starts; RPM; concurrent requests                                |
| **Novita AI**                   | Inference provider   | OpenAI-compatible; RPM + TPM; budget-based limits                                   |
| **AI/ML API**                   | Aggregator           | Multi-provider routing; own rate limits on top of underlying providers              |
| **Unify AI**                    | Aggregator           | Multi-provider; own rate limits; usage tracking API                                 |
| **Monster API**                 | Aggregator           | OpenAI-compatible; free tier with aggressive rate limits                            |
| **Any other OpenAI-compatible** | General              | Any provider exposing `/v1/chat/completions` can use the generic profile            |

### 2.2 Rate-Limit Headers Cross-Reference

| Provider         | `x-ratelimit-limit-*`                                                                                | `x-ratelimit-remaining-*`                                        | `x-ratelimit-reset-*`                                        | `retry-after`                         | Notes                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------ |
| **OpenAI**       | `limit-requests`, `limit-tokens`                                                                     | `remaining-requests`, `remaining-tokens`                         | `reset-requests` (e.g., `1s`), `reset-tokens` (e.g., `6m0s`) | No                                    | Most comprehensive header set                    |
| **Anthropic**    | `anthropic-ratelimit-requests-limit`, `-tokens-limit`, `-input-tokens-limit`, `-output-tokens-limit` | Corresponding `-remaining` variants                              | Corresponding `-reset` variants                              | **Yes** (`retry-after` seconds)       | 12+ headers; also priority and fast-mode headers |
| **Meta**         | `x-ratelimit-limit-tokens`, `x-ratelimit-limit-requests`                                             | `x-ratelimit-remaining-tokens`, `x-ratelimit-remaining-requests` | No                                                           | No                                    | Subset of OpenAI pattern                         |
| **xAI**          | No                                                                                                   | No                                                               | No                                                           | No                                    | No headers exposed; console-only                 |
| **DeepSeek**     | No                                                                                                   | No                                                               | No                                                           | No                                    | No headers; console-only                         |
| **DeepInfra**    | No                                                                                                   | No                                                               | No                                                           | No                                    | No response headers; separate query API          |
| **Perplexity**   | No                                                                                                   | No                                                               | No                                                           | No                                    | 429 only; no headers                             |
| **Ollama Cloud** | TBD (docs evolving)                                                                                  | TBD                                                              | TBD                                                          | Cloud-hosted API; separate from local |
| **Ollama Local** | N/A                                                                                                  | N/A                                                              | N/A                                                          | N/A                                   | Self-hosted; no API rate limits                  |
| **Z.AI**         | No                                                                                                   | No                                                               | No                                                           | No                                    | Console-only                                     |

**Critical insight:** Only OpenAI, Anthropic, and Meta expose rate-limit information in response headers. The remaining 7 providers require either out-of-band API polling or reactive 429-based detection. This fundamentally shapes the design — the system must support **both** header-based tracking and **probe-based** quota checking.

### 2.3 Usage / Quota Query APIs

| Provider       | Endpoint                                               | Auth                            | Response Shape                             | Polling Interval |
| -------------- | ------------------------------------------------------ | ------------------------------- | ------------------------------------------ | ---------------- |
| **DeepInfra**  | `GET https://api.deepinfra.com/v1/me/rate_limit`       | `Authorization: Bearer <token>` | `{ rate_limit: int, tpm_rate_limit: int }` | 10–60s           |
| **DeepInfra**  | `GET /v1/openai/usage`                                 | Bearer                          | Usage details                              | On-demand        |
| **Anthropic**  | Rate Limits API (referenced in docs, URL not explicit) | `x-api-key`                     | Per-model ITPM/OTPM limits & remaining     | 10–60s           |
| **OpenAI**     | `GET /v1/organization/usage/limits` (enterprise)       | Bearer                          | Monthly usage vs caps                      | 300s             |
| **OpenAI**     | `GET /v1/fine_tuning/model_limits`                     | Bearer                          | Fine-tuning-specific limits                | On-demand        |
| **xAI**        | Console only (no programmatic API)                     | —                               | —                                          | Manual           |
| **DeepSeek**   | Console only                                           | —                               | —                                          | Manual           |
| **Perplexity** | Console only                                           | —                               | —                                          | Manual           |
| **Meta**       | Dashboard only                                         | —                               | —                                          | Manual           |

**Key design decision:** For providers without programmatic APIs, the load balancer must rely entirely on response headers and reactive 429 detection. For DeepInfra (the only provider with a clean public rate-limit query API), active polling should be implemented as the reference pattern.

### 2.4 Rate-Limit Error Codes

All providers consistently use **HTTP 429 (Too Many Requests)** as the rate-limit error signal. However, the response body format varies:

| Provider       | Error Body Format                                                               | Identifying Fields                         |
| -------------- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| **OpenAI**     | `{ error: { message, type: "rate_limit_error", code: "rate_limit_exceeded" } }` | `error.type === "rate_limit_error"`        |
| **Anthropic**  | `{ type: "error", error: { type: "rate_limit_error", message } }`               | `error.type === "rate_limit_error"`        |
| **xAI**        | Standard 429 JSON                                                               | HTTP status                                |
| **DeepSeek**   | `{ error: { message, type: "invalid_request_error" } }`                         | HTTP 429 status (error type is misleading) |
| **DeepInfra**  | Standard 429                                                                    | HTTP status                                |
| **Perplexity** | Standard 429                                                                    | HTTP status                                |
| **Meta**       | `{ error: { message } }`                                                        | HTTP 429 status                            |

All providers also return 429-like behavior on:

- **408** (timeout) — request may be retried with a different provider
- **500/502/503/504** (server errors) — transient, suitable for failover
- **401/403** (auth errors) — NOT suitable for retry (permanent per-key error)

---

## 3. Industry Load-Balancing Patterns

### 3.1 Routing Strategies

Based on the 7 external sources reviewed (Bifrost/Maxim, TrueFoundry, ML Journey, Markaicode, openlimit, and two Reddit threads), the following strategies emerged:

#### 3.1.1 Round-Robin (Sequential Distribution)

- Simple sequential distribution across providers
- Effective when all providers have similar latency/cost
- **Failure mode:** naive round-robin keeps hammering rate-limited keys causing cascading failures
- **Verdict:** Useful as a baseline but insufficient alone

#### 3.1.2 Weighted Round-Robin

- Assign static weights per provider (e.g., OpenAI 60%, Anthropic 30%, Bedrock 10%)
- Weights can be adjusted dynamically based on real-time metrics
- Good for A/B testing and canary deployments
- **Production pattern (Bifrost):** Primary provider gets 0.8 weight, backup gets 0.2

#### 3.1.3 Least-Connections (Least Pending Requests)

- Route to the provider with the fewest in-flight requests
- Naturally balances load when providers have different response times
- Requires tracking concurrent requests per provider
- **Advantage:** Self-correcting without explicit rate-limit knowledge

#### 3.1.4 Latency-Based Routing

- Maintain a rolling window of recent response times per provider
- Route to the fastest-responding provider
- **Production result (Bifrost):** P95 latency reduction of 30%+ under bursty workloads
- Window size: typically 50–100 requests, with exponential decay

#### 3.1.5 Cost-Optimized Routing

- Calculate cost per request (input tokens × input_rate + output tokens × output_rate)
- Route to the cheapest provider that meets quality/latency constraints
- **Production result (TrueFoundry):** Fortune 500 copilot cut LLM spend by $70K/month
- Can be combined with quality gates (confidence thresholds)

#### 3.1.6 Health-Aware Routing (Priority Fallback)

- Maintain ordered priority list of providers
- Skip unhealthy/rate-limited providers
- Fallback chain: Primary → Secondary → Tertiary → ... → all exhausted → error
- Most commonly implemented pattern across all sources

#### 3.1.7 Adaptive Hybrid

- Combine multiple strategies with configurable scoring function
- Score = f(remaining_quota, latency_percentile, cost, error_rate, weight)
- **Recommended default** for the load balancer

### 3.2 Circuit Breaker Pattern

Universally recommended across all sources. Three states:

| State         | Behavior                                                         | Transition                                                   |
| ------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| **CLOSED**    | Normal operation; all requests routed through                    | Error rate exceeds threshold → **OPEN**                      |
| **OPEN**      | Requests immediately failover to next provider; no requests sent | Cooldown expires → **HALF-OPEN**                             |
| **HALF-OPEN** | Allow single probe request to test recovery                      | Success → **CLOSED** (with gradual ramp); Failure → **OPEN** |

**Critical parameters (from Bifrost/Markaicode production data):**

- Failure threshold: 3–5 consecutive failures (configurable)
- Cooldown period: 30–120 seconds (configurable)
- Failure status codes: `[429, 500, 502, 503, 504]` (configurable)
- Half-open probe count: 1–3 requests before full restoration
- Gradual ramp: after recovery, start at 10% weight and double every 30s until full weight

**Key lesson from Reddit r/ArtificialIntelligence:** _"Flip a key back on at full blast and it'll hit the ceiling again."_ Gradual recovery is essential.

### 3.3 Proactive vs Reactive Rate-Limit Avoidance

| Approach                       | Mechanism                                                 | Advantage                               | Disadvantage                               |
| ------------------------------ | --------------------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| **Reactive**                   | Wait for 429, then switch provider                        | Simple; no extra API calls              | Wastes requests; causes latency spikes     |
| **Proactive (header-based)**   | Track `remaining-*` headers; switch before exhaustion     | Zero waste; seamless                    | Only works for OpenAI/Anthropic/Meta       |
| **Proactive (API-based)**      | Poll provider usage APIs; predict exhaustion              | Works for more providers                | Extra API calls; polling delay             |
| **Proactive (local tracking)** | Count own requests/tokens; estimate when limit approaches | Works for all providers; no extra calls | Drift between local count and server state |

**Recommended approach:** Layer all three. Use header-based tracking when available, API polling for providers that support it, and local counter tracking as fallback. This is the "defense in depth" approach.

### 3.4 Key Lessons from Production Systems

1. **"Keys aren't workers, they're batteries"** — drain the wrong one and the whole system spirals (Reddit r/ArtificialIntelligence)
2. **"Who has the most headroom right now"** routing >> "who's next" (round-robin) (Reddit r/ArtificialIntelligence)
3. **Gateway overhead is negligible** — 3–10ms for well-implemented routing vs. 1–30s for LLM generation (TrueFoundry: 3ms, 350+ RPS on 1 vCPU)
4. **Observability is non-negotiable** — need per-provider dashboards tracking RPM/TPM, error rates, latency percentiles, cost (Bifrost)
5. **Multi-provider multiplies effective capacity** — 10K RPM OpenAI + 5K RPM Anthropic = 15K combined (ML Journey)
6. **Round-robin is a starting point, not a solution** — naive RR causes cascading failures when keys get rate-limited (all 7 sources)
7. **LLM load balancing ≠ traditional web load balancing** — different pricing, non-identical outputs, variable performance (ML Journey)
8. **Combine cost optimization with quality gates** — classification tasks → cheap models; content generation → premium (TrueFoundry, ML Journey, Reddit comments)

---

## 4. agentsy Codebase Architecture Analysis

### 4.1 Monorepo Structure

```
packages/
├── types/          → @agentsy/types     — Shared TypeScript types (zero deps)
├── core/           → @agentsy/core      — Stream processing, SSE, retry, recovery
├── providers/      → @agentsy/providers  — Adapters, normalizers, pipeline, universal client
├── models/         → @agentsy/models    — Model selection & recommendation
├── runtime/        → @agentsy/runtime   — Agent execution runtime
├── orchestrator/   → @agentsy/orchestrator — Workflow engine
├── memory/         → @agentsy/memory    — Three-tier memory engine
├── session/        → @agentsy/session   — Session persistence
├── tokens/         → @agentsy/tokens    — Token budgeting
├── guardrails/     → @agentsy/guardrails — Safety/validation (QuotaExceededError exists!)
├── observability/  → @agentsy/observability — Metrics & tracing (OTel)
├── secrets/        → @agentsy/secrets   — In-memory secret store (scaffold)
├── mcp/            → @agentsy/mcp       — Model Context Protocol types
├── plugins/        → @agentsy/plugins   — Plugin system
├── prompts/        → @agentsy/prompts   — Prompt management
├── tools/          → @agentsy/tools     — Tool implementations
├── renderers/      → @agentsy/renderers — CLI/TUI renderers
├── ui/             → @agentsy/ui        — UI components
├── vscode/         → @agentsy/vscode    — VS Code integration (only published pkg)
├── cli/            → @agentsy/cli       — CLI commands
├── connectors/     → @agentsy/connectors — Platform connectors
├── scripts/        → @agentsy/scripts   — Release scripts
└── testing/        → @agentsy/testing   — Integration tests
```

**Key constraints:**

- TypeScript 6.0.3, ESM-first (`.js` extensions required in imports)
- Build tool: `tsup`
- Test framework: `vitest`
- Linter: `oxlint` (Rust-based)
- Node target: >=18
- Dependencies: `zod ^4.4.3`, `zod-to-json-schema ^3.25.2`

### 4.2 Existing Abstractions to Leverage

| Abstraction                                | Location                                             | How Load Balancer Uses It                                                                                        |
| ------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `UniversalClient` interface                | `packages/providers/src/universal-client/client.ts`  | Primary interface to wrap; each provider gets its own `UniversalClient` instance                                 |
| `UniversalClientConfig`                    | Same file                                            | Configuration template for creating provider clients                                                             |
| `NormalizerProvider` type                  | `packages/providers/src/pipeline/create-pipeline.ts` | Provider enum (`openai`, `anthropic`, `gemini`, `bedrock`, `mistral`, `ollama`, `cohere`, `hugging-face`, `zai`) |
| `CompletionRequest` / `CompletionResponse` | `packages/types/src/completion.ts`                   | Input/output types the load balancer will pass through unchanged                                                 |
| `ProviderCapabilities`                     | `packages/types/src/providers.ts`                    | Per-provider feature flags (streaming, tool calling, max tokens) — used for compatibility filtering              |
| `ProviderRetryPolicy`                      | Both `@agentsy/types` and `@agentsy/providers`       | Existing type (maxAttempts, delays, backoff) — currently NOT wired but defines the shape                         |
| `retry()` function                         | `packages/core/src/retry/index.ts`                   | Generic exponential backoff — reuse for retry-with-failover logic                                                |
| `ProviderErrorCode.RateLimited`            | `packages/vscode/src/types/errors.ts`                | Enum value already exists — reuse in load balancer error classification                                          |
| `STATUS_TO_ERROR_CODE` map                 | `packages/vscode/src/error-handling/error-mapper.ts` | HTTP status → error code mapping (401, 403, 429, 404, 408, 504, 400)                                             |
| `QuotaExceededError`                       | `packages/guardrails/src/index.ts`                   | Already exists — could be thrown when all providers are exhausted                                                |
| `GuardrailProvider` interface              | `packages/types/src/guardrails.ts`                   | Pre/post evaluation hook — could be used for pre-flight quota checks                                             |
| `ModelSelector`                            | `packages/models/src/index.ts`                       | Intelligent model selection by capabilities/cost — can inform routing weights                                    |
| `ProcessorOptions.transforms`              | `packages/core/src/processor/`                       | Extensible transform pipeline — potential hook point for routing middleware                                      |

### 4.3 Current Gaps

| Gap                                                                | Impact                                  | Load Balancer Solution                                                            |
| ------------------------------------------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------- |
| `UniversalClient` binds to ONE provider at construction            | No multi-provider routing possible      | Wrap with `LoadBalancedClient` that manages a pool of `UniversalClient` instances |
| `ProviderRetryPolicy` defined but NOT wired into `UniversalClient` | Retry config accepted but ignored       | Implement retry-with-failover in the load balancer layer                          |
| 429 error is mapped but not acted upon                             | No automatic failover on rate limits    | Circuit breaker + automatic fallback to next provider                             |
| No usage/quota tracking at routing level                           | Cannot make informed routing decisions  | Usage tracker that parses headers and polls APIs                                  |
| No provider health status                                          | Cannot avoid degraded providers         | Health tracker with success rate, latency, error monitoring                       |
| No request-level middleware/interceptor chain                      | No hook point for routing logic         | Implement middleware pattern in the load balancer                                 |
| `PROVIDER_ENDPOINTS` is hard-coded                                 | Cannot add custom or regional endpoints | Extract into configurable provider registry                                       |

---

## 5. Package Design — `@agentsy/load-balancer`

### 5.1 Module Layout & File Tree

```
packages/load-balancer/
├── package.json              # @agentsy/load-balancer
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts              # Public API exports
│   │
│   ├── client.ts             # LoadBalancedClient — main entry point
│   │   #   implements UniversalClient, wraps provider pool
│   │
│   ├── config.ts             # Configuration types & Zod schemas
│   │   #   LoadBalancerConfig, ProviderEntry, StrategyConfig
│   │
│   ├── registry/
│   │   ├── index.ts          # ProviderRegistry — pool of provider endpoints
│   │   ├── provider-entry.ts # ProviderEntry — single provider config + state
│   │   └── model-alias.ts    # ModelAliasMap — logical model → provider model mappings
│   │
│   ├── profiles/
│   │   ├── index.ts              # Public exports: ProviderProfile, ProviderProfileConfig, fromConfig()
│   │   ├── registry.ts           # ProfileRegistry — registered profiles + lookup
│   │   ├── types.ts              # ProviderProfileConfig (Zod schema), ProviderProfile (code interface)
│   │   ├── from-config.ts        # fromConfig() — converts ProviderProfileConfig → ProviderProfile
│   │   ├── generic-header-parser.ts  # Generic header extraction using rateLimitHeaders mappings
│   │   ├── generic-error-classifier.ts  # Generic error classification using errorRules
│   │   ├── generic-probe.ts      # Generic HTTP probe using usageProbe config
│   │   │
│   │   ├── builtins/
│   │   │   ├── index.ts              # BUILT_IN_PROFILE_CONFIGS — all pre-registered configs
│   │   │   ├── openai.ts              # OpenAI config (Azure OpenAI shares most fields)
│   │   │   ├── anthropic.ts           # Anthropic / Claude config
│   │   │   ├── xai.ts                 # xAI / Grok config
│   │   │   ├── deepseek.ts            # DeepSeek config (concurrency-based)
│   │   │   ├── deepinfra.ts           # DeepInfra config (per-model RPM + TPM + probe API)
│   │   │   ├── perplexity.ts          # Perplexity config (leaky bucket, multiple sub-APIs)
│   │   │   ├── meta.ts                # Meta / Llama config (header-based)
│   │   │   ├── ollama-cloud.ts        # Ollama Cloud config (cloud-hosted, has rate limits)
│   │   │   ├── ollama-local.ts        # Ollama Local config (self-hosted, no rate limits)
│   │   │   ├── gemini.ts              # Google Gemini / Vertex AI config
│   │   │   ├── bedrock.ts             # AWS Bedrock config (ThrottlingException)
│   │   │   ├── zai.ts                 # Z.AI config (concurrency, project-based)
│   │   │   ├── opencode.ts            # OpenCode config (dollar-spend caps)
│   │   │   │
│   │   │   └── generic-openai.ts      # ⭐ Generic OpenAI-compatible config
│   │   │       #   Works for ANY provider exposing /v1/chat/completions:
│   │   │       #   OpenRouter, Together AI, Fireworks AI, Groq, Cerebras,
│   │   │       #   SambaNova, Novita AI, Monster API, Replicate, etc.
│   │   │
│   │   └── code-extensions/        # Optional code-level profiles (escape hatch)
│   │       ├── deepseek.ts            # Custom classifyError() for misleading error types
│   │       └── ...
│   │
│   ├── usage/
│   │   ├── index.ts              # UsageTracker — aggregated usage per provider/model
│   │   ├── header-parser.ts      # extractUsageFromHeaders() — dispatches to profile
│   │   ├── local-counter.ts      # LocalCounter — track own requests/tokens
│   │   └── probe/
│   │       ├── index.ts          # UsageProbeManager — orchestrates active polling
│   │       └── *.ts              # Provider probes (delegated to profiles)
│   │
│   ├── health/
│   │   ├── index.ts              # HealthTracker — per-provider health state
│   │   ├── circuit-breaker.ts    # CircuitBreaker — CLOSED/OPEN/HALF-OPEN state machine
│   │   ├── latency-tracker.ts    # LatencyTracker — rolling window of response times
│   │   └── error-classifier.ts   # classifyError() — determine if error is retryable
│   │
│   ├── strategy/
│   │   ├── index.ts              # RouterStrategy interface
│   │   ├── round-robin.ts        # RoundRobinStrategy
│   │   ├── weighted.ts           # WeightedStrategy
│   │   ├── least-connections.ts  # LeastConnectionsStrategy
│   │   ├── latency-based.ts      # LatencyBasedStrategy
│   │   ├── cost-based.ts         # CostBasedStrategy
│   │   ├── priority.ts           # PriorityFallbackStrategy
│   │   └── adaptive.ts           # AdaptiveStrategy (composite scorer)
│   │
│   ├── retry/
│   │   └── failover.ts           # retryWithFailover() — retry across providers
│   │
│   ├── middleware/
│   │   ├── index.ts              # MiddlewareChain — pre/post hooks around requests
│   │   ├── usage-mw.ts           # Updates usage tracker from response headers
│   │   ├── health-mw.ts          # Updates health tracker from response/error
│   │   └── logging-mw.ts         # Structured logging of routing decisions
│   │
│   ├── metrics/
│   │   ├── index.ts              # MetricsCollector — routing metrics
│   │   └── types.ts              # RoutingDecision, ProviderMetrics, etc.
│   │
│   └── errors.ts                 # AllProvidersExhaustedError, NoHealthyProviderError
│
└── __tests__/
    ├── client.test.ts
    ├── registry.test.ts
    ├── profiles/
    │   ├── registry.test.ts       # Profile registration and lookup
    │   ├── openai.test.ts
    │   ├── anthropic.test.ts
    │   ├── generic-openai.test.ts
    │   └── ...
    ├── usage.test.ts
    ├── health.test.ts
    ├── circuit-breaker.test.ts
    ├── strategy/
    │   ├── round-robin.test.ts
    │   ├── weighted.test.ts
    │   ├── adaptive.test.ts
    │   └── ...
    ├── retry.test.ts
    ├── integration.test.ts
    └── fixtures/
        ├── mock-providers.ts
        └── header-samples.ts
```

### 5.2 Core Interfaces

```typescript
// ─── src/client.ts ───

import type { CompletionRequest, CompletionResponse } from '@agentsy/types';
import type { UniversalClient } from '@agentsy/providers';
import type { LoadBalancerConfig, RoutingDecision } from './config';

/**
 * The main load-balanced client.
 * Drop-in replacement for UniversalClient that routes across multiple providers.
 */
export interface LoadBalancedClient extends UniversalClient {
  /** Get current routing state for observability */
  getRoutingState(): RoutingState;
  /** Manually mark a provider as unhealthy */
  markProviderUnhealthy(providerId: string, reason: string): void;
  /** Manually mark a provider as healthy */
  markProviderHealthy(providerId: string): void;
  /** Get usage snapshot for all providers */
  getUsageSnapshot(): Map<string, ProviderUsageSnapshot>;
  /** Shutdown: cancel all probes, flush metrics */
  shutdown(): Promise<void>;
}

export interface RoutingState {
  activeProvider: string | null;
  providerStatuses: Map<string, ProviderStatus>;
  recentDecisions: RoutingDecision[];
  totalRequests: number;
  totalFailovers: number;
}

export interface ProviderStatus {
  providerId: string;
  healthy: boolean;
  circuitState: 'closed' | 'open' | 'half-open';
  currentWeight: number;
  estimatedRemainingRpm: number | null;
  estimatedRemainingTpm: number | null;
  averageLatencyMs: number | null;
  errorRate: number;
  lastUsedAt: number | null;
}

export interface ProviderUsageSnapshot {
  providerId: string;
  model: string;
  rpmLimit: number | null;
  rpmRemaining: number | null;
  tpmLimit: number | null;
  tpmRemaining: number | null;
  concurrencyLimit: number | null;
  concurrencyRemaining: number | null;
  resetAt: number | null; // Unix ms when limits reset
  source: 'header' | 'probe' | 'local' | 'unknown';
  lastUpdatedAt: number;
}

/**
 * Factory function — primary public API.
 */
export function createLoadBalancedClient(config: LoadBalancerConfig): LoadBalancedClient;
```

```typescript
// ─── src/config.ts ───

import { z } from 'zod';

export const StrategyNameSchema = z.enum([
  'round-robin',
  'weighted',
  'least-connections',
  'latency-based',
  'cost-based',
  'priority',
  'adaptive'
]);

export type StrategyName = z.infer<typeof StrategyNameSchema>;

export const ProviderEntrySchema = z.object({
  /** Unique identifier for this provider endpoint */
  id: z.string(),
  /**
   * Provider type — must match a registered ProviderProfile's identity.id
   * (or one of its aliases). Open string rather than enum so custom profiles
   * work without schema changes.
   */
  provider: z.string().min(1),
  /** API key (read from env var if not provided) */
  apiKey: z.string().optional(),
  /** Base URL override */
  baseUrl: z.string().url().optional(),
  /** Organization ID (OpenAI, Anthropic) */
  organizationId: z.string().optional(),
  /** Static weight for weighted strategy (default: 1) */
  weight: z.number().min(0).default(1),
  /** Priority for priority-fallback strategy (lower = higher priority, default: 10) */
  priority: z.number().min(1).default(10),
  /** Cost per 1M input tokens (for cost-based routing) */
  costPerMillionInputTokens: z.number().optional(),
  /** Cost per 1M output tokens (for cost-based routing) */
  costPerMillionOutputTokens: z.number().optional(),
  /** Known rate limits (if user wants to override auto-detection) */
  knownLimits: z
    .object({
      rpm: z.number().optional(),
      tpm: z.number().optional(),
      concurrency: z.number().optional()
    })
    .optional(),
  /** Enable active usage probing for this provider */
  enableProbing: z.boolean().default(false),
  /** How often to probe usage API (ms). Default: 30_000 (30s) */
  probeIntervalMs: z.number().min(5_000).default(30_000),
  /** Custom headers to send */
  headers: z.record(z.string()).optional(),
  /** Is this provider enabled? */
  enabled: z.boolean().default(true),
  /** Region/tag for filtering (e.g., "us-east", "eu") */
  region: z.string().optional()
});

export type ProviderEntry = z.infer<typeof ProviderEntrySchema>;

export const CircuitBreakerConfigSchema = z.object({
  /** Number of failures before opening circuit. Default: 5 */
  failureThreshold: z.number().min(1).default(5),
  /** Cooldown period in ms before half-open. Default: 60_000 */
  cooldownMs: z.number().min(1_000).default(60_000),
  /** Number of probe requests in half-open state. Default: 1 */
  halfOpenProbeCount: z.number().min(1).default(1),
  /** Time to ramp from 10% to 100% weight after recovery (ms). Default: 120_000 */
  rampDurationMs: z.number().min(10_000).default(120_000),
  /** HTTP status codes that count as failures. Default: [429, 500, 502, 503, 504] */
  failureStatusCodes: z.array(z.number()).default([429, 500, 502, 503, 504])
});

export const RetryConfigSchema = z.object({
  /** Max retry attempts across all providers. Default: 3 */
  maxAttempts: z.number().min(1).default(3),
  /** Initial backoff delay (ms). Default: 1_000 */
  initialDelayMs: z.number().min(100).default(1_000),
  /** Max backoff delay (ms). Default: 30_000 */
  maxDelayMs: z.number().min(1_000).default(30_000),
  /** Backoff multiplier. Default: 2 */
  backoffFactor: z.number().min(1).default(2),
  /** Whether to add random jitter. Default: true */
  jitter: z.boolean().default(true),
  /** Status codes that trigger retry with next provider. Default: [429, 500, 502, 503, 504] */
  retryableStatusCodes: z.array(z.number()).default([429, 500, 502, 503, 504])
});

export const AdaptiveStrategyConfigSchema = z.object({
  /** Weight of remaining quota in scoring. Default: 0.4 */
  quotaWeight: z.number().min(0).max(1).default(0.4),
  /** Weight of latency score in scoring. Default: 0.3 */
  latencyWeight: z.number().min(0).max(1).default(0.3),
  /** Weight of cost in scoring. Default: 0.2 */
  costWeight: z.number().min(0).max(1).default(0.2),
  /** Weight of error rate in scoring. Default: 0.1 */
  errorRateWeight: z.number().min(0).max(1).default(0.1),
  /** Rolling window size for latency tracking. Default: 50 */
  latencyWindow: z.number().min(10).default(50),
  /** Minimum requests before latency-based scoring kicks in. Default: 5 */
  minRequestsForLatency: z.number().min(1).default(5)
});

export const LoadBalancerConfigSchema = z.object({
  /**
   * Custom provider profile configs to register alongside built-in profiles.
   * Each entry is a ProviderProfileConfig (declarative, JSON-serializable).
   * Profiles are matched to provider entries by identity.id or aliases.
   *
   * Can also accept a file path (string) to a .json or .ts module exporting a config.
   * Custom profiles override built-in profiles with the same ID.
   */
  profiles: z
    .array(
      z.union([
        z.object({
          id: z.string(),
          profile: ProviderProfileConfigSchema // Inline declarative config
        }),
        z.object({
          id: z.string(),
          profilePath: z.string() // Path to .json or .ts module
        })
      ])
    )
    .optional(),
  /** List of provider endpoints to balance across */
  providers: z.array(ProviderEntrySchema).min(1),
  /** Model alias mapping: logical name → per-provider model names */
  modelAliases: z
    .record(
      z.string(), // logical model name (e.g., "gpt-4o")
      z.record(
        z.string(), // provider ID
        z.string() // provider-specific model name
      )
    )
    .default({}),
  /** Routing strategy. Default: "adaptive" */
  strategy: StrategyNameSchema.default('adaptive'),
  /** Default model to use when not specified in request */
  defaultModel: z.string().optional(),
  /** Circuit breaker configuration */
  circuitBreaker: CircuitBreakerConfigSchema.default({}),
  /** Retry configuration */
  retry: RetryConfigSchema.default({}),
  /** Adaptive strategy specific config */
  adaptiveConfig: AdaptiveStrategyConfigSchema.default({}),
  /** Request timeout per provider attempt (ms). Default: 120_000 */
  requestTimeoutMs: z.number().min(1_000).default(120_000),
  /** Enable structured logging of routing decisions. Default: false */
  enableLogging: z.boolean().default(false),
  /** How often to log routing stats (ms). Default: 60_000 */
  logIntervalMs: z.number().min(1_000).default(60_000)
});

export type LoadBalancerConfig = z.infer<typeof LoadBalancerConfigSchema>;
export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;
export type RetryConfig = z.infer<typeof RetryConfigSchema>;
export type AdaptiveStrategyConfig = z.infer<typeof AdaptiveStrategyConfigSchema>;

export interface RoutingDecision {
  timestamp: number;
  model: string;
  selectedProvider: string;
  skippedProviders: Array<{
    providerId: string;
    reason: 'unhealthy' | 'rate_limited' | 'low_quota' | 'circuit_open' | 'disabled' | 'incompatible';
  }>;
  strategy: StrategyName;
  latencyMs: number | null;
  success: boolean;
  error?: string;
}
```

### 5.3 Provider Registry

```typescript
// ─── src/registry/index.ts ───

import type { UniversalClient } from '@agentsy/providers';
import type { ProviderEntry } from '../config';
import { createUniversalClient } from '@agentsy/providers';
import type { HealthTracker } from '../health';
import type { UsageTracker } from '../usage';

/**
 * Manages a pool of UniversalClient instances.
 * Each provider entry maps to one client instance.
 */
export class ProviderRegistry {
  private clients: Map<string, UniversalClient>;
  private entries: Map<string, ProviderEntry>;

  constructor(
    entries: ProviderEntry[],
    private healthTracker: HealthTracker,
    private usageTracker: UsageTracker
  ) {
    // Create a UniversalClient for each entry
    // Store in Map keyed by entry.id
  }

  /** Get a client by provider ID */
  get(providerId: string): UniversalClient | undefined;

  /** Get all enabled, healthy provider IDs */
  getHealthyProviders(): string[];

  /** Get all provider entries */
  getAllEntries(): ProviderEntry[];

  /** Resolve a logical model name to a provider-specific model name */
  resolveModelAlias(logicalModel: string, providerId: string): string;

  /** Get provider entries that support a given model */
  getProvidersForModel(model: string): ProviderEntry[];

  /** Dispose all client resources */
  dispose(): void;
}
```

### 5.4 Usage Tracker

The usage tracker is the central component for maintaining real-time awareness of remaining quotas across all providers.

```typescript
// ─── src/usage/index.ts ───

export interface UsageState {
  // Limits (from headers or config)
  rpmLimit: number | null;
  tpmLimit: number | null;
  concurrencyLimit: number | null;

  // Remaining (continuously updated)
  rpmRemaining: number | null;
  tpmRemaining: number | null;
  concurrencyRemaining: number | null;

  // Local tracking (own requests)
  localRpmCount: number;
  localTpmCount: number;
  localConcurrencyCount: number;
  localRpmResetAt: number; // Window boundary
  localTpmResetAt: number; // Window boundary

  // Metadata
  lastHeaderUpdate: number | null;
  lastProbeUpdate: number | null;
  source: 'header' | 'probe' | 'local' | 'config' | 'unknown';
}

export class UsageTracker {
  private states: Map<string, Map<string, UsageState>>;
  // outer key: providerId, inner key: model

  /**
   * Update usage state from response headers.
   * Called by the usage middleware after every request.
   */
  updateFromHeaders(providerId: string, model: string, headers: Headers | Record<string, string>): UsageState;

  /**
   * Update usage state from probe API response.
   * Called by the probe manager periodically.
   */
  updateFromProbe(providerId: string, model: string, data: ProbeResult): UsageState;

  /**
   * Track a local request (before sending).
   * Increments RPM/TPM/concurrency counters.
   */
  trackRequest(providerId: string, model: string, estimatedInputTokens: number): void;

  /**
   * Untrack a completed request (after response).
   * Decrements concurrency counter, updates token counts from actual usage.
   */
  untrackRequest(
    providerId: string,
    model: string,
    actualUsage: { promptTokens: number; completionTokens: number }
  ): void;

  /**
   * Check if a provider has sufficient remaining quota for a request.
   * Returns { allowed: true/false, reason: string }.
   */
  checkQuota(providerId: string, model: string, estimatedTokens: number): QuotaCheckResult;

  /**
   * Get the current usage state for a provider+model.
   */
  getState(providerId: string, model: string): UsageState;

  /**
   * Get usage state for all providers (for observability).
   */
  getAllStates(): Map<string, Map<string, UsageState>>;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  estimatedHeadroomMs?: number; // How long until quota refreshes
}
```

### 5.5 Health Tracker & Circuit Breaker

```typescript
// ─── src/health/circuit-breaker.ts ───

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount: number = 0;
  private lastFailureAt: number = 0;
  private halfOpenSuccessCount: number = 0;
  private currentWeight: number = 1; // 0.0 to 1.0
  private recoveryStartTime: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * Called before a request. Returns whether the request should proceed.
   */
  canRequest(): { allowed: boolean; reason: string };

  /**
   * Called after a successful request.
   */
  recordSuccess(): void;

  /**
   * Called after a failed request.
   */
  recordFailure(statusCode?: number): void;

  /**
   * Get current state.
   */
  getState(): {
    state: CircuitState;
    failureCount: number;
    currentWeight: number;
    opensAt: number | null; // When circuit will open (if trending)
    closesAt: number | null; // When circuit will transition to half-open
  };

  /**
   * Reset to closed state (manual override).
   */
  reset(): void;
}
```

```typescript
// ─── src/health/index.ts ───

export interface ProviderHealth {
  healthy: boolean;
  circuitState: CircuitState;
  errorRate: number; // 0.0 to 1.0 over last 100 requests
  averageLatencyMs: number | null;
  p95LatencyMs: number | null;
  consecutiveFailures: number;
  lastErrorAt: number | null;
  lastSuccessAt: number | null;
  currentWeight: number; // 0.0 to 1.0 (affected by circuit breaker ramp)
}

export class HealthTracker {
  private circuitBreakers: Map<string, CircuitBreaker>;
  private latencyTrackers: Map<string, LatencyTracker>;
  private errorCounters: Map<string, ErrorCounter>;

  /**
   * Record a successful request.
   */
  recordSuccess(providerId: string, latencyMs: number): void;

  /**
   * Record a failed request.
   */
  recordFailure(providerId: string, statusCode: number, error: Error): void;

  /**
   * Check if a provider is healthy enough to accept requests.
   */
  isHealthy(providerId: string): boolean;

  /**
   * Get full health snapshot for a provider.
   */
  getHealth(providerId: string): ProviderHealth;

  /**
   * Get all health snapshots.
   */
  getAllHealth(): Map<string, ProviderHealth>;

  /**
   * Tick — called periodically to update circuit breaker state
   * (transitions from OPEN → HALF-OPEN after cooldown).
   */
  tick(): void;
}
```

### 5.6 Routing Strategies

```typescript
// ─── src/strategy/index.ts ───

import type { ProviderEntry } from '../config';
import type { HealthTracker } from '../health';
import type { UsageTracker } from '../usage';

/**
 * Selects the best provider for a given request.
 *
 * Implementations MUST:
 * 1. Filter out unhealthy/disabled providers
 * 2. Filter out providers with insufficient quota
 * 3. Return the single best provider ID
 *
 * If no provider is suitable, throw NoHealthyProviderError.
 */
export interface RouterStrategy {
  readonly name: string;

  select(request: CompletionRequest, candidates: ProviderEntry[], health: HealthTracker, usage: UsageTracker): string;

  /** Called periodically to update any internal state */
  tick?(): void;
}

// ─── src/strategy/adaptive.ts ───

/**
 * Adaptive hybrid strategy that scores providers on multiple dimensions.
 *
 * Score = (quotaScore * quotaWeight)
 *       + (latencyScore * latencyWeight)
 *       + (costScore * costWeight)
 *       + (errorScore * errorRateWeight)
 *
 * All scores normalized to 0.0–1.0. Highest score wins.
 *
 * This is the RECOMMENDED default strategy.
 */
export class AdaptiveStrategy implements RouterStrategy {
  constructor(private config: AdaptiveStrategyConfig) {}

  select(request: CompletionRequest, candidates: ProviderEntry[], health: HealthTracker, usage: UsageTracker): string;
}
```

### 5.7 Provider Profile System — Modular, Config-Driven Architecture

This is the **central design innovation** of the load balancer. Instead of scattering per-provider logic across header parsers, error classifiers, usage probes, and health trackers, every provider's behavior is encapsulated in a single declarative configuration object that is **instantiated at setup time** when the load-balancer package is invoked.

#### 5.7.1 Design Principles

1. **Every provider is a profile config** — a declarative, JSON-serializable object describing rate-limit headers, usage probe endpoints, error patterns, defaults, etc.
2. **Profiles are instantiated at setup** — all rate-limit info, usage probe configs, error patterns, and defaults are resolved when `createLoadBalancedClient()` is called. The load-balancer core never does provider-specific work; it only calls the standardized profile interface.
3. **Adding a new provider = adding a config object** — for 90% of providers, no code changes at all. Just pass a new `ProviderProfileConfig` into the `profiles` array of `LoadBalancerConfig`.
4. **Profiles are discovered, not hardcoded** — `ProfileRegistry` looks up profiles by provider ID; built-in profiles are pre-registered but can be overridden
5. **Profiles are composable** — shared logic (e.g., OpenAI-compatible header parsing) is extracted into built-in parser functions referenced by config
6. **Custom profiles via config** — users register their own profiles at runtime; the config object is the universal extension point
7. **Code-level extension for edge cases** — for the ~10% of providers needing truly custom logic (unusual auth flows, non-standard APIs), a `ProviderProfile` code interface exists as an escape hatch
8. **Profiles carry their own defaults** — default rate limits, default costs, default endpoints are all in the profile config

#### 5.7.2 The `ProviderProfileConfig` — Declarative Configuration (Primary)

The `ProviderProfileConfig` is a **fully declarative, JSON-serializable** configuration object. This is the primary way to define providers. Rate-limit header mappings, usage probe endpoints, error classification patterns, default limits, and cost tables are all specified as data — no code required.

```typescript
// ─── src/profiles/types.ts ───

/**
 * Declarative provider profile configuration.
 * JSON-serializable. Instantiated at setup time.
 * Covers 90% of providers without writing any code.
 */
export const ProviderProfileConfigSchema = z.object({
  /** ─── Identity ─── */
  id: z.string(),
  aliases: z.array(z.string()).default([]),
  /** URL patterns for auto-detection */
  urlPatterns: z.array(z.string()).default([]), // Regex strings
  /** Response header patterns for auto-detection */
  headerPatterns: z.record(z.string(), z.string()).default([]),

  /** ─── Endpoints ─── */
  defaultBaseUrl: z.string().optional(),
  defaultApiVersion: z.string().optional(),
  /** Auth header template. Tokens: {apiKey} */
  authHeaderTemplate: z.string().optional(), // e.g., "Bearer {apiKey}"
  /** Additional static headers */
  requestHeaders: z.record(z.string(), z.string()).default({}),

  /** ─── Rate-Limit Header Mappings ─── */
  /**
   * Maps normalized field names to actual header names this provider uses.
   * The load-balancer core uses these mappings to extract rate-limit data
   * from response headers — no provider-specific code needed.
   */
  rateLimitHeaders: z
    .object({
      rpmLimit: z.string().optional(), // e.g., "x-ratelimit-limit-requests"
      rpmRemaining: z.string().optional(), // e.g., "x-ratelimit-remaining-requests"
      rpmReset: z.string().optional(), // e.g., "x-ratelimit-reset-requests"
      tpmLimit: z.string().optional(), // e.g., "x-ratelimit-limit-tokens"
      tpmRemaining: z.string().optional(), // e.g., "x-ratelimit-remaining-tokens"
      tpmReset: z.string().optional(), // e.g., "x-ratelimit-reset-tokens"
      itpmLimit: z.string().optional(), // e.g., "anthropic-ratelimit-input-tokens-limit"
      itpmRemaining: z.string().optional(), // e.g., "anthropic-ratelimit-input-tokens-remaining"
      itpmReset: z.string().optional(), // e.g., "anthropic-ratelimit-input-tokens-reset"
      otpmLimit: z.string().optional(), // e.g., "anthropic-ratelimit-output-tokens-limit"
      otpmRemaining: z.string().optional(), // e.g., "anthropic-ratelimit-output-tokens-remaining"
      otpmReset: z.string().optional(), // e.g., "anthropic-ratelimit-output-tokens-reset"
      retryAfter: z.string().optional(), // e.g., "retry-after"
      concurrencyLimit: z.string().optional(), // Custom header for concurrency
      concurrencyRemaining: z.string().optional()
    })
    .default({}),

  /** ─── Reset Time Parsing ─── */
  /**
   * How to parse reset time values from headers.
   * "seconds" — raw number (e.g., Anthropic: "30")
   * "duration" — Go-style duration (e.g., OpenAI: "6m0s", "1s")
   * "unix" — Unix timestamp (seconds)
   * "unixMs" — Unix timestamp (milliseconds)
   */
  resetTimeFormat: z.enum(['seconds', 'duration', 'unix', 'unixMs']).default('seconds'),

  /** ─── Usage Probe Configuration ─── */
  /**
   * Declarative usage probe definition.
   * If specified, the load-balancer will periodically call this endpoint.
   */
  usageProbe: z
    .object({
      /** HTTP method */
      method: z.enum(['GET', 'POST']).default('GET'),
      /** URL path (relative to baseUrl or absolute) */
      url: z.string(),
      /** How to extract data from the JSON response (JSONPath or key mapping) */
      responseMapping: z.object({
        rpmLimit: z.string().optional(), // e.g., "rate_limit"
        rpmRemaining: z.string().optional(), // e.g., "rate_limit_remaining"
        tpmLimit: z.string().optional(), // e.g., "tpm_rate_limit"
        tpmRemaining: z.string().optional(), // e.g., "tpm_rate_limit_remaining"
        concurrencyLimit: z.string().optional(),
        concurrencyRemaining: z.string().optional(),
        resetAt: z.string().optional() // e.g., "resets_at"
      }),
      /** Polling interval in ms */
      intervalMs: z.number().min(5_000).default(30_000),
      /** Request headers */
      headers: z.record(z.string(), z.string()).default({})
    })
    .optional(),

  /** ─── Error Classification Patterns ─── */
  /**
   * Declarative error classification rules.
   * Evaluated in order; first match wins.
   * If none match, generic defaults apply (429→retryable, 401→permanent).
   */
  errorRules: z
    .array(
      z.object({
        /** HTTP status code to match (undefined = match any) */
        statusCode: z.number().optional(),
        /** Regex pattern to match against error response body */
        bodyPattern: z.string().optional(), // e.g., "rate_limit_error"
        /** JSON pointer to check for error type */
        jsonPointer: z.string().optional(), // e.g., "/error/type"
        /** Classification */
        result: z.object({
          retryable: z.boolean(),
          rateLimited: z.boolean().default(false),
          permanent: z.boolean().default(false),
          reason: z.string()
        })
      })
    )
    .default([]),

  /** ─── Default Limits ─── */
  defaultLimits: z
    .object({
      rpm: z.number().optional(),
      tpm: z.number().optional(),
      concurrency: z.number().optional(),
      models: z
        .record(
          z.object({
            rpm: z.number().optional(),
            tpm: z.number().optional(),
            concurrency: z.number().optional()
          })
        )
        .optional()
    })
    .default({}),

  /** ─── Default Costs ─── */
  defaultCosts: z
    .object({
      inputPerMillion: z.number().optional(),
      outputPerMillion: z.number().optional(),
      currency: z.string().default('USD'),
      models: z
        .record(
          z.object({
            inputPerMillion: z.number(),
            outputPerMillion: z.number()
          })
        )
        .optional()
    })
    .default({}),

  /** ─── Compatibility ─── */
  /** Which NormalizerProvider (from @agentsy/providers) to use */
  normalizerProvider: z.string().optional(),

  /** ─── Code Extension (Escape Hatch) ─── */
  /**
   * Module path or direct reference to a ProviderProfile code object.
   * Only needed for providers with truly custom logic (non-standard auth,
   * unusual APIs, etc.). The code profile's methods OVERRIDE the
   * declarative config above for any method that is defined.
   *
   * When specified at setup time, the config is first converted to a
   * ProviderProfile, then the code extension's methods are merged on top.
   */
  codeExtension: z.string().optional() // Module path or "inline"
});

export type ProviderProfileConfig = z.infer<typeof ProviderProfileConfigSchema>;
```

**Example — fully declarative OpenAI profile config:**

```typescript
const openAiProfileConfig: ProviderProfileConfig = {
  id: 'openai',
  aliases: ['azure-openai'],
  defaultBaseUrl: 'https://api.openai.com/v1',
  authHeaderTemplate: 'Bearer {apiKey}',

  rateLimitHeaders: {
    rpmLimit: 'x-ratelimit-limit-requests',
    rpmRemaining: 'x-ratelimit-remaining-requests',
    rpmReset: 'x-ratelimit-reset-requests',
    tpmLimit: 'x-ratelimit-limit-tokens',
    tpmRemaining: 'x-ratelimit-remaining-tokens',
    tpmReset: 'x-ratelimit-reset-tokens'
  },
  resetTimeFormat: 'duration', // OpenAI uses Go-style durations like "6m0s"

  defaultLimits: {
    rpm: 500, // Tier 1 default
    tpm: 200_000,
    models: {
      'gpt-4o': { rpm: 500, tpm: 200_000 },
      'gpt-4o-mini': { rpm: 5000, tpm: 4_000_000 }
    }
  },

  defaultCosts: {
    inputPerMillion: 2.5,
    outputPerMillion: 10.0,
    models: {
      'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10.0 },
      'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 }
    }
  },

  normalizerProvider: 'openai'
};
```

**Example — fully declarative DeepInfra profile config (with usage probe):**

```typescript
const deepInfraProfileConfig: ProviderProfileConfig = {
  id: 'deepinfra',
  defaultBaseUrl: 'https://api.deepinfra.com/v1/openai',
  authHeaderTemplate: 'Bearer {apiKey}',

  // DeepInfra doesn't expose rate-limit in response headers
  rateLimitHeaders: {},

  // But it has a clean usage probe API!
  usageProbe: {
    method: 'GET',
    url: 'https://api.deepinfra.com/v1/me/rate_limit',
    responseMapping: {
      concurrencyLimit: 'rate_limit',
      tpmLimit: 'tpm_rate_limit'
    },
    intervalMs: 15_000 // Poll every 15s
  },

  defaultLimits: { concurrency: 10, tpm: 100_000 },
  defaultCosts: { inputPerMillion: 0.8, outputPerMillion: 0.8 },

  normalizerProvider: 'openai'
};
```

**Example — fully declarative Anthropic profile config:**

```typescript
const anthropicProfileConfig: ProviderProfileConfig = {
  id: 'anthropic',
  aliases: ['bedrock-anthropic'],
  defaultBaseUrl: 'https://api.anthropic.com',
  authHeaderTemplate: '{apiKey}', // Anthropic uses x-api-key, not Bearer
  requestHeaders: {
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'
  },

  rateLimitHeaders: {
    rpmLimit: 'anthropic-ratelimit-requests-limit',
    rpmRemaining: 'anthropic-ratelimit-requests-remaining',
    rpmReset: 'anthropic-ratelimit-requests-reset',
    tpmLimit: 'anthropic-ratelimit-tokens-limit',
    tpmRemaining: 'anthropic-ratelimit-tokens-remaining',
    tpmReset: 'anthropic-ratelimit-tokens-reset',
    itpmLimit: 'anthropic-ratelimit-input-tokens-limit',
    itpmRemaining: 'anthropic-ratelimit-input-tokens-remaining',
    itpmReset: 'anthropic-ratelimit-input-tokens-reset',
    otpmLimit: 'anthropic-ratelimit-output-tokens-limit',
    otpmRemaining: 'anthropic-ratelimit-output-tokens-remaining',
    otpmReset: 'anthropic-ratelimit-output-tokens-reset',
    retryAfter: 'retry-after'
  },
  resetTimeFormat: 'seconds', // Anthropic returns raw seconds

  errorRules: [
    {
      statusCode: 429,
      jsonPointer: '/error/type',
      bodyPattern: 'rate_limit_error',
      result: { retryable: true, rateLimited: true, permanent: false, reason: 'Rate limited by Anthropic' }
    }
  ],

  defaultLimits: { rpm: 50, tpm: 40_000 },
  defaultCosts: {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    models: {
      'claude-sonnet-4-20250514': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
      'claude-haiku-3-5-20241022': { inputPerMillion: 0.8, outputPerMillion: 4.0 }
    }
  }
};
```

#### 5.7.3 How Setup Instantiation Works

When `createLoadBalancedClient(config)` is called, the following instantiation happens **synchronously at setup time**:

```typescript
// ─── src/client.ts (setup flow) ───

export function createLoadBalancedClient(config: LoadBalancerConfig): LoadBalancedClient {
  // 1. Create ProfileRegistry and register built-in profile configs
  const registry = new ProfileRegistry();
  for (const builtIn of BUILT_IN_PROFILE_CONFIGS) {
    registry.register(fromConfig(builtIn));
  }

  // 2. Register user-provided profile configs (overrides built-ins by ID)
  for (const entry of config.profiles ?? []) {
    const profile = typeof entry.profile === 'string'
      ? loadProfileFromFile(entry.profile)   // Path to .json or .ts module
      : fromConfig(entry.profile as ProviderProfileConfig);  // Inline config object
    registry.registerOrReplace(profile);
  }

  // 3. For each provider entry, resolve its profile and create a UniversalClient
  const providerInstances = config.providers.map(entry => {
    const profile = registry.get(entry.provider);
    if (!profile) throw new UnknownProviderError(entry.provider);

    // Profile provides: auth headers, base URL, request headers
    const clientConfig = {
      provider: profile.normalizerProvider ?? entry.provider,
      baseUrl: entry.baseUrl ?? profile.defaultBaseUrl,
      apiKey: entry.apiKey,
      headers: {
        ...(profile.buildAuthHeaders?.(entry.apiKey ?? '') ?? {}),
        ...profile.buildRequestHeaders?.() ?? {},
        ...entry.headers,
      },
    };
    const client = createUniversalClient(clientConfig);

    return { entry, profile, client };
  });

  // 4. Start usage probes for providers that have them configured
  const probeManager = new UsageProbeManager(registry, usageTracker);
  for (const { entry, profile } of providerInstances) {
    if (entry.enableProbing && profile.probeUsage) {
      probeManager.startProbing(entry, profile);
    }
  }

  // 5. Return LoadBalancedClient — everything is wired up
  return new LoadBalancedClientImpl(providerInstances, registry, ...);
}
```

**Key insight:** The load-balancer core never contains provider-specific logic. It only calls the standardized `ProviderProfile` interface methods. All provider specificity lives in the profile config, which is resolved and instantiated **at setup time**. After setup, the core engine treats all providers identically.

**This means:**

- Adding a provider = adding a `ProviderProfileConfig` object to the `profiles` array
- The config can come from a JSON file, a YAML file, an environment variable, or an inline object
- Built-in profiles are just pre-registered `ProviderProfileConfig` objects
- Custom profiles override built-ins by ID without any code changes to the load-balancer package

#### 5.7.4 The `ProviderProfile` Interface — Code Extension (Escape Hatch)

For the ~10% of providers that need truly custom logic (unusual auth flows, non-standard API protocols, proprietary response formats), the `ProviderProfile` code interface is available. It is the **runtime representation** that the load-balancer core actually calls.

```typescript
// ─── src/profiles/types.ts ───

/**
 * Normalized result of parsing rate-limit response headers.
 * All profiles produce this same shape regardless of provider-specific header format.
 */
export interface HeaderParseResult {
  rpmLimit?: number;
  rpmRemaining?: number;
  rpmResetMs?: number; // Milliseconds until RPM window resets
  tpmLimit?: number;
  tpmRemaining?: number;
  tpmResetMs?: number; // Milliseconds until TPM window resets
  concurrencyLimit?: number;
  concurrencyRemaining?: number;
  retryAfterMs?: number; // Explicit retry-after from server
  rawHeaders?: Record<string, string>; // Pass-through for debugging
}

/**
 * Normalized result of a usage/quota probe API call.
 */
export interface ProbeResult {
  providerId: string;
  model?: string; // null if aggregate (e.g., DeepInfra)
  rpmLimit?: number;
  rpmRemaining?: number;
  tpmLimit?: number;
  tpmRemaining?: number;
  concurrencyLimit?: number;
  concurrencyRemaining?: number;
  resetAt?: number; // Unix ms when limits reset
  timestamp: number;
}

/**
 * Error classification result from a provider response/error.
 */
export interface ErrorClassification {
  retryable: boolean; // Should the load balancer try another provider?
  rateLimited: boolean; // Was this specifically a rate limit error?
  permanent: boolean; // e.g., 401/403 — never retry this provider
  cooldownMs?: number; // Suggested cooldown (from retry-after or heuristic)
  reason: string; // Human-readable explanation
}

/**
 * How the provider identifies itself (for profile auto-detection).
 */
export interface ProviderIdentity {
  /** Canonical provider ID (matches ProviderEntry.provider) */
  id: string;
  /** Alternative IDs this profile handles (e.g., "azure-openai" handled by openai profile) */
  aliases: string[];
  /** URL patterns that auto-detect this provider */
  urlPatterns?: RegExp[];
  /** Response header patterns that confirm identity */
  headerPatterns?: Record<string, RegExp>;
}

/**
 * DEFAULT rate limits for this provider when no headers or probe data is available.
 * These are conservative estimates; actual limits are discovered at runtime.
 */
export interface DefaultLimits {
  rpm?: number;
  tpm?: number;
  concurrency?: number;
  /** Per-model overrides */
  models?: Record<string, { rpm?: number; tpm?: number; concurrency?: number }>;
}

/**
 * ⭐ THE CORE INTERFACE — Every provider profile implements this.
 *
 * A profile encapsulates everything the load balancer needs to know about
 * how a specific provider handles rate limiting, usage reporting,
 * error signaling, and API compatibility.
 *
 * All methods are optional with sensible defaults. A minimal profile
 * only needs `identity` and `defaultBaseUrl`. Everything else can be
 * omitted to use generic fallback behavior.
 */
export interface ProviderProfile {
  /** ─── Identity ─── */
  readonly identity: ProviderIdentity;

  /** ─── Endpoints ─── */
  /** Default base URL for this provider */
  readonly defaultBaseUrl?: string;
  /** Default API version header (e.g., "2024-01-01" for Anthropic) */
  readonly defaultApiVersion?: string;
  /** Build auth headers from an API key */
  buildAuthHeaders?(apiKey: string): Record<string, string>;
  /** Build additional headers for every request (e.g., anthropic-version) */
  buildRequestHeaders?(): Record<string, string>;

  /** ─── Rate Limit Detection ─── */
  /**
   * Parse rate-limit information from response headers.
   * Return null if this provider doesn't expose rate-limit headers.
   */
  parseRateLimitHeaders?(headers: Record<string, string>): HeaderParseResult | null;

  /**
   * Classify an error response to determine retryability.
   * Default: 429/408/500-504 → retryable; 401/400 → permanent.
   * Override for providers with non-standard error formats (e.g., DeepSeek's
   * misleading "invalid_request_error" type on 429s).
   */
  classifyError?(error: unknown, statusCode?: number, responseBody?: unknown): ErrorClassification;

  /**
   * Extract usage information from a successful response body.
   * Some providers include token counts in the JSON body even when
   * headers don't have rate-limit info.
   */
  parseUsageFromBody?(responseBody: unknown): {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | null;

  /** ─── Usage Probing ─── */
  /**
   * Probe the provider's usage/quota API to get current limits.
   * Return null if this provider doesn't have a programmatic usage API.
   * Called periodically by UsageProbeManager.
   */
  probeUsage?(apiKey: string, baseUrl?: string, extraHeaders?: Record<string, string>): Promise<ProbeResult[]>;

  /** Recommended polling interval for usage probes (ms). Default: 60_000 */
  readonly probeIntervalMs?: number;

  /** ─── Defaults ─── */
  /** Conservative default limits when no runtime data is available */
  readonly defaultLimits?: DefaultLimits;

  /** Default cost per 1M tokens (for cost-based routing) */
  readonly defaultCosts?: {
    inputPerMillion?: number;
    outputPerMillion?: number;
    currency?: string; // Default: "USD"
    models?: Record<
      string,
      {
        inputPerMillion: number;
        outputPerMillion: number;
      }
    >;
  };

  /** ─── Compatibility ─── */
  /**
   * Which NormalizerProvider (from @agentsy/providers) to use for
   * response normalization. If null, the provider must be registered
   * with its own normalizer in the providers package.
   */
  readonly normalizerProvider?: string;

  /** ─── Lifecycle ─── */
  /**
   * Called once when the profile is registered.
   * Use for one-time initialization (e.g., fetching model catalog).
   */
  initialize?(): Promise<void>;

  /**
   * Called on shutdown. Clean up resources (probes, timers, etc.).
   */
  dispose?(): Promise<void>;
}
```

#### 5.7.5 Profile Registry

```typescript
// ─── src/profiles/registry.ts ───

/**
 * Central registry for provider profiles.
 *
 * Built-in profiles are registered on import. Custom profiles can be
 * registered at runtime via `register()`.
 *
 * Lookup priority:
 * 1. Exact match on provider ID
 * 2. Match on aliases
 * 3. Auto-detection via URL pattern matching
 * 4. Auto-detection via response header pattern matching
 * 5. Fall back to GenericOpenAIProfile (if URL looks like /v1/chat/completions)
 * 6. Fall back to null (no rate-limit awareness — reactive-only mode)
 */
export class ProfileRegistry {
  private profiles: Map<string, ProviderProfile>;

  /** Register a profile. Throws if ID conflicts with existing registration. */
  register(profile: ProviderProfile): void;

  /** Register a profile, silently replacing any existing profile with the same ID. */
  registerOrReplace(profile: ProviderProfile): void;

  /**
   * Look up a profile by provider ID.
   * Checks exact match first, then aliases.
   */
  get(providerId: string): ProviderProfile | undefined;

  /**
   * Auto-detect profile from a base URL.
   * Iterates through all registered profiles' urlPatterns.
   */
  detectFromUrl(url: string): ProviderProfile | undefined;

  /**
   * Auto-detect profile from response headers.
   * Iterates through all registered profiles' headerPatterns.
   */
  detectFromHeaders(headers: Record<string, string>): ProviderProfile | undefined;

  /** Get all registered profiles. */
  getAll(): ProviderProfile[];

  /** Get profile IDs. */
  getIds(): string[];
}

// Singleton instance with all built-in profiles pre-registered
export const defaultRegistry: ProfileRegistry;

// Convenience: create registry with built-in profiles
export function createDefaultRegistry(): ProfileRegistry;
```

#### 5.7.6 How the Profile System Replaces Scattered Logic

| Before (scattered)                                    | After (config-driven)                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `parseOpenAIHeaders()` in `header-parser.ts`          | Config: `rateLimitHeaders: { rpmRemaining: "x-ratelimit-remaining-requests" }`         |
| `parseAnthropicHeaders()` in `header-parser.ts`       | Config: `rateLimitHeaders: { rpmRemaining: "anthropic-ratelimit-requests-remaining" }` |
| `DeepInfraProbe` class in `probe/deepinfra.ts`        | Config: `usageProbe: { url: "/v1/me/rate_limit", responseMapping: { ... } }`           |
| `classifyError()` with provider switch statement      | Config: `errorRules: [{ statusCode: 429, bodyPattern: "rate_limit_error", ... }]`      |
| Hard-coded `PROVIDER_ENDPOINTS` in `universal-client` | Config: `defaultBaseUrl: "https://api.openai.com/v1"`                                  |
| Provider-specific auth header logic in registry       | Config: `authHeaderTemplate: "Bearer {apiKey}"`                                        |
| Rate-limit defaults spread across config              | Config: `defaultLimits: { rpm: 500, tpm: 200_000 }`                                    |
| Cost per token in ProviderEntry config                | Config: `defaultCosts: { inputPerMillion: 2.50, outputPerMillion: 10.00 }`             |
| Writing a new `.ts` file per provider                 | Adding a JSON/YAML config object to `profiles` array                                   |

The core load-balancer code becomes **provider-agnostic**. The `fromConfig()` function converts any `ProviderProfileConfig` into a `ProviderProfile` at setup time by wiring the config fields to generic parser functions (`genericHeaderParser`, `genericErrorClassifier`, `genericProbe`). The core only calls the standardized `ProviderProfile` interface. Adding a new provider means adding a declarative config object — no code, no imports, no files.

#### 5.7.7 The `fromConfig()` Converter

The `fromConfig()` function is the bridge between declarative config and the runtime interface. It converts a `ProviderProfileConfig` into a `ProviderProfile` by wiring config fields to built-in generic implementations:

```typescript
// ─── src/profiles/from-config.ts ───

import type { ProviderProfile, ProviderProfileConfig } from './types.js';
import { genericHeaderParser } from './generic-header-parser.js';
import { genericErrorClassifier } from './generic-error-classifier.js';
import { genericProbe } from './generic-probe.js';

/**
 * Convert a declarative ProviderProfileConfig into a runtime ProviderProfile.
 * This is called at setup time — once per profile registration.
 */
export function fromConfig(config: ProviderProfileConfig): ProviderProfile {
  const headerMappings = Object.fromEntries(Object.entries(config.rateLimitHeaders).filter(([, v]) => v !== undefined));

  const profile: ProviderProfile = {
    identity: {
      id: config.id,
      aliases: config.aliases,
      urlPatterns: config.urlPatterns.map(p => new RegExp(p)),
      headerPatterns: config.headerPatterns
    },
    defaultBaseUrl: config.defaultBaseUrl,
    defaultApiVersion: config.defaultApiVersion,
    defaultLimits: config.defaultLimits,
    defaultCosts: config.defaultCosts,
    normalizerProvider: config.normalizerProvider,

    // --- From config: auth ---
    buildAuthHeaders: config.authHeaderTemplate
      ? (apiKey: string) => ({
          [extractAuthHeaderName(config.authHeaderTemplate!)]: config.authHeaderTemplate!.replace('{apiKey}', apiKey)
        })
      : undefined,

    buildRequestHeaders:
      Object.keys(config.requestHeaders).length > 0 ? () => ({ ...config.requestHeaders }) : undefined,

    // --- From config: header parsing ---
    parseRateLimitHeaders:
      Object.keys(headerMappings).length > 0
        ? headers => genericHeaderParser(headers, headerMappings, config.resetTimeFormat)
        : undefined,

    // --- From config: error classification ---
    classifyError:
      config.errorRules.length > 0
        ? (error, statusCode, responseBody) =>
            genericErrorClassifier(error, statusCode, responseBody, config.errorRules)
        : undefined,

    // --- From config: usage probe ---
    probeUsage: config.usageProbe
      ? (apiKey, baseUrl, extraHeaders) => genericProbe(config.usageProbe!, apiKey, baseUrl, extraHeaders)
      : undefined,
    probeIntervalMs: config.usageProbe?.intervalMs
  };

  // Merge code extension if provided (override methods)
  if (config.codeExtension) {
    const codeProfile = loadCodeExtension(config.codeExtension);
    return mergeProfiles(profile, codeProfile);
  }

  return profile;
}

/** Extract header name from auth template. E.g., "Bearer {apiKey}" → "Authorization" */
function extractAuthHeaderName(template: string): string {
  const t = template.toLowerCase().trim();
  if (t.startsWith('bearer ')) return 'Authorization';
  return 'x-api-key';
}

/** Load a code-level ProviderProfile from a module path */
function loadCodeExtension(path: string): ProviderProfile {
  // Dynamic import or require — loads .ts/.js module
  // Module must export a ProviderProfile object
}

/** Merge two profiles: code extension methods override config-generated methods */
function mergeProfiles(base: ProviderProfile, override: ProviderProfile): ProviderProfile {
  return { ...base, ...override, identity: base.identity }; // identity always from config
}
```

**This is the key architectural insight:** The `fromConfig()` function means the load-balancer core only ever interacts with `ProviderProfile` objects. The config→profile conversion happens once at setup. Whether the profile came from a JSON file, a YAML file, an inline TypeScript object, or a code extension module is completely transparent to the core engine.

### 5.8 Rate-Limit Header Extractors

Header parsing is **driven by the `rateLimitHeaders` mapping** in each profile's config. The `header-parser.ts` module becomes a thin dispatcher that calls `profile.parseRateLimitHeaders()` (which was generated by `fromConfig()` from the config's `rateLimitHeaders` + `resetTimeFormat` fields):

```typescript
// ─── src/usage/header-parser.ts ───

import type { ProviderProfile, HeaderParseResult } from '../profiles/index.ts';

/**
 * Parse rate-limit headers using the appropriate provider profile.
 *
 * Falls back to generic header pattern matching if no profile is found.
 */
export function parseRateLimitHeaders(
  profile: ProviderProfile | undefined,
  headers: Headers | Record<string, string>
): HeaderParseResult {
  // 1. If profile has a parser, use it
  if (profile?.parseRateLimitHeaders) {
    const result = profile.parseRateLimitHeaders(normalizeHeaders(headers));
    if (result) return result;
  }

  // 2. Fall back to generic pattern matching
  //    Looks for any header matching: x-ratelimit-*, ratelimit-*, retry-after
  return parseGenericHeaders(normalizeHeaders(headers));
}

/**
 * Generic fallback: scan for common rate-limit header patterns.
 * Works for any provider that follows OpenAI/Meta-style conventions.
 */
function parseGenericHeaders(headers: Record<string, string>): HeaderParseResult {
  // Extract any x-ratelimit-limit-*, x-ratelimit-remaining-*, x-ratelimit-reset-*
  // Parse retry-after header
  // Return normalized result
}
```

### 5.9 Usage Probes

Usage probing is **driven by the `usageProbe` config** in each profile's config. The `UsageProbeManager` becomes a scheduler that calls `profile.probeUsage()` (which was generated by `fromConfig()` from the config's `usageProbe` field):

```typescript
// ─── src/usage/probe/index.ts ───

export class UsageProbeManager {
  constructor(
    private registry: ProfileRegistry,
    private usageTracker: UsageTracker
  ) {}

  /**
   * Start periodic probing for a provider entry.
   * Only starts if the provider's profile implements probeUsage().
   */
  startProbing(entry: ProviderEntry): void;

  /**
   * Stop probing for a provider entry.
   */
  stopProbing(providerId: string): void;

  /**
   * Execute a single probe for a provider (called by scheduler).
   */
  private async executeProbe(entry: ProviderEntry): Promise<void> {
    const profile = this.registry.get(entry.provider);
    if (!profile?.probeUsage) return;

    try {
      const results = await profile.probeUsage(entry.apiKey ?? '', entry.baseUrl, entry.headers);
      for (const result of results) {
        this.usageTracker.updateFromProbe(entry.id, result.model ?? '*', result);
      }
    } catch (error) {
      // Probe failed — log and back off, don't crash
      // Next probe interval doubled (up to max)
    }
  }

  /** Stop all probes. */
  shutdown(): void;
}
```

### 5.10 Retry with Provider Fallback

```typescript
// ─── src/retry/failover.ts ───

/**
 * Retry a request across multiple providers.
 *
 * On a retryable error (429, 5xx), the next provider is selected
 * and the request is retried. Non-retryable errors (401, 400) immediately
 * propagate to the caller.
 *
 * Uses exponential backoff with jitter between attempts.
 * Each attempt uses a DIFFERENT provider (not the same one twice).
 */
export async function retryWithFailover(
  request: CompletionRequest,
  providers: ProviderEntry[],
  executeRequest: (provider: ProviderEntry, request: CompletionRequest) => Promise<CompletionResponse>,
  config: RetryConfig,
  healthTracker: HealthTracker,
  strategy: RouterStrategy,
  usageTracker: UsageTracker,
  signal?: AbortSignal
): Promise<CompletionResponse>;

// For streaming:
export async function retryStreamWithFailover(
  request: CompletionRequest,
  providers: ProviderEntry[],
  executeStream: (provider: ProviderEntry, request: CompletionRequest) => Promise<ReadableStream>,
  config: RetryConfig,
  healthTracker: HealthTracker,
  strategy: RouterStrategy,
  usageTracker: UsageTracker,
  signal?: AbortSignal
): Promise<ReadableStream>;
```

### 5.11 Metrics & Observability

```typescript
// ─── src/metrics/types.ts ───

export interface RoutingMetrics {
  /** Total requests routed */
  totalRequests: number;
  /** Total requests that failed over to another provider */
  totalFailovers: number;
  /** Total requests where all providers were exhausted */
  totalExhausted: number;
  /** Per-provider metrics */
  providers: Map<string, ProviderRoutingMetrics>;
  /** Per-model metrics */
  models: Map<string, ModelRoutingMetrics>;
  /** Recent routing decisions (circular buffer, last 100) */
  recentDecisions: RoutingDecision[];
}

export interface ProviderRoutingMetrics {
  providerId: string;
  requestsRouted: number;
  requestsSucceeded: number;
  requestsFailed: number;
  requestsRateLimited: number; // 429s
  requestsTimedOut: number;
  averageLatencyMs: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number | null;
  circuitBreakerOpens: number;
  currentCircuitState: CircuitState;
}

export interface ModelRoutingMetrics {
  model: string;
  totalRequests: number;
  providerDistribution: Map<string, number>; // providerId → request count
  averageLatencyMs: number | null;
  failoverRate: number; // proportion of requests that needed failover
}
```

### 5.12 Configuration Schema

```typescript
// ─── Example configuration ───

const config: LoadBalancerConfig = {
  // Custom provider profiles (instantiated at setup time alongside built-ins)
  profiles: [
    {
      id: 'groq',
      profile: {
        id: 'groq',
        defaultBaseUrl: 'https://api.groq.com/openai/v1',
        authHeaderTemplate: 'Bearer {apiKey}',
        rateLimitHeaders: {
          rpmLimit: 'x-ratelimit-limit-requests',
          rpmRemaining: 'x-ratelimit-remaining-requests',
          tpmLimit: 'x-ratelimit-limit-tokens',
          tpmRemaining: 'x-ratelimit-remaining-tokens'
        },
        defaultLimits: { rpm: 30, tpm: 18_000 },
        defaultCosts: { inputPerMillion: 0.05, outputPerMillion: 0.08 },
        normalizerProvider: 'openai'
      }
    }
    // Or load from file:
    // { id: "fireworks", profilePath: "./profiles/fireworks.json" },
  ],

  providers: [
    {
      id: 'openai-primary',
      provider: 'openai', // Uses built-in openai profile config
      apiKey: process.env.OPENAI_API_KEY,
      weight: 0.6,
      priority: 1,
      costPerMillionInputTokens: 2.5,
      costPerMillionOutputTokens: 10.0,
      enableProbing: true
    },
    {
      id: 'anthropic-fallback',
      provider: 'anthropic', // Uses built-in anthropic profile config
      apiKey: process.env.ANTHROPIC_API_KEY,
      weight: 0.3,
      priority: 2,
      costPerMillionInputTokens: 3.0,
      costPerMillionOutputTokens: 15.0,
      enableProbing: true,
      probeIntervalMs: 30_000
    },
    {
      id: 'deepinfra-cheap',
      provider: 'deepinfra', // Uses built-in deepinfra profile config (with usage probe)
      apiKey: process.env.DEEPINFRA_API_KEY,
      baseUrl: 'https://api.deepinfra.com/v1/openai',
      weight: 0.1,
      priority: 3,
      costPerMillionInputTokens: 0.8,
      costPerMillionOutputTokens: 0.8,
      enableProbing: true,
      probeIntervalMs: 15_000
    },
    {
      id: 'groq-fast',
      provider: 'groq', // Uses custom profile registered above
      apiKey: process.env.GROQ_API_KEY,
      weight: 0.2,
      priority: 2
    },
    {
      id: 'ollama-local-gpu',
      provider: 'ollama', // Uses built-in ollama-local profile config
      baseUrl: 'http://localhost:11434',
      weight: 0.4,
      priority: 1,
      knownLimits: { concurrency: 2 } // Override default concurrency: 1
    }
  ],

  modelAliases: {
    'gpt-4o': {
      'openai-primary': 'gpt-4o',
      'anthropic-fallback': 'claude-sonnet-4-20250514',
      'deepinfra-cheap': 'meta-llama/Meta-Llama-3.1-70B-Instruct',
      'groq-fast': 'llama-3.1-70b-versatile',
      'ollama-local-gpu': 'llama3.1:70b'
    },
    'gpt-4o-mini': {
      'openai-primary': 'gpt-4o-mini',
      'anthropic-fallback': 'claude-haiku-3-5-20241022',
      'deepinfra-cheap': 'meta-llama/Meta-Llama-3.1-8B-Instruct',
      'groq-fast': 'llama-3.1-8b-instant',
      'ollama-local-gpu': 'llama3.1:8b'
    }
  },

  strategy: 'adaptive',

  adaptiveConfig: {
    quotaWeight: 0.4,
    latencyWeight: 0.3,
    costWeight: 0.2,
    errorRateWeight: 0.1
  },

  circuitBreaker: {
    failureThreshold: 5,
    cooldownMs: 60_000,
    rampDurationMs: 120_000
  },

  retry: {
    maxAttempts: 3,
    initialDelayMs: 1_000,
    maxDelayMs: 30_000,
    jitter: true
  },

  requestTimeoutMs: 120_000,
  enableLogging: true
};
```

---

## 6. Data Flow — End-to-End Request Lifecycle

```
Application Code
  │
  │  loadBalancedClient.complete({ model: "gpt-4o", messages: [...] })
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│  LoadBalancedClient.complete(request)                       │
│                                                             │
│  1. Resolve model alias → candidate providers               │
│     "gpt-4o" → [openai-primary, anthropic-fallback,         │
│                deepinfra-cheap]                             │
│                                                             │
│  2. Filter candidates:                                      │
│     - Remove disabled providers                             │
│     - Remove unhealthy providers (circuit breaker)           │
│     - Remove providers with insufficient quota              │
│     → remainingCandidates                                   │
│                                                             │
│  3. Select provider via strategy:                           │
│     AdaptiveStrategy.select(request, remaining, health,     │
│                             usage)                          │
│     → selectedProvider = "openai-primary"                   │
│                                                             │
│  4. Track request in UsageTracker (pre-flight)              │
│                                                             │
│  5. Execute request via UniversalClient:                    │
│     client.complete(resolvedRequest)                        │
│     │                                                       │
│     ├── SUCCESS ──────────────────────────────────┐         │
│     │                                              │         │
│     │  6a. Parse response headers for rate-limit   │         │
│     │      data → UsageTracker.updateFromHeaders() │         │
│     │                                              │         │
│     │  7a. Record success in HealthTracker         │         │
│     │      (latency, success count)                │         │
│     │                                              │         │
│     │  8a. Update MetricsCollector                 │         │
│     │                                              │         │
│     │  9a. Return CompletionResponse               │         │
│     │                                              │         │
│     ├── 429 / RETRYABLE ERROR ─────────────────┐  │         │
│     │                                         │  │         │
│     │  6b. Parse error, extract retry-after    │  │         │
│     │                                         │  │         │
│     │  7b. Record failure in HealthTracker     │  │         │
│     │      (may trip circuit breaker)          │  │         │
│     │                                         │  │         │
│     │  8b. Update UsageTracker                 │  │         │
│     │                                         │  │         │
│     │  9b. Backoff (exponential + jitter)      │  │         │
│     │      delay = min(initial * factor^n,     │  │         │
│     │                maxDelay) * (0.5–1.5)     │  │         │
│     │                                         │  │         │
│     │  10. GOTO STEP 2 with updated health    │  │         │
│     │      (removed failed provider from        │  │         │
│     │       candidates if circuit opened)       │  │         │
│     │                                         │  │         │
│     ├── NON-RETRYABLE ERROR (401, 400) ─────┐  │         │
│     │                                      │  │         │
│     │  11. Immediately throw error          │  │         │
│     │      (do NOT try another provider)    │  │         │
│     │                                      │  │         │
│     └── TIMEOUT ──────────────────────────┐  │         │
│                                          │  │         │
│     12. Treat as retryable → GOTO STEP 2 │  │         │
│                                          │  │         │
│  ┌───────────────────────────────────────┘  │         │
│  │                                          │         │
│  │  ALL PROVIDERS EXHAUSTED                 │         │
│  │                                          │         │
│  │  13. Throw AllProvidersExhaustedError     │         │
│  │      (includes details of all attempts)  │         │
│  │                                          │         │
│  └──────────────────────────────────────────┘           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Streaming flow is identical**, with the addition that:

- Errors during stream reading (mid-stream 429) trigger failover for the NEXT request, not the current one
- Already-emitted chunks are preserved; the caller sees a partial response with an error event
- The pipeline error handling in `@agentsy/core` already yields errors as `{ type: 'error' }` events, which the load balancer hooks into

---

## 7. Provider Profile Catalog

This section documents the provider profile system — the declarative config schema, built-in profile configs, the generic OpenAI-compatible fallback, and how to add custom providers without writing code.

### 7.1 Profile Config Schema Reference

The `ProviderProfileConfig` (defined in `src/profiles/types.ts`) is the primary way to define providers. It is fully declarative and JSON-serializable. All fields are optional except `id`.

**Config field categories:**

| Category               | Fields                                                                                       | Purpose                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Identity**           | `id`, `aliases`, `urlPatterns`, `headerPatterns`                                             | How the profile is discovered and matched to provider entries       |
| **Endpoints**          | `defaultBaseUrl`, `defaultApiVersion`, `authHeaderTemplate`, `requestHeaders`                | How to connect and authenticate                                     |
| **Rate-Limit Headers** | `rateLimitHeaders`, `resetTimeFormat`                                                        | Which response headers contain quota info and how to parse them     |
| **Usage Probe**        | `usageProbe.method`, `usageProbe.url`, `usageProbe.responseMapping`, `usageProbe.intervalMs` | How to proactively poll remaining quota                             |
| **Error Rules**        | `errorRules[]`                                                                               | How to classify error responses as retryable/permanent/rate-limited |
| **Defaults**           | `defaultLimits`, `defaultCosts`                                                              | Conservative estimates when no runtime data is available            |
| **Compatibility**      | `normalizerProvider`                                                                         | Which response normalizer to use from `@agentsy/providers`          |
| **Code Extension**     | `codeExtension`                                                                              | Escape hatch for providers needing custom logic (optional)          |

**Capability tiers (now config-driven):**

| Tier                       | Required Config Fields                                                                  | Behavior                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tier 0 — Reactive Only** | `id`                                                                                    | No header parsing, no probing, no error classification. The load balancer still works — it falls back to local counters + reactive 429 detection. Suitable for unknown providers. |
| **Tier 1 — Header-Aware**  | + `rateLimitHeaders`                                                                    | Can track remaining quota from response headers. No proactive polling. Most providers live here.                                                                                  |
| **Tier 2 — Probe-Aware**   | + `usageProbe`                                                                          | Can actively query remaining quota before limits are hit. Currently only DeepInfra and Anthropic.                                                                                 |
| **Tier 3 — Full**          | + `errorRules`, `defaultLimits`, `defaultCosts`, `authHeaderTemplate`, `requestHeaders` | Complete integration with all load-balancer features.                                                                                                                             |

### 7.2 Built-in Profile Configs

Each built-in profile is a single declarative config object in `src/profiles/builtins/`:

| Config File         | Provider ID         | Aliases             | Tier                    | Key Capabilities                                                                                                    |
| ------------------- | ------------------- | ------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `openai.ts`         | `openai`            | `azure-openai`      | Tier 3                  | 6 rate-limit headers via mappings; Go-style duration reset parsing; per-model cost defaults                         |
| `anthropic.ts`      | `anthropic`         | `bedrock-anthropic` | Tier 3                  | 12+ rate-limit headers (ITPM/OTPM split); `retry-after`; error rules for `rate_limit_error`; `x-api-key` auth       |
| `xai.ts`            | `xai`               | —                   | Tier 0                  | No headers exposed; relies on local counters + reactive 429                                                         |
| `deepseek.ts`       | `deepseek`          | —                   | Tier 0 + code extension | Concurrency-only tracking; custom `classifyError` via code extension for misleading `invalid_request_error` on 429s |
| `deepinfra.ts`      | `deepinfra`         | —                   | Tier 2                  | `usageProbe` via `GET /v1/me/rate_limit` with response mapping; no header-based tracking                            |
| `perplexity.ts`     | `perplexity`        | —                   | Tier 1                  | Leaky bucket model; reactive 429 handling; no headers                                                               |
| `meta.ts`           | `meta`              | `llama`             | Tier 1                  | 4 rate-limit headers (subset of OpenAI pattern); per-team aggregation                                               |
| `ollama-cloud.ts`   | `ollama-cloud`      | —                   | Tier 1                  | Cloud-hosted Ollama API with rate limits; inherits OpenAI-compatible header pattern                                 |
| `ollama-local.ts`   | `ollama`            | `ollama-local`      | Tier 0                  | Self-hosted; no rate-limit awareness; `concurrency: 1` default                                                      |
| `gemini.ts`         | `gemini`            | `vertex-ai`         | Tier 1                  | Google-specific error format (`RESOURCE_EXHAUSTED`); quota project-based                                            |
| `bedrock.ts`        | `bedrock`           | —                   | Tier 1                  | `ThrottlingException` detection via error rules; per-region profiles                                                |
| `zai.ts`            | `zai`               | —                   | Tier 0                  | Concurrency-based (projects); no headers; no probe API                                                              |
| `opencode.ts`       | `opencode`          | —                   | Tier 0                  | Dollar-spend caps; no RPM/TPM                                                                                       |
| `generic-openai.ts` | `openai-compatible` | _any_               | Tier 1                  | Catch-all for any OpenAI-compatible API; generic header pattern auto-detection; URL pattern matching                |

### 7.3 Generic OpenAI-Compatible Profile

The `GenericOpenAIConfig` is the secret weapon for covering the long tail of providers. Since most inference providers expose an OpenAI-compatible API at `/v1/chat/completions` and many follow the `x-ratelimit-*` header convention, a single generic config covers dozens of providers out of the box.

```typescript
// -- src/profiles/builtins/generic-openai.ts --

export const genericOpenAIConfig: ProviderProfileConfig = {
  id: 'openai-compatible',
  aliases: [
    // Aggregators / gateways
    'openrouter',
    'together-ai',
    'fireworks',
    'groq',
    'cerebras',
    'sambanova',
    'novita-ai',
    'monster-api',
    'ai-ml-api',
    'unify-ai',
    // Cloud marketplaces
    'anyscale',
    'replicate'
    // Any future provider
  ],
  urlPatterns: [
    '\\/v1\\/chat\\/completions$', // OpenAI-compatible endpoint
    '\\/v1$' // Base OpenAI-compatible endpoint
  ],

  defaultBaseUrl: 'https://api.openrouter.ai/v1',
  authHeaderTemplate: 'Bearer {apiKey}',

  rateLimitHeaders: {
    rpmLimit: 'x-ratelimit-limit-requests',
    rpmRemaining: 'x-ratelimit-remaining-requests',
    rpmReset: 'x-ratelimit-reset-requests',
    tpmLimit: 'x-ratelimit-limit-tokens',
    tpmRemaining: 'x-ratelimit-remaining-tokens',
    tpmReset: 'x-ratelimit-reset-tokens',
    retryAfter: 'retry-after'
  },

  errorRules: [
    { statusCode: 429, result: { retryable: true, rateLimited: true, permanent: false, reason: 'Rate limited' } },
    { statusCode: 401, result: { retryable: false, rateLimited: false, permanent: true, reason: 'Auth failed' } },
    { statusCode: 403, result: { retryable: false, rateLimited: false, permanent: true, reason: 'Forbidden' } },
    { statusCode: 408, result: { retryable: true, rateLimited: false, permanent: false, reason: 'Timeout' } },
    { statusCode: 500, result: { retryable: true, rateLimited: false, permanent: false, reason: 'Server error' } },
    { statusCode: 502, result: { retryable: true, rateLimited: false, permanent: false, reason: 'Bad gateway' } },
    {
      statusCode: 503,
      result: { retryable: true, rateLimited: false, permanent: false, reason: 'Service unavailable' }
    },
    { statusCode: 504, result: { retryable: true, rateLimited: false, permanent: false, reason: 'Gateway timeout' } }
  ],

  normalizerProvider: 'openai'
};
```

**Providers automatically covered by the generic config:**

- **OpenRouter** -- has its own rate limits on top of underlying providers
- **Together AI** -- OpenAI-compatible with `x-ratelimit-*` headers
- **Fireworks AI** -- OpenAI-compatible with rate limits
- **Groq** -- ultra-fast inference, OpenAI-compatible, strict rate limits
- **Cerebras** -- wafer-scale engine, OpenAI-compatible
- **SambaNova** -- enterprise inference, OpenAI-compatible
- **Novita AI** -- budget inference, OpenAI-compatible
- **AI/ML API** -- aggregator, OpenAI-compatible
- **Unify AI** -- multi-provider, OpenAI-compatible
- **Monster API** -- free tier, OpenAI-compatible
- **Anyscale** -- Ray-based, OpenAI-compatible
- **Replicate** -- serverless, OpenAI-compatible
- **Any new provider** -- if it has `/v1/chat/completions` and `x-ratelimit-*` headers, it just works

### 7.4 Adding a New Provider -- Zero Code

Adding a new provider requires **zero code changes** to the load-balancer package. Just add a `ProviderProfileConfig` object:

**Option A: Inline config in the `profiles` array**

```typescript
import { createLoadBalancedClient, type ProviderProfileConfig } from '@agentsy/load-balancer';

const myNewProvider: ProviderProfileConfig = {
  id: 'groq',
  aliases: [],
  defaultBaseUrl: 'https://api.groq.com/openai/v1',
  authHeaderTemplate: 'Bearer {apiKey}',
  rateLimitHeaders: {
    rpmLimit: 'x-ratelimit-limit-requests',
    rpmRemaining: 'x-ratelimit-remaining-requests',
    rpmReset: 'x-ratelimit-reset-requests',
    tpmLimit: 'x-ratelimit-limit-tokens',
    tpmRemaining: 'x-ratelimit-remaining-tokens',
    tpmReset: 'x-ratelimit-reset-tokens'
  },
  resetTimeFormat: 'seconds',
  defaultLimits: { rpm: 30, tpm: 18_000 },
  defaultCosts: { inputPerMillion: 0.05, outputPerMillion: 0.08 },
  normalizerProvider: 'openai' // Groq uses OpenAI-compatible API format
};

const client = createLoadBalancedClient({
  profiles: [{ id: 'groq', profile: myNewProvider }],
  providers: [
    {
      id: 'groq-fast',
      provider: 'groq',
      apiKey: process.env.GROQ_API_KEY,
      weight: 0.5
    }
    // ... other providers
  ]
});
```

**Option B: Load from a JSON file**

```json
// profiles/groq.json
{
  "id": "groq",
  "defaultBaseUrl": "https://api.groq.com/openai/v1",
  "authHeaderTemplate": "Bearer {apiKey}",
  "rateLimitHeaders": {
    "rpmLimit": "x-ratelimit-limit-requests",
    "rpmRemaining": "x-ratelimit-remaining-requests"
  },
  "resetTimeFormat": "seconds",
  "defaultLimits": { "rpm": 30, "tpm": 18000 },
  "defaultCosts": { "inputPerMillion": 0.05, "outputPerMillion": 0.08 },
  "normalizerProvider": "openai"
}
```

```typescript
const client = createLoadBalancedClient({
  profiles: [{ id: 'groq', profilePath: './profiles/groq.json' }],
  providers: [{ id: 'groq-fast', provider: 'groq', apiKey: process.env.GROQ_API_KEY }]
});
```

**Option C: Override a built-in profile**

```typescript
const client = createLoadBalancedClient({
  profiles: [
    {
      id: 'openai',
      profile: {
        ...defaultOpenAIConfig, // spread built-in config
        defaultLimits: { rpm: 10_000, tpm: 10_000_000 } // override for Enterprise
      }
    }
  ],
  providers: [{ id: 'openai-enterprise', provider: 'openai', apiKey: process.env.OPENAI_KEY }]
});
```

**Option D: Code extension for edge cases**

```typescript
const myCustomProvider: ProviderProfileConfig = {
  id: 'proprietary-llm',
  defaultBaseUrl: 'https://llm.example.com/api',
  authHeaderTemplate: 'Bearer {apiKey}',
  // ... standard config fields ...
  codeExtension: './profiles/proprietary-llm-extension.ts' // Custom logic
};
```

### 7.5 Ollama Cloud

Ollama Cloud is the cloud-hosted version of Ollama (separate from the self-hosted Ollama server). It exposes an OpenAI-compatible API with its own rate limits.

```typescript
// -- src/profiles/builtins/ollama-cloud.ts --

export const ollamaCloudConfig: ProviderProfileConfig = {
  id: 'ollama-cloud',
  defaultBaseUrl: 'https://api.ollama.ai/v1',
  authHeaderTemplate: 'Bearer {apiKey}',
  rateLimitHeaders: {
    rpmLimit: 'x-ratelimit-limit-requests',
    rpmRemaining: 'x-ratelimit-remaining-requests',
    rpmReset: 'x-ratelimit-reset-requests',
    tpmLimit: 'x-ratelimit-limit-tokens',
    tpmRemaining: 'x-ratelimit-remaining-tokens',
    tpmReset: 'x-ratelimit-reset-tokens'
  },
  resetTimeFormat: 'seconds',
  normalizerProvider: 'openai'
};
```

| Aspect                               | Detail                                                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Profile ID**                       | `ollama-cloud`                                                                                                                                             |
| **Base URL**                         | `https://api.ollama.ai/v1` (or regional endpoints)                                                                                                         |
| **API compatibility**                | OpenAI-compatible (`/v1/chat/completions`)                                                                                                                 |
| **Rate-limit mechanism**             | RPM + TPM + concurrent requests (specifics evolving as product matures)                                                                                    |
| **Header parsing**                   | Inherits OpenAI-compatible header pattern via `rateLimitHeaders` mapping; updated as Ollama Cloud docs solidify                                            |
| **Usage probe**                      | TBD (API may add usage endpoints -- add `usageProbe` config when available)                                                                                |
| **Error classification**             | Standard HTTP 429 (OpenAI-compatible error format)                                                                                                         |
| **Default costs**                    | Free tier + paid tiers; costs TBD                                                                                                                          |
| **Key difference from Ollama Local** | Cloud has network latency, rate limits, and billing; Local has none                                                                                        |
| **Load-balancer role**               | Use as a cloud fallback alongside other cloud providers; can be combined with Ollama Local in the same model alias (cloud fallback when local GPU is busy) |

### 7.6 Ollama Local

Ollama Local is the self-hosted Ollama server. It has zero API rate limits -- the operator controls resource allocation.

```typescript
// -- src/profiles/builtins/ollama-local.ts --

export const ollamaLocalConfig: ProviderProfileConfig = {
  id: 'ollama',
  aliases: ['ollama-local'],
  defaultBaseUrl: 'http://localhost:11434',
  // No rate-limit headers -- self-hosted
  rateLimitHeaders: {},
  // No usage probe -- no usage API
  defaultLimits: {
    concurrency: 1 // Ollama default; override via knownLimits in ProviderEntry
  },
  errorRules: [
    { statusCode: 503, result: { retryable: true, rateLimited: false, permanent: false, reason: 'GPU overloaded' } }
  ],
  normalizerProvider: 'ollama'
};
```

| Aspect                               | Detail                                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Profile ID**                       | `ollama` (aliases: `ollama-local`)                                                                                                             |
| **Base URL**                         | `http://localhost:11434` (default)                                                                                                             |
| **API compatibility**                | Native Ollama API (`/api/chat`) + OpenAI-compatible (`/v1/chat/completions`)                                                                   |
| **Rate-limit mechanism**             | **None** -- self-hosted, no API rate limits                                                                                                    |
| **Header parsing**                   | `null` -- never returns rate-limit headers                                                                                                     |
| **Usage probe**                      | `null` -- no usage API                                                                                                                         |
| **Error classification**             | Standard HTTP errors; 503 = model overloaded (GPU memory); retryable                                                                           |
| **Health check**                     | `GET /api/tags` -- verify server is running; `GET /api/ps` -- check running models and GPU usage                                               |
| **Default limits**                   | `concurrency: 1` (by default; can be increased with `OLLAMA_NUM_PARALLEL`)                                                                     |
| **Key difference from Ollama Cloud** | No billing, no rate limits, no network latency (localhost); limited by local GPU/CPU                                                           |
| **Load-balancer role**               | Use as a zero-cost, zero-latency primary for supported models; cloud providers serve as fallback when local capacity is exceeded               |
| **Special handling**                 | Track concurrent requests locally; if `OLLAMA_NUM_PARALLEL` is configured, use that as concurrency limit; monitor GPU memory usage if possible |

## 8. Model Aliasing & Cross-Provider Mapping

Model aliasing is essential because the same logical model may not exist on every provider. The alias map lets users specify one model name and have it transparently mapped.

### Design Principles

1. **Exact match first** — if a provider has the exact model (e.g., `gpt-4o` on OpenAI), use it directly
2. **Alias lookup** — if no exact match, check the alias map for a provider-specific model
3. **Capability-based fallback** — if no alias exists, use `ModelSelector` to find a compatible model on that provider
4. **Quality tiers** — users can specify preferred quality levels (e.g., `gpt-4o` → Claude Sonnet is acceptable, Claude Haiku is a degradation)

### Alias Map Configuration

```typescript
const modelAliases: Record<string, Record<string, string>> = {
  // Logical name → { providerId: providerModelName }
  'gpt-4o': {
    'openai-direct': 'gpt-4o',
    'azure-openai': 'gpt-4o', // Same name, different endpoint
    'anthropic-direct': 'claude-sonnet-4-20250514', // Quality-equivalent
    'deepinfra-proxy': 'meta-llama/Meta-Llama-3.1-70B-Instruct' // Budget fallback
  },
  'gpt-4o-mini': {
    'openai-direct': 'gpt-4o-mini',
    'anthropic-direct': 'claude-haiku-3-5-20241022',
    'deepinfra-proxy': 'meta-llama/Meta-Llama-3.1-8B-Instruct'
  },
  'claude-sonnet': {
    'anthropic-direct': 'claude-sonnet-4-20250514',
    'bedrock-anthropic': 'anthropic.claude-sonnet-4-20250514-v1:0',
    'openai-direct': 'gpt-4o' // Cross-provider fallback
  }
};
```

### Multi-Key Support (Same Provider, Multiple Keys)

For providers where a single key is insufficient (e.g., OpenAI 500 RPM per key, need 2000 RPM), each key is registered as a separate provider entry:

```typescript
const config: LoadBalancerConfig = {
  providers: [
    { id: 'openai-key1', provider: 'openai', apiKey: 'sk-key1...', weight: 0.25 },
    { id: 'openai-key2', provider: 'openai', apiKey: 'sk-key2...', weight: 0.25 },
    { id: 'openai-key3', provider: 'openai', apiKey: 'sk-key3...', weight: 0.25 },
    { id: 'openai-key4', provider: 'openai', apiKey: 'sk-key4...', weight: 0.25 },
    { id: 'anthropic-key1', provider: 'anthropic', apiKey: 'sk-ant-1...', priority: 5 }
  ],
  modelAliases: {
    'gpt-4o': {
      'openai-key1': 'gpt-4o',
      'openai-key2': 'gpt-4o',
      'openai-key3': 'gpt-4o',
      'openai-key4': 'gpt-4o',
      'anthropic-key1': 'claude-sonnet-4-20250514'
    }
  }
};
```

---

## 9. Testing Strategy

### Unit Tests (per module)

| Module            | Test File                        | Key Scenarios                                                                                                         |
| ----------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `header-parser`   | `usage/header-parser.test.ts`    | Parse OpenAI/Anthropic/Meta/generic headers; handle missing headers; handle malformed values                          |
| `local-counter`   | `usage/local-counter.test.ts`    | RPM window rollover; TPM counting; concurrency tracking; window reset                                                 |
| `circuit-breaker` | `health/circuit-breaker.test.ts` | CLOSED→OPEN transition; OPEN→HALF-OPEN after cooldown; HALF-OPEN→CLOSED on success; gradual weight ramp; manual reset |
| `health-tracker`  | `health/index.test.ts`           | Error rate calculation; latency tracking (rolling window); P95 computation; concurrent access                         |
| `round-robin`     | `strategy/round-robin.test.ts`   | Sequential rotation; skip unhealthy; skip exhausted; handle single provider                                           |
| `weighted`        | `strategy/weighted.test.ts`      | Weight distribution; dynamic weight changes; zero-weight exclusion                                                    |
| `adaptive`        | `strategy/adaptive.test.ts`      | Multi-dimensional scoring; quota dominance; latency dominance; cost dominance; cold start (no data)                   |
| `failover`        | `retry/failover.test.ts`         | Single retry; max attempts exhausted; non-retryable error propagation; backoff timing; jitter range                   |
| `registry`        | `registry/index.test.ts`         | Model alias resolution; healthy provider filtering; dispose cleanup                                                   |
| `config`          | `config.test.ts`                 | Zod validation; defaults; invalid config rejection                                                                    |
| `probe/deepinfra` | `usage/probe/deepinfra.test.ts`  | Successful probe; auth failure; network error; response parsing                                                       |
| `metrics`         | `metrics/index.test.ts`          | Counter increments; latency tracking; provider distribution; circular buffer                                          |

### Integration Tests

| Test                  | Description                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `client.test.ts`      | Full `LoadBalancedClient.complete()` flow with mock providers; verify correct provider selected; verify failover on 429 |
| `streaming.test.ts`   | Full `LoadBalancedClient.stream()` flow; verify stream passthrough; verify error-as-event behavior                      |
| `multi-key.test.ts`   | 4 OpenAI keys + 1 Anthropic key; verify distribution; verify independent circuit breakers per key                       |
| `exhaustion.test.ts`  | All providers return 429; verify `AllProvidersExhaustedError` thrown with details                                       |
| `recovery.test.ts`    | Provider recovers from OPEN circuit; verify gradual ramp; verify full restoration                                       |
| `concurrency.test.ts` | 100 parallel requests; verify no race conditions; verify correct provider selection under load                          |

### Mock Provider Fixtures

```typescript
// __tests__/fixtures/mock-providers.ts

/**
 * Creates mock UniversalClient instances for testing.
 * Each mock can be configured to:
 * - Return success with configurable latency
 * - Return 429 after N requests
 * - Return other errors
 * - Return specific rate-limit headers
 * - Track call count and request history
 */
export function createMockProvider(config: {
  id: string;
  latencyMs?: number;
  failAfterRequests?: number; // Start returning 429 after N calls
  failWithStatus?: number; // Status code for failures
  rateLimitHeaders?: Record<string, string>; // Headers to return
  resetAfterMs?: number; // Reset failure state after this time
  totalCapacity?: number; // RPM limit to simulate
}): UniversalClient;
```

---

## 10. Implementation Phases & Milestones

### Phase 1: Foundation & Provider Profile Config System (Weeks 1–3)

**Goal:** Core interfaces, `ProviderProfileConfig` schema, `fromConfig()` converter, `ProfileRegistry`, config, and single-provider passthrough.

- [ ] Create `packages/load-balancer/` package scaffold (package.json, tsup, tsconfig, vitest)
- [ ] Define `ProviderProfileConfigSchema` (Zod) — declarative, JSON-serializable config schema in `src/profiles/types.ts`
- [ ] Define `ProviderProfile` code interface (escape hatch) in `src/profiles/types.ts`
- [ ] Implement `fromConfig()` converter — `ProviderProfileConfig` → `ProviderProfile` in `src/profiles/from-config.ts`
- [ ] Implement `genericHeaderParser()` — uses `rateLimitHeaders` mappings + `resetTimeFormat`
- [ ] Implement `genericErrorClassifier()` — uses `errorRules` array
- [ ] Implement `genericProbe()` — uses `usageProbe` config (method, url, responseMapping)
- [ ] Implement `ProfileRegistry` with `register()`, `get()`, `detectFromUrl()`, `detectFromHeaders()`
- [ ] Implement built-in profile configs in `src/profiles/builtins/` (all as `ProviderProfileConfig` objects):
  - [ ] `generic-openai.ts` — covers 15+ providers out of the box
  - [ ] Tier 0 configs: `ollama-local.ts`, `zai.ts`, `opencode.ts`
  - [ ] Tier 1 configs: `openai.ts`, `anthropic.ts`, `xai.ts`, `deepseek.ts`, `perplexity.ts`, `meta.ts`, `ollama-cloud.ts`, `gemini.ts`, `bedrock.ts`
  - [ ] Tier 2 configs: `deepinfra.ts`, `meta.ts`
- [ ] Define all Zod config schemas in `config.ts` (with `profiles` field accepting `ProviderProfileConfig` or file paths)
- [ ] Implement `ProviderRegistry` with `UniversalClient` creation (uses resolved profiles for auth headers, base URLs)
- [ ] Implement `ModelAliasMap` for model resolution
- [ ] Implement basic `LoadBalancedClient` that passes through to a single provider
- [ ] Write unit tests for config validation, `fromConfig()` conversion, profile registry, alias resolution
- [ ] Write profile registration integration test (custom config → provider entry → successful routing)
- [ ] Write test: verify a provider added via JSON config works identically to built-in
- [ ] Add `@agentsy/load-balancer` to monorepo turbo pipeline

**Deliverable:** A `LoadBalancedClient` that works with a single provider (drop-in for `UniversalClient`).

### Phase 2: Health & Circuit Breaker (Weeks 4–5)

**Goal:** Provider health monitoring and circuit breaker.

- [ ] Implement `CircuitBreaker` state machine (CLOSED/OPEN/HALF-OPEN)
- [ ] Implement `HealthTracker` with error counting and latency tracking
- [ ] Implement `LatencyTracker` with rolling window and percentile computation
- [ ] Implement `ErrorClassifier` (retryable vs non-retryable, by status code and error type)
- [ ] Implement health-aware provider filtering in the selection pipeline
- [ ] Wire health tracking into request/response flow (delegates to `profile.classifyError()`)
- [ ] Write unit tests for circuit breaker transitions, health tracking, error classification

**Deliverable:** Automatic circuit breaking with gradual recovery. Unhealthy providers are skipped.

### Phase 3: Usage Tracking & Header Parsing (Weeks 6–7)

**Goal:** Real-time usage awareness from response headers and local counters.

- [ ] Implement `parseRateLimitHeaders()` for OpenAI, Anthropic, Meta, and generic providers
- [ ] Implement `LocalCounter` for RPM/TPM/concurrency tracking
- [ ] Implement `UsageTracker` that combines header data, local counters, and config
- [ ] Implement `QuotaChecker` (pre-flight quota validation)
- [ ] Wire usage tracking into request/response middleware
- [ ] Write unit tests for all header parsers, local counter window rollovers, quota checks
- [ ] Create `__tests__/fixtures/header-samples.ts` with real header examples from each provider

**Deliverable:** Providers with insufficient quota are automatically skipped. Usage state visible via `getUsageSnapshot()`.

### Phase 4: Routing Strategies (Weeks 8–9)

**Goal:** Multiple pluggable routing strategies.

- [ ] Implement `RoundRobinStrategy`
- [ ] Implement `WeightedStrategy`
- [ ] Implement `LeastConnectionsStrategy`
- [ ] Implement `LatencyBasedStrategy`
- [ ] Implement `PriorityFallbackStrategy`
- [ ] Implement `AdaptiveStrategy` (composite scorer)
- [ ] Implement strategy selection via config
- [ ] Write unit tests for each strategy with various provider states
- [ ] Write integration test comparing strategy outputs

**Deliverable:** Seven routing strategies, configurable via `strategy` field. Adaptive is the default.

### Phase 5: Retry with Failover (Weeks 10–11)

**Goal:** Automatic provider failover on retryable errors.

- [ ] Implement `retryWithFailover()` for non-streaming requests
- [ ] Implement `retryStreamWithFailover()` for streaming requests
- [ ] Implement exponential backoff with jitter
- [ ] Implement `AllProvidersExhaustedError` with full diagnostic details
- [ ] Wire retry logic into `LoadBalancedClient.complete()` and `.stream()`
- [ ] Write unit tests for retry scenarios (single retry, max exhausted, non-retryable, backoff timing)
- [ ] Write integration test for full failover chain

**Deliverable:** Transparent failover across providers on 429/5xx errors. Callers see a single response.

### Phase 6: Active Usage Probing (Weeks 12–13)

**Goal:** Out-of-band usage API polling for supported providers (driven by `usageProbe` config).

- [ ] Implement `UsageProbeManager` (orchestrates periodic polling using `usageProbe` config from profiles)
- [ ] Verify DeepInfra built-in config works end-to-end (`usageProbe.url: "/v1/me/rate_limit"`)
- [ ] Verify Anthropic built-in config works end-to-end (Rate Limits API probe)
- [ ] Verify OpenAI built-in config works end-to-end (organization usage limits)
- [ ] Wire probe results into `UsageTracker.updateFromProbe()`
- [ ] Implement probe lifecycle management (start/stop, error handling, backoff on probe failures)
- [ ] Write unit tests for generic probe with mocked HTTP responses
- [ ] Write integration test for probe → usage tracker → strategy selection

**Deliverable:** Proactive quota awareness for any provider with a `usageProbe` config. Adding a new provider's probe is a 3-line config addition — no code.

### Phase 7: Observability & Metrics (Weeks 14–15)

**Goal:** Routing metrics, logging, and diagnostics.

- [ ] Implement `MetricsCollector` with per-provider and per-model breakdowns
- [ ] Implement structured logging middleware
- [ ] Implement `getRoutingState()` API
- [ ] Implement `getUsageSnapshot()` API
- [ ] Integrate with existing `@agentsy/observability` (OpenTelemetry) if applicable
- [ ] Write tests for metrics accuracy under various failure patterns
- [ ] Add example usage in package README

**Deliverable:** Full observability into routing decisions, provider health, and usage state.

### Phase 8: Polish & Documentation (Weeks 16–18)

**Goal:** Production readiness.

- [ ] Performance optimization (avoid unnecessary allocations in hot path)
- [ ] Edge case hardening (empty provider list, all disabled, model not found)
- [ ] Full API reference documentation (TSDoc)
- [ ] Migration guide (from direct `UniversalClient` usage to `LoadBalancedClient`)
- [ ] Example configurations for common scenarios:
  - Multi-key OpenAI + Anthropic fallback
  - Cost-optimized routing across DeepInfra/OpenRouter/OpenAI
  - Region-aware routing (US vs EU endpoints)
- [ ] Add to CI pipeline (lint, type-check, test, coverage)
- [ ] Code review and final integration testing

**Deliverable:** Production-ready package with documentation, examples, and CI.

---

## Appendix A — Full Rate-Limit Header Matrix

| Header Name                                   | Provider              | Type      | Description                                  |
| --------------------------------------------- | --------------------- | --------- | -------------------------------------------- |
| `x-ratelimit-limit-requests`                  | OpenAI                | Limit     | Max requests per time window                 |
| `x-ratelimit-remaining-requests`              | OpenAI                | Remaining | Requests remaining in current window         |
| `x-ratelimit-reset-requests`                  | OpenAI                | Reset     | Time until request limit resets (e.g., `1s`) |
| `x-ratelimit-limit-tokens`                    | OpenAI                | Limit     | Max tokens per time window                   |
| `x-ratelimit-remaining-tokens`                | OpenAI                | Remaining | Tokens remaining in current window           |
| `x-ratelimit-reset-tokens`                    | OpenAI                | Reset     | Time until token limit resets (e.g., `6m0s`) |
| `anthropic-ratelimit-requests-limit`          | Anthropic             | Limit     | Max requests per minute                      |
| `anthropic-ratelimit-requests-remaining`      | Anthropic             | Remaining | Requests remaining this minute               |
| `anthropic-ratelimit-requests-reset`          | Anthropic             | Reset     | Seconds until request window resets          |
| `anthropic-ratelimit-tokens-limit`            | Anthropic             | Limit     | Max total tokens per minute                  |
| `anthropic-ratelimit-tokens-remaining`        | Anthropic             | Remaining | Total tokens remaining                       |
| `anthropic-ratelimit-tokens-reset`            | Anthropic             | Reset     | Seconds until token window resets            |
| `anthropic-ratelimit-input-tokens-limit`      | Anthropic             | Limit     | Max input tokens per minute                  |
| `anthropic-ratelimit-input-tokens-remaining`  | Anthropic             | Remaining | Input tokens remaining                       |
| `anthropic-ratelimit-input-tokens-reset`      | Anthropic             | Reset     | Seconds until input token window resets      |
| `anthropic-ratelimit-output-tokens-limit`     | Anthropic             | Limit     | Max output tokens per minute                 |
| `anthropic-ratelimit-output-tokens-remaining` | Anthropic             | Remaining | Output tokens remaining                      |
| `anthropic-ratelimit-output-tokens-reset`     | Anthropic             | Reset     | Seconds until output token window resets     |
| `retry-after`                                 | Anthropic, HTTP std   | Reset     | Seconds to wait before next request          |
| `anthropic-priority-input-tokens-limit`       | Anthropic (Priority)  | Limit     | Priority tier input token limit              |
| `anthropic-priority-input-tokens-remaining`   | Anthropic (Priority)  | Remaining | Priority tier input tokens remaining         |
| `anthropic-priority-output-tokens-limit`      | Anthropic (Priority)  | Limit     | Priority tier output token limit             |
| `anthropic-priority-output-tokens-remaining`  | Anthropic (Priority)  | Remaining | Priority tier output tokens remaining        |
| `anthropic-fast-ratelimit-*`                  | Anthropic (Fast mode) | Various   | Fast mode rate limit headers                 |
| `x-ratelimit-limit-tokens`                    | Meta                  | Limit     | Max tokens per time window                   |
| `x-ratelimit-remaining-tokens`                | Meta                  | Remaining | Tokens remaining                             |
| `x-ratelimit-limit-requests`                  | Meta                  | Limit     | Max requests per time window                 |
| `x-ratelimit-remaining-requests`              | Meta                  | Remaining | Requests remaining                           |

---

## Appendix B — Open Source Reference Libraries

| Library                                                     | Language   | Stars | Key Insight                                                                                                                         |
| ----------------------------------------------------------- | ---------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [Bifrost](https://github.com/getmaxim/bifrost) (Maxim)      | TypeScript | —     | Production AI gateway with weighted routing, circuit breaker, semantic caching, proactive tracking, gradual recovery                |
| [openlimit](https://github.com/shobrook/openlimit)          | Python     | 160   | GCRA rate limiting for OpenAI; precise per-second enforcement; Redis-backed distributed support; context manager and decorator APIs |
| [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)     | Hosted     | —     | Endpoint pooling and rate limiting; **insufficient alone** for multi-provider (Reddit: still hits individual provider limits)       |
| [LiteLLM](https://github.com/BerriAI/litellm)               | Python     | 10K+  | Unified API across 100+ providers; has routing and fallback; good reference for model aliasing patterns                             |
| [Portkey AI Gateway](https://github.com/Portkey-ai/gateway) | TypeScript | —     | Open-source AI gateway with load balancing, retries, caching, and observability                                                     |
| [RouteLLM](https://github.com/lm-sys/RouteLLM)              | Python     | —     | LLM router that classifies prompt complexity and routes to appropriate model size; academic approach                                |

**Key patterns to adopt from these libraries:**

1. **Bifrost**: Gradual weight recovery, proactive tracking, semantic caching hooks
2. **openlimit**: GCRA algorithm for precise local rate limiting, Redis-backed distributed coordination
3. **LiteLLM**: Comprehensive model aliasing table, provider normalization
4. **Portkey**: Middleware chain pattern, structured logging of routing decisions

---

_This plan represents approximately 18 weeks of implementation work for a single engineer, or 10–12 weeks for a pair. The phased approach allows each component to be tested independently before integration._
