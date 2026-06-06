/**
 * Model-tier routing barrel. Re-exports all types, registries,
 * and the default selector for tier-aware model selection.
 *
 * Tiers are defined on `ModelEntry`, not `ProviderEntry`.
 * A single provider may host models across all tiers.
 * A single logical model may be served by multiple replicas.
 */

export { ModelAvailabilityTracker, type CircuitState, type ModelAvailability } from './availability-tracker.js';
export { LocalModelDetector } from './local-detector.js';
export { getAllLogicalModels, getLogicalModel, getLogicalModelsByTier } from './logical-models.js';
export { ModelRegistry, modelRegistry } from './model-registry.js';
export { ReplicaRegistry, type ReplicaPhase } from './replica-registry.js';
export { DefaultReplicaSelector, type ReplicaSelectionContext, type ReplicaSelector } from './replica-selector.js';
export { computeReplicaScore, type ReplicaScoreInput, type ReplicaScoreWeights } from './score/replica-score.js';
export { DefaultTierAwareModelSelector } from './selector.js';
export { type SpilloverResult, spillover } from './spillover.js';
export type {
  LogicalModel,
  ModelCapabilities,
  ModelCost,
  ModelEntry,
  ModelReplica,
  UseCase,
  ModelSelectionConstraints,
  ModelSelectionResult,
  ModelTier,
  ReplicaHealthSnapshot,
  ReplicaQuotaSnapshot,
  TierAwareModelSelector
} from './types.js';
