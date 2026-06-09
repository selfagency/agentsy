import type { TokenBudget } from '@agentsy/context';
import { BudgetEnforcer } from '@agentsy/context';
import type { HookResult, RuntimeHookEvent } from './types.js';

/**
 * Options for {@link createBudgetHook}.
 */
export interface BudgetHookOptions {
  /**
   * Fraction of the relevant cap that triggers a yellow warning transform.
   * Must be between 0 and 1. Defaults to 0.8 (80%).
   */
  yellowThreshold?: number;
}

const DEFAULT_YELLOW_THRESHOLD = 0.8;

/**
 * Create a budget-enforcement hook that fires on `PreModelCall`.
 *
 * Uses a {@link BudgetEnforcer} internally to track consumption. On each
 * model call the hook checks whether the estimated tokens fit within the
 * configured caps. Returns:
 * - `{ continue: true }` — budget is healthy
 * - `{ transform: { budgetWarning: 'yellow' } }` — approaching a cap
 * - `{ continue: false, reason }` — budget exhausted for a category
 *
 * @param budget - Token budget caps.
 * @param options - Optional configuration (yellow threshold).
 *
 * @example
 * ```ts
 * const hook = createBudgetHook({
 *   contextCap: 128_000,
 *   inputCap: 64_000,
 *   outputCap: 16_384,
 * });
 * registry.register('PreModelCall', hook.handler, {
 *   id: hook.id,
 *   priority: hook.priority,
 * });
 * ```
 */
export function createBudgetHook(
  budget: TokenBudget,
  options?: BudgetHookOptions
): {
  handler: (event: RuntimeHookEvent) => Promise<HookResult>;
  id: string;
  priority: number;
} {
  const enforcer = new BudgetEnforcer(budget);
  const inputCap = budget.inputCap;
  const yellowThreshold = options?.yellowThreshold ?? DEFAULT_YELLOW_THRESHOLD;
  /** Track cumulative input usage across calls for threshold checks. */
  let cumulativeInputUsage = 0;
  /** Whether a yellow warning has been emitted in the current window. */
  let yellowWarningEmitted = false;

  function checkInputBudget(estimated: number): HookResult | null {
    // Hard block if estimated tokens exceed the input cap
    if (Number.isFinite(inputCap) && estimated > inputCap) {
      return {
        continue: false,
        reason: `Input budget exceeded: estimated ${estimated}, cap ${inputCap}`
      };
    }

    // Pre-flight check: can the enforcer accommodate this call?
    if (!enforcer.canAccommodate('input', estimated)) {
      return {
        continue: false,
        reason: `Insufficient remaining input budget: need ${estimated}, available ${enforcer.remaining('input')}`
      };
    }

    return null;
  }

  return {
    id: 'budget:enforce',
    priority: 10,
    handler: (event: RuntimeHookEvent): Promise<HookResult> => {
      try {
        // Only enforce budget before model calls
        if (event.type !== 'PreModelCall') {
          return Promise.resolve({ continue: true });
        }

        const estimated = event.estimatedTokens;

        // Non-finite estimated tokens — skip enforcement
        if (!Number.isFinite(estimated)) {
          return Promise.resolve({ continue: true });
        }

        // Check budget caps
        const budgetResult = checkInputBudget(estimated);
        if (budgetResult !== null) {
          return Promise.resolve(budgetResult);
        }

        // Record usage so subsequent calls see accumulated consumption
        enforcer.recordUsage('input', estimated);
        cumulativeInputUsage += estimated;

        // Emit a yellow warning once per window when accumulated usage crosses the threshold
        if (!yellowWarningEmitted && Number.isFinite(inputCap) && cumulativeInputUsage / inputCap >= yellowThreshold) {
          yellowWarningEmitted = true;
          return Promise.resolve({
            transform: { budgetWarning: 'yellow' }
          });
        }

        return Promise.resolve({ continue: true });
      } catch {
        // Isolate hook errors — never propagate to the main execution loop
        return Promise.resolve({ continue: true });
      }
    }
  };
}
