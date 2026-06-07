/**
 * Cost estimation for task tier routing.
 *
 * Provides default cost models for each tier (micro/small/mid/frontier)
 * and a `CostEstimator` class that computes estimated costs based on
 * token usage and task complexity.
 *
 * Architecture note: These are orchestrator-level cost estimates used
 * for budget-aware tier routing. The gateway's `ModelRegistry` owns
 * the actual provider cost tables; this module provides a lightweight
 * planning estimate before a model is selected.
 */

// =============================================================================
// Types
// =============================================================================

export interface TierCostModel {
  /**
   * Estimated ratio of output tokens to input tokens.
   * Used to derive output token count when only input tokens are known.
   * @default 0.3
   */
  readonly averageOutputRatio?: number;
  /** Cost per 1,000 input tokens in USD. */
  readonly inputCostPer1kTokens: number;
  /** Canonical model name for this tier. */
  readonly modelName: string;
  /** Cost per 1,000 output tokens in USD. */
  readonly outputCostPer1kTokens: number;
  /** Tier identifier (e.g., "micro", "small", "mid", "frontier"). */
  readonly tier: string;
}

export interface CostEstimateResult {
  /** Estimated cost in USD. */
  readonly estimatedCost: number;
  /** Estimated number of input tokens. */
  readonly estimatedInputTokens: number;
  /** Estimated number of output tokens (derived from input + ratio + complexity). */
  readonly estimatedOutputTokens: number;
  /** The model name associated with the tier. */
  readonly modelName: string;
  /** The tier used for the estimate. */
  readonly tier: string;
}

// =============================================================================
// Default tier cost models
// =============================================================================

export const TIER_COST_MODELS: readonly TierCostModel[] = [
  {
    tier: 'micro',
    modelName: 'gemini-2.0-flash-lite',
    inputCostPer1kTokens: 0.075,
    outputCostPer1kTokens: 0.3,
    averageOutputRatio: 0.5
  },
  {
    tier: 'small',
    modelName: 'gemini-2.0-flash',
    inputCostPer1kTokens: 0.1,
    outputCostPer1kTokens: 0.4,
    averageOutputRatio: 0.4
  },
  {
    tier: 'mid',
    modelName: 'gemini-2.5-flash',
    inputCostPer1kTokens: 0.15,
    outputCostPer1kTokens: 0.6,
    averageOutputRatio: 0.4
  },
  {
    tier: 'frontier',
    modelName: 'gemini-2.5-pro',
    inputCostPer1kTokens: 1.25,
    outputCostPer1kTokens: 5.0,
    averageOutputRatio: 0.3
  }
] as const;

// =============================================================================
// Error types
// =============================================================================

export class UnknownTierError extends Error {
  readonly tier: string;

  constructor(tier: string) {
    super(`Unknown tier: "${tier}"`);
    this.name = 'UnknownTierError';
    this.tier = tier;
  }
}

// =============================================================================
// CostEstimator
// =============================================================================

export class CostEstimator {
  readonly #models: ReadonlyMap<string, TierCostModel>;

  constructor(models: readonly TierCostModel[] = TIER_COST_MODELS) {
    this.#models = new Map(models.map(m => [m.tier, m]));
  }

  /**
   * Estimate the cost of a task based on its tier, estimated token count,
   * and complexity factor.
   *
   * @param task - Task estimation parameters.
   * @param task.tier - The tier to estimate against. Defaults to "micro".
   * @param task.estimatedTokens - Estimated input token count. Defaults to 1000.
   * @param task.complexity - Complexity multiplier (0..1+). Higher values increase
   *                          expected output tokens. Defaults to 0.
   * @returns A `CostEstimateResult` with the computed estimate.
   * @throws {UnknownTierError} If `task.tier` does not match any known model.
   */
  estimateCost(task: { tier?: string; estimatedTokens?: number; complexity?: number } = {}): CostEstimateResult {
    const model = this.#models.get(task.tier ?? 'micro');

    if (model === undefined) {
      throw new UnknownTierError(task.tier ?? 'micro');
    }

    const estimatedInputTokens = task.estimatedTokens ?? 1000;
    const ratio = model.averageOutputRatio ?? 0.3;
    const estimatedOutputTokens = Math.round(estimatedInputTokens * ratio * (1 + (task.complexity ?? 0) * 0.5));

    const inputCost = (estimatedInputTokens / 1000) * model.inputCostPer1kTokens;
    const outputCost = (estimatedOutputTokens / 1000) * model.outputCostPer1kTokens;
    const estimatedCost = Number((inputCost + outputCost).toFixed(6));

    return {
      tier: model.tier,
      modelName: model.modelName,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCost
    };
  }
}
