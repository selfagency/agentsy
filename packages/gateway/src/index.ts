/**
 * Load-balanced provider routing and failover primitives.
 * Re-exports provider knowledge (profiles, header parsing) from
 * @agentsy/providers and quota tracking from @agentsy/tokenomics.
 */

export { createLoadBalancedClient } from './client.js';
export {
  AdaptiveStrategyConfigSchema,
  CircuitBreakerConfigSchema,
  LoadBalancerConfigSchema,
  RetryConfigSchema
} from './config.js';
export { AllProvidersExhaustedError, type ProviderFailureDetail } from './errors.js';
export { CircuitBreaker } from './health/circuit-breaker.js';
export { HealthTracker } from './health/health-tracker.js';
export { LatencyTracker } from './health/latency-tracker.js';
export { type ProviderHealthEntry, ProviderHealthRegistry } from './health/provider-health-registry.js';
export {
  computeReplicaScore,
  DefaultReplicaSelector,
  DefaultTierAwareModelSelector,
  getAllLogicalModels,
  getLogicalModel,
  getLogicalModelsByTier,
  type LogicalModel,
  type ModelCapabilities,
  type ModelCost,
  type ModelEntry,
  ModelRegistry,
  type ModelReplica,
  type ModelSelectionConstraints,
  type ModelTier,
  modelRegistry,
  ReplicaRegistry,
  type ReplicaScoreInput,
  type ReplicaScoreWeights,
  type ReplicaSelectionContext,
  type ReplicaSelector,
  type SpilloverResult,
  spillover,
  type TierAwareModelSelector
} from './model-tier.js';
export {
  type LatencyPercentiles,
  MetricsCollector,
  type MetricsSnapshot,
  type ProviderAggregate,
  type RequestMetric,
  type TokenCounts
} from './observability/metrics-collector.js';
export {
  type InstrumentedStreamHandle,
  instrumentStream,
  type StreamMetricSummary
} from './observability/stream-tracker.js';
export { probeProvider, probesAreEmpty } from './probes/probe-provider.js';
export { defaultApiParse, type ProbeContext, runProbe } from './probes/run-probe.js';
export { parseRateLimitHeaders, type RateLimitHeaderSnapshot } from './quota/header-parser.js';
export { QuotaTracker, QuotaTrackerRegistry } from './quota/tracker.js';
export { createProviderRegistry, ProviderRegistry } from './registry/index.js';
export {
  LOCAL_BACKEND_PROFILES,
  type LocalAccelerator,
  type LocalBackendProfile,
  type LocalPlatformProfile,
  type RegisterLocalProvidersOptions,
  type RegisterLocalProvidersResult,
  registerLocalProviders
} from './registry/local-providers.js';
export { ModelAliasMap } from './registry/model-alias.js';
export {
  buildStrategy,
  type RetryWithFailoverContext,
  type RetryWithFailoverOptions,
  retryWithFailover
} from './retry.js';
export {
  AdaptiveStrategy,
  CostBasedStrategy,
  createStrategy,
  LatencyBasedStrategy,
  LeastConnectionsStrategy,
  PriorityFallbackStrategy,
  RoundRobinStrategy,
  type StrategyOptions,
  WeightedStrategy
} from './strategies/strategies.js';
export {
  matchesRequest,
  type RoutingStrategy,
  type SelectionContext
} from './strategies/strategy.js';
export {
  buildTierOf,
  DEFAULT_PROVIDER_TIERS,
  ESCALATION_CHAIN,
  type TierAwareOptions,
  TierAwareStrategy
} from './strategies/tier-aware.js';
export { type ModelInfo, type ModelSwitchConfig, ModelSwitcher, type ModelSwitcherOptions } from './switcher.js';
export {
  type GatewayClient,
  type LoadBalancedClient,
  type LoadBalancerConfig,
  type ProviderEntry,
  ProviderEntrySchema,
  type ProviderStatus,
  ProviderStatusSchema,
  type ProviderUsageSnapshot,
  type RoutingState,
  type StrategyName,
  StrategyNameSchema
} from './types.js';
