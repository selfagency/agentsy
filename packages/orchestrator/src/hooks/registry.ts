/**
 * @module Hook registry — dependency-aware registration and execution planning.
 *
 * Provides a {@link HookRegistry} that validates hook definitions, prevents
 * duplicate names, compiles hooks into an execution plan, and resolves
 * conflicts.
 */

import { compileHooks } from './compile.js';
import type { ConflictWarning, HookDefinition, HookExecutionPlan, HookPhase } from './types.js';

// ---------------------------------------------------------------------------
// HookRegistry
// ---------------------------------------------------------------------------

/**
 * Registry for hook definitions with dependency-aware registration and
 * execution-plan caching.
 *
 * - `register()` validates hook definitions and prevents duplicate names.
 * - `getExecutionPlan()` compiles registered hooks into a DAG-sorted plan.
 * - `resolveConflicts()` applies conflict-resolution strategies.
 */
export class HookRegistry {
  private readonly hooks = new Map<string, HookDefinition>();
  private cachedPlan: HookExecutionPlan | null = null;

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  /**
   * Register a hook definition.
   *
   * Validates that the hook has a `name`, `phase`, and that the name is
   * not already registered.
   *
   * @throws {Error} if the name is missing or a duplicate.
   */
  register(hook: HookDefinition): void {
    if (!hook.name) {
      throw new Error('HookRegistry: hook must have a name');
    }
    if (this.hooks.has(hook.name)) {
      throw new Error(`HookRegistry: duplicate hook name "${hook.name}" — hooks must have unique names`);
    }

    this.hooks.set(hook.name, hook);
    this.cachedPlan = null; // invalidate cache
  }

  /**
   * Unregister a hook by name.
   *
   * @returns `true` if the hook was removed, `false` if it didn't exist.
   */
  unregister(name: string): boolean {
    const removed = this.hooks.delete(name);
    if (removed) {
      this.cachedPlan = null; // invalidate cache
    }
    return removed;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * Look up a registered hook by name.
   */
  getHook(name: string): HookDefinition | undefined {
    return this.hooks.get(name);
  }

  /**
   * List all registered hooks, optionally filtered by phase.
   */
  listHooks(phase?: HookPhase): HookDefinition[] {
    const all = [...this.hooks.values()];
    if (phase) {
      return all.filter(h => h.phase === phase);
    }
    return all;
  }

  /**
   * Return the number of registered hooks.
   */
  get size(): number {
    return this.hooks.size;
  }

  // -----------------------------------------------------------------------
  // Execution plan
  // -----------------------------------------------------------------------

  /**
   * Compile the registered hooks into a plan (sorted by DAG + priority).
   *
   * The result is cached until hooks are registered or unregistered.
   */
  getExecutionPlan(): HookExecutionPlan {
    if (this.cachedPlan) {
      return this.cachedPlan;
    }

    const definitions = [...this.hooks.values()];
    if (definitions.length === 0) {
      this.cachedPlan = { order: [], warnings: [] };
      return this.cachedPlan;
    }

    this.cachedPlan = compileHooks(definitions);
    return this.cachedPlan;
  }

  // -----------------------------------------------------------------------
  // Conflict resolution
  // -----------------------------------------------------------------------

  /**
   * Apply conflict-resolution strategies to a list of warnings.
   *
   * For each unique warning (deduplicated by (hook1, hook2, field)):
   * - `skip`:   remove the conflicting hooks from the plan order
   * - `merge`:  keep both — no action needed
   * - `fail`:   throw an error describing the conflict
   * - `defer`:  reorder so that hook2 runs before hook1 (swap in plan)
   *
   * @returns The list of hook names that survived conflict resolution.
   */
  resolveConflicts(warnings: ConflictWarning[]): string[] {
    if (warnings.length === 0) {
      return this.getExecutionPlan().order;
    }

    const plan = this.getExecutionPlan();
    const resolved = new Set(plan.order);
    const seen = new Set<string>();

    type StrategyHandler = (warning: ConflictWarning, plan: HookExecutionPlan, resolved: Set<string>) => void;

    const STRATEGY_HANDLERS: {
      skip: StrategyHandler;
      merge: StrategyHandler;
      fail: StrategyHandler;
      defer: StrategyHandler;
    } = {
      skip: (warning, _plan, resolved) => {
        resolved.delete(warning.hook1);
      },
      merge: () => {
        /* keep both — no action */
      },
      fail: warning => {
        throw new Error(
          `Hook conflict: "${warning.hook1}" conflicts with "${warning.hook2}" ` +
            `over field "${warning.field}" — ${warning.reason}`
        );
      },
      defer: (warning, plan) => {
        const planOrder = plan.order;
        const idx1 = planOrder.indexOf(warning.hook1);
        const idx2 = planOrder.indexOf(warning.hook2);
        if (idx1 !== -1 && idx2 !== -1 && idx1 < idx2) {
          const temp = planOrder[idx1] as string;
          planOrder[idx1] = planOrder[idx2] as string;
          planOrder[idx2] = temp;
        }
      }
    };

    for (const warning of warnings) {
      const key = [warning.hook1, warning.hook2, warning.field].join('::');
      if (seen.has(key)) {
        continue; // deduplicate
      }
      seen.add(key);

      STRATEGY_HANDLERS[warning.strategy]?.(warning, plan, resolved);
    }

    return plan.order.filter(h => resolved.has(h));
  }
}
