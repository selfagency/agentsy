/**
 * Tier-aware budget escalation router.
 *
 * Decides whether a task should be escalated (downgraded to a cheaper tier
 * when budget is tight) or upgraded (moved to a more capable tier when
 * budget headroom allows). Also provides a final fallback for when all
 * higher-tier options have been exhausted.
 *
 * @module @agentsy/orchestrator/intelligence
 */

import type { CostEstimator } from './cost-estimator.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * Tier ordering from highest capability to lowest.
 * Used to navigate up (upgrade) and down (escalation/downgrade) the tier stack.
 */
export const TIER_ORDER: readonly string[] = ['frontier', 'mid', 'small', 'micro'] as const;

// =============================================================================
// TierRouter
// =============================================================================

/**
 * Routes tasks to appropriate tiers based on budget constraints.
 *
 * - {@link suggestEscalation}: Downgrades to a cheaper tier when the estimated
 *   cost exceeds the remaining budget.
 * - {@link suggestUpgrade}: Upgrades to a more capable tier when the estimated
 *   cost is well under budget (less than 30% of remaining budget).
 * - {@link checkAllFailures}: Returns the cheapest tier as a final fallback
 *   when all higher-tier options have been exhausted.
 */
export class TierRouter {
  readonly #estimator: CostEstimator;
  readonly #budgetRemaining: number;

  /**
   * @param estimator - A {@link CostEstimator} instance for tier cost lookups.
   * @param budgetRemaining - Remaining budget in USD to stay within.
   */
  constructor(estimator: CostEstimator, budgetRemaining: number) {
    this.#estimator = estimator;
    this.#budgetRemaining = budgetRemaining;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Check whether the current task tier fits within the remaining budget.
   *
   * If the estimated cost exceeds the budget, this method walks down the
   * {@link TIER_ORDER} (downgrading to progressively cheaper tiers) and
   * returns the first cheaper tier whose estimated cost fits within budget.
   *
   * @param task - The task to evaluate.
   * @param task.tier - Current tier of the task.
   * @param task.estimatedTokens - Estimated input token count.
   * @param task.complexity - Optional complexity multiplier (0..1+).
   * @returns An escalation suggestion, or `null` when no change is needed or
   *          no cheaper tier fits within budget.
   */
  suggestEscalation(task: {
    tier: string;
    estimatedTokens: number;
    complexity?: number;
  }): { newTier: string; reason: string } | null {
    const currentIdx = TIER_ORDER.indexOf(task.tier);

    // Unknown tier — cannot determine escalation path
    if (currentIdx === -1) {
      return null;
    }

    const cost = this.#estimator.estimateCost({
      tier: task.tier,
      estimatedTokens: task.estimatedTokens,
      ...(task.complexity === undefined ? {} : { complexity: task.complexity })
    });

    // Cost is within budget — no escalation needed
    if (cost.estimatedCost <= this.#budgetRemaining) {
      return null;
    }

    // Walk down the tier order to find the first cheaper tier that fits budget
    for (let i = currentIdx + 1; i < TIER_ORDER.length; i++) {
      const cheaperTier = TIER_ORDER[i];
      if (cheaperTier === undefined) {
        continue;
      }
      const cheaperCost = this.#estimator.estimateCost({
        tier: cheaperTier,
        estimatedTokens: task.estimatedTokens,
        ...(task.complexity === undefined ? {} : { complexity: task.complexity })
      });

      if (cheaperCost.estimatedCost <= this.#budgetRemaining) {
        return { newTier: cheaperTier, reason: 'cost_exceeds_budget' };
      }
    }

    // No cheaper tier fits within the remaining budget
    return null;
  }

  /**
   * Check whether the current task has enough budget headroom to upgrade
   * to a more capable (higher) tier.
   *
   * If the estimated cost is less than 30% of the remaining budget, the task
   * can afford a higher tier. Returns `null` when already at the highest tier
   * or when the budget headroom is insufficient.
   *
   * @param task - The task to evaluate.
   * @param task.tier - Current tier of the task.
   * @param task.estimatedTokens - Estimated input token count.
   * @returns An upgrade suggestion, or `null` if no upgrade is warranted.
   */
  suggestUpgrade(task: { tier: string; estimatedTokens: number }): { newTier: string; reason: string } | null {
    const currentIdx = TIER_ORDER.indexOf(task.tier);

    // Already at the highest tier — cannot upgrade further
    if (currentIdx <= 0) {
      return null;
    }

    const cost = this.#estimator.estimateCost({
      tier: task.tier,
      estimatedTokens: task.estimatedTokens
    });

    // Upgrade when cost is under 30% of remaining budget
    if (cost.estimatedCost < this.#budgetRemaining * 0.3) {
      const higherTier = TIER_ORDER[currentIdx - 1];
      if (higherTier === undefined) {
        return null;
      }
      return { newTier: higherTier, reason: 'budget_available_for_upgrade' };
    }

    return null;
  }

  /**
   * Final fallback when all higher-tier options have failed.
   *
   * Returns the cheapest tier (`micro`) so execution can continue with
   * minimal resource usage.
   *
   * @returns A fallback suggestion pointing to the cheapest tier.
   */
  checkAllFailures(): { newTier: string; reason: string } | null {
    return { newTier: 'micro', reason: 'all_higher_tiers_failed' };
  }
}
