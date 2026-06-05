/**
 * Model-tier routing barrel. Re-exports all types, registries,
 * and the default selector for tier-aware model selection.
 *
 * Tiers are defined on `ModelEntry`, not `ProviderEntry`.
 * A single provider may host models across all tiers.
 * A single logical model may be served by multiple replicas.
 */

export { type ModelAvailability, ModelAvailabilityTracker } from './availability-tracker.js';
export { LocalModelDetector } from './local-detector.js';
export { getAllLogicalModels, getLogicalModel, getLogicalModelsByTier } from './logical-models.js';
export { ModelRegistry, modelRegistry } from './model-registry.js';
export { ReplicaRegistry } from './replica-registry.js';
export { DefaultTierAwareModelSelector } from './selector.js';
export type {
  LogicalModel,
  ModelCapabilities,
  ModelCost,
  ModelEntry,
  ModelReplica,
  ModelSelectionConstraints,
  ModelTier,
  TierAwareModelSelector
} from './types.js';
