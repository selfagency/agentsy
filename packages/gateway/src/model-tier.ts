/**
 * Model-tier routing barrel. Re-exports all types, the registry,
 * and the default selector for tier-aware model selection.
 *
 * Tiers are defined on `ModelEntry`, not `ProviderEntry`.
 * A single provider may host models across all tiers.
 */

export { ModelRegistry, modelRegistry } from './model-registry.js';
export { DefaultTierAwareModelSelector } from './selector.js';
export type {
  ModelCapabilities,
  ModelCost,
  ModelEntry,
  ModelSelectionConstraints,
  ModelTier,
  TierAwareModelSelector
} from './types.js';
