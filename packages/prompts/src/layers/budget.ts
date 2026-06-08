/**
 * Budget allocation types and function for @agentsy/prompts.
 *
 * Defines the {@link BudgetAllocation} interface that tracks how a total
 * prompt budget is split between different prompt layers and the
 * {@link allocateBudget} function that performs that split deterministically.
 *
 * @module @agentsy/prompts/layers/budget
 */

import type { InstructionsLayer } from './instructions.js';
import type { SkillsLayer } from './skills.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of splitting a total token budget across prompt layers.
 */
export interface BudgetAllocation {
  /** Tokens consumed by instruction layers. */
  readonly baseline: number;
  /** Unused token remainder (always 0 in the current strategy). */
  readonly remaining: number;
  /** Tokens allocated for the task (total - baseline). */
  readonly task: number;
  /** Total budget that was allocated. */
  readonly total: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Allocate a total token budget across instruction and skill layers.
 *
 * The **baseline** is the sum of all instruction-layer token counts. Skills
 * layers are treated as zero-cost for budget purposes. The **task** budget
 * is whatever remains after subtracting the baseline from the total.
 *
 * @param totalBudget - Overall token budget to allocate.
 * @param layers - Composed prompt layers. Only layers with
 *   `type === 'instructions'` contribute to the baseline.
 * @returns A {@link BudgetAllocation} describing how the budget was split.
 */
export function allocateBudget(
  totalBudget: number,
  layers: readonly (InstructionsLayer | SkillsLayer)[]
): BudgetAllocation {
  const baseline = layers.reduce((sum, layer) => (layer.type === 'instructions' ? sum + layer.tokenCount : sum), 0);

  return {
    baseline,
    task: totalBudget - baseline,
    remaining: 0,
    total: totalBudget
  };
}
