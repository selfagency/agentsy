// @agentsy/tokenomics — Spend accountability, frustration tracking, ROI measurement, and agent learning loop.
// This package is the attribution and intelligence layer above @agentsy/context and @agentsy/observability.

// Analytics
export type {
  DeployedAppAnalyticsAdapter,
  DeployedAppErrorMetrics,
  DeployedAppUsageMetrics
} from './analytics/types.js';
// Attribution
export type {
  AiTrailers,
  DeploymentEvent,
  DiffStats,
  SurvivalResult
} from './attribution/types.js';
// Cache
export type {
  CacheAnnotatedContent,
  CacheAnnotatedMessage,
  CacheEfficiencyMetrics,
  SemanticCacheEntry
} from './cache/types.js';
// Learning
export type {
  FailureMode,
  LearningRecord,
  PromptPatch,
  ReinforcedPattern
} from './learning/types.js';
// Ledger
export type {
  ArtifactRecord,
  CommitRef,
  FrustrationRecord,
  LedgerAggregate,
  LedgerFilter,
  LedgerStore,
  QualityRecord,
  SessionLedgerEntry,
  SpendRecord
} from './ledger/types.js';
// ROI
export type {
  CostPerUnit,
  RoiSnapshot,
  SpendVsValueReport
} from './roi/types.js';
// Signals
export type {
  FrustrationEvent,
  FrustrationEventKind,
  FrustrationScore,
  SatisfactionEvent,
  SatisfactionEventKind,
  SignalWeights
} from './signals/types.js';
