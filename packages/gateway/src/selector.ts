/**
 * Tier-aware model selector. Given a requested `ModelTier`, optional
 * use case, and constraints, selects the best matching `ModelEntry`
 * from the `ModelRegistry`.
 *
 * Selection algorithm:
 *   1. Filter by tier
 *   2. Filter by use case (when provided)
 *   3. Filter by constraints (capabilities, context window, cost)
 *   4. Prefer local models when `preferLocal` is set
 *   5. Sort remaining candidates by cost (cheapest first)
 *   6. Return the best candidate
 *

 * Integration with `MetricsCollector` (future): candidates can be
 * de-ranked by latency percentile or error rate when live telemetry
 * is available.
 */

import { modelRegistry } from './model-registry.js';
import type { ModelEntry, ModelSelectionConstraints, ModelTier, TierAwareModelSelector } from './types.js';

export class DefaultTierAwareModelSelector implements TierAwareModelSelector {
  selectModelForTier(input: {
    constraints?: ModelSelectionConstraints;
    tier: ModelTier;
    useCase?: 'chat' | 'code' | 'reasoning' | 'search' | 'embed' | 'vision';
  }): Promise<ModelEntry> {
    const { tier, useCase, constraints } = input;

    let candidates = modelRegistry.getModelsByTier(tier);
    if (candidates.length === 0) {
      throw new Error(`No models registered for tier: ${tier}`);
    }

    candidates = this.#filterByUseCase(candidates, useCase);
    candidates = this.#filterByConstraints(candidates, constraints);
    candidates = this.#applyPreferences(candidates, constraints);

    if (candidates.length === 0) {
      throw new Error(`No models match the requested criteria (tier=${tier}, useCase=${useCase ?? 'any'})`);
    }

    // Sort by input cost, cheapest first
    candidates.sort((a, b) => a.cost.inputPer1MTokens - b.cost.inputPer1MTokens);
    return Promise.resolve(candidates[0] as ModelEntry);
  }

  #filterByUseCase(candidates: ModelEntry[], useCase: string | undefined): ModelEntry[] {
    if (useCase === undefined) {
      return candidates;
    }
    return candidates.filter(m => m.useCases.includes(useCase as ModelEntry['useCases'][number]));
  }

  #filterByConstraints(candidates: ModelEntry[], constraints: ModelSelectionConstraints | undefined): ModelEntry[] {
    if (constraints === undefined) {
      return candidates;
    }
    let filtered = candidates;

    if (constraints.requireTools) {
      filtered = filtered.filter(m => m.capabilities.tools);
    }
    if (constraints.requireJsonMode) {
      filtered = filtered.filter(m => m.capabilities.jsonMode);
    }
    if (constraints.minContextWindow !== undefined) {
      filtered = filtered.filter(m => m.contextWindow >= (constraints.minContextWindow as number));
    }
    if (constraints.excludeProviders !== undefined && constraints.excludeProviders.length > 0) {
      const excluded = new Set(constraints.excludeProviders);
      filtered = filtered.filter(m => !excluded.has(m.providerId));
    }
    if (constraints.maxUsdPer1KInput !== undefined) {
      const max = constraints.maxUsdPer1KInput;
      filtered = filtered.filter(m => m.cost.inputPer1MTokens <= max);
    }
    if (constraints.maxUsdPer1KOutput !== undefined) {
      const max = constraints.maxUsdPer1KOutput;
      filtered = filtered.filter(m => m.cost.outputPer1MTokens <= max);
    }

    return filtered;
  }

  #applyPreferences(candidates: ModelEntry[], constraints: ModelSelectionConstraints | undefined): ModelEntry[] {
    if (constraints?.preferLocal !== true) {
      return candidates;
    }
    const local = candidates.filter(m => m.isLocal);
    return local.length > 0 ? local : candidates;
  }
}
