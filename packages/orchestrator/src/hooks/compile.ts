/**
 * @module Hook compilation — DAG topological sort and conflict detection.
 *
 * Takes an array of {@link HookDefinition} and produces a
 * {@link HookExecutionPlan} with a safe, deterministic execution order
 * and any conflict warnings.
 */

import type { ConflictWarning, HookDefinition, HookExecutionPlan } from './types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a dependency adjacency graph from hook definitions.
 *
 * Each entry maps a hook name → set of hook names it depends on.
 * Unknown dependency names are **not** filtered out here so that
 * {@link topologicalSort} can report them clearly.
 */
function buildAdjacencyGraph(hooks: HookDefinition[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const hook of hooks) {
    graph.set(hook.name, [...(hook.dependencies ?? [])]);
  }

  return graph;
}

/**
 * Look up a hook by name.  Returns `undefined` when the name is unknown.
 */
function findHook(hooks: HookDefinition[], name: string): HookDefinition | undefined {
  return hooks.find(h => h.name === name);
}

/**
 * Validate that every declared dependency resolves to a known hook.
 */
function validateDependencyReferences(hooks: HookDefinition[]): void {
  for (const hook of hooks) {
    for (const dep of hook.dependencies ?? []) {
      if (!findHook(hooks, dep)) {
        throw new Error(`compileHooks: hook "${hook.name}" depends on unknown hook "${dep}"`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// DFS topological sort
// ---------------------------------------------------------------------------

/**
 * Depth-first topological sort with cycle detection.
 *
 * Returns hook names in dependency order (dependencies precede dependents).
 *
 * @throws {Error} when a cycle is detected — the message includes the
 *   cycle path for debugging.
 */
function topologicalSort(graph: Map<string, string[]>): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const inProgress = new Set<string>();

  function visit(node: string, path: string[]): void {
    if (visited.has(node)) {
      return;
    }

    if (inProgress.has(node)) {
      const cyclePath = [...path, node].join(' → ');
      throw new Error(`compileHooks: cycle detected in hook dependencies — ${cyclePath}`);
    }

    inProgress.add(node);
    path.push(node);

    const deps = graph.get(node);
    if (deps) {
      for (const dep of deps) {
        visit(dep, path);
      }
    }

    path.pop();
    inProgress.delete(node);
    visited.add(node);
    result.push(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      visit(node, []);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

/**
 * Walk all hook definitions, cross-reference their conflict specs against
 * other hooks, and produce {@link ConflictWarning} entries.
 *
 * Warnings are deduplicated so that a pair (A, B) only produces one warning
 * regardless of whether both sides declare the conflict.
 */
function detectConflicts(hooks: HookDefinition[]): ConflictWarning[] {
  const seen = new Set<string>();
  const warnings: ConflictWarning[] = [];

  for (const hook of hooks) {
    for (const conflict of hook.conflicts ?? []) {
      // Produce a stable deduplication key independent of declaration order.
      const key = [hook.name, conflict.hookName].sort((a, b) => a.localeCompare(b)).join('::');
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const fields = conflict.contextFields.join(', ');

      warnings.push({
        hook1: hook.name,
        hook2: conflict.hookName,
        field: fields,
        strategy: conflict.strategy,
        reason: conflict.reason
      });
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Level-based priority grouping within DAG constraints
// ---------------------------------------------------------------------------

/**
 * Compute the topological level of each hook.
 *
 * Level 0 = no dependencies.  Level N = all deps are at level < N.
 * Throws if a node is missing from the graph (should not happen when called
 * after `topologicalSort`).
 */
function computeLevels(hooks: HookDefinition[], graph: Map<string, string[]>): Map<string, number> {
  const levels = new Map<string, number>();

  function resolve(name: string): number {
    const cached = levels.get(name);
    if (cached !== undefined) {
      return cached;
    }

    const deps = graph.get(name);
    if (!deps || deps.length === 0) {
      levels.set(name, 0);
      return 0;
    }

    let maxDepLevel = 0;
    for (const dep of deps) {
      maxDepLevel = Math.max(maxDepLevel, resolve(dep) + 1);
    }

    levels.set(name, maxDepLevel);
    return maxDepLevel;
  }

  for (const hook of hooks) {
    resolve(hook.name);
  }

  return levels;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile an array of hook definitions into an executable plan.
 *
 * The algorithm:
 *
 * 1. Build a dependency adjacency graph from each hook's `dependencies`.
 * 2. Validate that all dependency references resolve to a known hook.
 * 3. Run DFS topological sort — throws on cycles with the cycle path.
 * 4. Detect cross-hook conflicts and emit warnings.
 * 5. Compute topological levels and sort each level by priority (higher first).
 * 6. Return the ordered hook names and any conflict warnings.
 *
 * @param hooks - Hook definitions to compile.  At least one required.
 * @returns An execution plan with ordered hook names and conflict warnings.
 *
 * @throws {Error} if the array is empty, contains duplicate names, has
 *   unresolvable dependency references, or contains a cycle.
 */
export function compileHooks(hooks: HookDefinition[]): HookExecutionPlan {
  // ---- Validation --------------------------------------------------------

  if (hooks.length === 0) {
    throw new Error('compileHooks: at least one HookDefinition is required');
  }

  const nameSet = new Set<string>();
  for (const hook of hooks) {
    if (nameSet.has(hook.name)) {
      throw new Error(`compileHooks: duplicate hook name "${hook.name}"`);
    }
    nameSet.add(hook.name);
  }

  validateDependencyReferences(hooks);

  // ---- Build graph & topological sort ------------------------------------

  const graph = buildAdjacencyGraph(hooks);
  // Call topologicalSort for its cycle-detection side effect; the
  // level-based ordering below replaces the need for a raw linear sort.
  topologicalSort(graph);

  // ---- Conflict detection ------------------------------------------------

  const warnings = detectConflicts(hooks);

  // ---- Priority-aware ordering within DAG levels -------------------------

  const levels = computeLevels(hooks, graph);
  const byLevel = new Map<number, HookDefinition[]>();

  for (const hook of hooks) {
    const level = levels.get(hook.name) ?? 0;
    const bucket = byLevel.get(level) ?? [];
    bucket.push(hook);
    byLevel.set(level, bucket);
  }

  // Sort levels ascending so that dependencies precede dependents.
  const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b);
  const order: string[] = [];

  for (const level of sortedLevels) {
    const bucket = byLevel.get(level);
    // Unreachable: every level key was set from a hook that exists.
    if (!bucket) {
      continue;
    }
    // Within the same level, higher priority runs first.
    bucket.sort((a, b) => b.priority - a.priority);
    for (const hook of bucket) {
      order.push(hook.name);
    }
  }

  return { order, warnings };
}
