export type {
  HeadroomConfidence,
  ReplicaAwareUsage,
  ReplicaBudget,
  ReplicaHeadroomSnapshot,
  ReplicaUsageFields
} from './quotas/headroom.js';

// Replica-level routing types
export {
  alignToHour,
  alignToMonth,
  alignToWeek,
  computeHeadroomPercentage,
  HOUR_MS,
  MONTH_MS,
  WEEK_MS
} from './quotas/headroom.js';
export { UsageAggregator } from './quotas/usage-aggregator.js';
export type { ReplicaHeadroomProvider } from './routing/headroom-provider.js';
export { createReplicaHeadroomProvider } from './routing/headroom-provider.js';
// Quota reconciliation
export type { HeaderSnapshotInput, ReconciledQuotaSnapshot } from './routing/quota-reconciliation.js';
export { reconcileQuotaConfidence } from './routing/quota-reconciliation.js';
// Replica skew signals
export type { ReplicaSkewSignal } from './routing/replica-skew.js';
export { computeReplicaSkew } from './routing/replica-skew.js';
// Routing diagnostics report
export type { ReplicaDiagnosticEntry, RoutingDiagnosticsReport } from './routing/routing-report.js';
export { buildRoutingReport } from './routing/routing-report.js';
// Session ledger types & writer
export type {
  ArtifactRecord,
  CreateSessionLedgerEntryOptions,
  FrustrationRecord,
  QualityRecord,
  SessionLedgerEntry,
  SpendRecord
} from './ledger/index.js';
export { createSessionLedgerEntry } from './ledger/index.js';
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
