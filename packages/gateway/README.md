# @agentsy/gateway

Semantic routing layer for multi-provider LLM access. Drop-in replacement for `UniversalClient` that adds circuit breaking, rate-limit tracking, strategy-based selection, and active usage probing.

## Features

- **Circuit breaking** — Automatic failover on provider outages via `ProviderHealthRegistry` (per-provider circuit breaker).
- **Rate limit tracking** — `QuotaTracker` wraps `@agentsy/tokenomics` and tracks per-provider RPM/TPM budgets from server response headers.
- **Routing strategies** — `round-robin`, `weighted`, `least-connections`, `latency`, `priority-fallback`, `cost-based`, `adaptive`, and `tier-aware`.
- **Active usage probing** — `ProviderProfile.usageProbes[]` (CodexBar-style) describes how to query the provider's quota endpoint and parse the response into the `QuotaTracker`.
- **Tier-aware routing** — `tierAwareStrategy` filters providers by complexity bucket (micro / small / mid / frontier) and escalates on quota / overload.
- **Local provider registration** — `registerLocalProviders(PlatformProfile)` auto-discovers on-device backends (apfel, ollama, vllm, lm-studio, local-ai) and registers them with `tier: 'micro'`.
- **Mid-conversation model switching** — `ModelSwitcher` resolves aliases (e.g. `gpt-4o`, `claude-opus-4`) to provider-specific upstream ids and updates the gateway's active model in place.
- **Metrics** — `MetricsCollector` records per-(provider, model) request counts, error rates, token usage, USD cost, and latency percentiles (p50 / p95 / p99).

## Public surface

```typescript
// Client
createLoadBalancedClient(config, options?): LoadBalancedClient;

// Strategies
createStrategy(name, options?): RoutingStrategy;  // 'adaptive' | 'round-robin' | ...
RoundRobinStrategy, WeightedStrategy, LeastConnectionsStrategy,
LatencyBasedStrategy, PriorityFallbackStrategy, CostBasedStrategy,
AdaptiveStrategy, TierAwareStrategy, buildTierOf,
DEFAULT_PROVIDER_TIERS, ESCALATION_CHAIN, ProviderTier;

// Health + circuit breaking
ProviderHealthRegistry, CircuitBreaker, HealthTracker, LatencyTracker;

// Quota
QuotaTracker, QuotaTrackerRegistry, parseRateLimitHeaders,
RateLimitHeaderSnapshot;

// Probes (CodexBar-style descriptors)
runProbe, defaultApiParse, ProbeContext, probeProvider, probesAreEmpty;

// Retry / failover
retryWithFailover, RetryWithFailoverContext, RetryWithFailoverOptions,
buildStrategy, AllProvidersExhaustedError, ProviderFailureDetail;

// Local providers
registerLocalProviders, LocalPlatformProfile, LocalAccelerator,
LocalBackendProfile, LOCAL_BACKEND_PROFILES;

// Model switching
ModelSwitcher, ModelSwitchConfig, ModelSwitcherOptions, ModelInfo;

// Metrics
MetricsCollector, MetricsSnapshot, ProviderAggregate, LatencyPercentiles,
RequestMetric, TokenCounts;

// Config
LoadBalancerConfig, LoadBalancerConfigSchema, ProviderEntry,
ProviderEntrySchema, RoutingState, ProviderStatus, ProviderStatusSchema,
StrategyName, StrategyNameSchema, ProviderUsageSnapshot;
```

## Migration from `UniversalClient`

```typescript
// Before
import { createUniversalClient } from '@agentsy/providers';
const client = createUniversalClient({ provider: 'openai', apiKey });

// After
import { createLoadBalancedClient } from '@agentsy/gateway';
const client = createLoadBalancedClient({
  providers: [{ id: 'openai-main', name: 'OpenAI', provider: 'openai', apiKey }],
  strategy: 'adaptive'  // default
});
```

The returned `LoadBalancedClient` extends `UniversalClient`, so existing call sites work unchanged. New methods:

- `getRoutingState()` — `{ strategy, providerId, providerStatus, providerCount }`
- `getUsageSnapshot()` — per-provider RPM/TPM/latency/error rate
- `getMetricsSnapshot()` — aggregated metrics across all providers
- `getMetricsProviderAggregate(providerId)` — single-provider metrics
- `createModelSwitcher()` — alias-based model switching
- `markProviderHealthy(id)` / `markProviderUnhealthy(id)` — manual control
- `shutdown()` — release resources

## Routing strategy selection

| Strategy | When to use |
| --- | --- |
| `adaptive` | Production default. Composite score from health, latency, quota, and cost. |
| `round-robin` | Load distribution across equal providers. |
| `weighted` | Capacity-weighted distribution. |
| `least-connections` | Burst protection; routes to the provider with the fewest in-flight requests. |
| `latency` | Pick the provider with the lowest recorded latency. |
| `priority-fallback` | Try providers in declared order; first eligible wins. |
| `cost-based` | Pick the lowest cost per 1K input tokens. |
| `tier-aware` | Filter by complexity bucket (micro / small / mid / frontier), escalate on overload. |

## Tier-aware example

```typescript
import { createLoadBalancedClient, TierAwareStrategy, buildTierOf } from '@agentsy/gateway';

const client = createLoadBalancedClient({
  providers: [
    { id: 'local-ollama', name: 'Ollama', provider: 'openai', baseUrl: 'http://127.0.0.1:11434/v1', tier: 'micro' },
    { id: 'openai', name: 'OpenAI', provider: 'openai', tier: 'mid' },
    { id: 'anthropic', name: 'Anthropic', provider: 'anthropic', tier: 'frontier' }
  ]
  // Pass a custom strategy via createLoadBalancedClient's second arg
});
```

## Local provider registration

```typescript
import { registerLocalProviders, type LocalPlatformProfile } from '@agentsy/gateway';

const profile: LocalPlatformProfile = {
  accelerators: [
    { id: 'ollama', available: true, baseUrl: 'http://nas.lan:11434/v1' },
    { id: 'apfel', available: true }
  ]
};

const entries: ProviderEntry[] = [{ id: 'openai', name: 'OpenAI', provider: 'openai' }];
const { registered, providers } = registerLocalProviders(profile, entries, {
  preferProvider: 'apfel'
});
// entries is now: [openai, local-apfel, local-ollama]
```

## Subpath exports

The gateway re-exports from `@agentsy/providers` and `@agentsy/tokenomics` for the bits it depends on:

- `createLoadBalancedClient` (the main entry)
- `TierAwareStrategy`, `AdaptiveStrategy`, etc. (strategies)
- `registerLocalProviders` (local provider registration)
- `ModelSwitcher` (mid-conversation switching)
- `MetricsCollector` (observability)
