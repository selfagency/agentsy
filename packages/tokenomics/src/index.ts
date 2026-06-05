export type {
  HeadroomConfidence,
  ReplicaAwareUsage,
  ReplicaBudget,
  ReplicaHeadroomSnapshot,
  ReplicaUsageFields
} from './quotas/headroom.js';

// Replica-level routing types
export { alignToHour, alignToMonth, alignToWeek, HOUR_MS, MONTH_MS, WEEK_MS } from './quotas/headroom.js';
export { UsageAggregator } from './quotas/usage-aggregator.js';
export type { ReplicaHeadroomProvider } from './routing/headroom-provider.js';
export { createReplicaHeadroomProvider } from './routing/headroom-provider.js';
export type {
  AllocationCondition,
  BudgetFilter,
  BudgetPriority,
  CostAnalysis,
  CostAnalysisBudgetSummary,
  OptimizationSuggestion,
  PacingFeedback,
  RateLimit,
  RateLimitStatus,
  RequestType,
  TokenAllocation,
  TokenBudget,
  TokenBudgetConfig,
  TokenLedger,
  TokenLedgerBudget,
  TokenManager,
  TokenRequest,
  TokenUsage,
  UsageFilter
} from './token-manager.js';
export { createInMemoryTokenManager, PacingController } from './token-manager.js';
