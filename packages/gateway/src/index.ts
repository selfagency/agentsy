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
export { parseRateLimitHeaders, type RateLimitHeaderSnapshot } from './quota/header-parser.js';
export { QuotaTracker, QuotaTrackerRegistry } from './quota/tracker.js';
export { createProviderRegistry, ProviderRegistry } from './registry/index.js';
export { ModelAliasMap } from './registry/model-alias.js';
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
