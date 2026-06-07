/**
 * @module Types for the hook conflict resolution system.
 *
 * Defines hook lifecycle phases, conflict resolution strategies,
 * and the execution plan produced by compileHooks().
 */

// ---------------------------------------------------------------------------
// Hook phase
// ---------------------------------------------------------------------------

/**
 * Lifecycle phase at which a hook executes.
 *
 * - `beforePlan`:  before the orchestration plan is constructed
 * - `afterPlan`:   after the orchestration plan is constructed
 * - `beforeStep`:  before each agent-loop step runs
 * - `afterStep`:   after each agent-loop step completes
 * - `beforeToolCall`: before a tool call is executed
 * - `afterToolCall`:  after a tool call result is available
 * - `onError`:     when an error is raised during execution
 * - `onComplete`:  when the entire loop/plan completes
 */
export type HookPhase =
  | 'beforePlan'
  | 'afterPlan'
  | 'beforeStep'
  | 'afterStep'
  | 'beforeToolCall'
  | 'afterToolCall'
  | 'onError'
  | 'onComplete';

// ---------------------------------------------------------------------------
// Conflict strategy
// ---------------------------------------------------------------------------

/**
 * Strategy used to resolve a collision between two hooks that both modify
 * the same context field(s).
 *
 * - `skip`:   skip this hook when the conflicting hook has already run
 * - `merge`:  combine both hooks' contributions (e.g. append to systemPrompt)
 * - `fail`:   raise an error and abort execution
 * - `defer`:  defer this hook and let the conflicting hook run first
 */
export type ConflictStrategy = 'skip' | 'merge' | 'fail' | 'defer';

// ---------------------------------------------------------------------------
// Hook conflict specification
// ---------------------------------------------------------------------------

/**
 * Declares that this hook conflicts with another named hook over a set of
 * context fields, and prescribes how the conflict should be resolved.
 */
export interface HookConflict {
  /** Context fields that both hooks modify (e.g. `['systemPrompt']`). */
  contextFields: string[];

  /** Name of the other hook involved in the conflict. */
  hookName: string;

  /** Human-readable explanation of why the conflict exists. */
  reason: string;

  /** Resolution strategy when both hooks are active. */
  strategy: ConflictStrategy;
}

// ---------------------------------------------------------------------------
// Hook definition
// ---------------------------------------------------------------------------

/**
 * Priority values for built-in hook categories.
 *
 * Governance gates run first (RBAC, approval, audit),
 * followed by guardrails (content policy, safety filters),
 * then execution hooks (tool calls, step logic),
 * and finally recovery hooks (fallback, escalation).
 */
export const HookPriority = {
  governance: 80,
  guardrails: 70,
  execution: 50,
  recovery: 20
} as const;

export type HookPriority = (typeof HookPriority)[keyof typeof HookPriority];

/**
 * Descriptor for a single hook in the registry.
 *
 * Extends the basic hook pattern with optional dependency declarations
 * and conflict specifications so that `compileHooks` can produce a safe,
 * deterministic execution order.
 */
export interface HookDefinition {
  /** Declared conflicts with other hooks. */
  conflicts?: HookConflict[];

  /** Hook names that must execute _before_ this hook. */
  dependencies?: string[];

  /** Whether this hook is currently active. Defaults to `true`. */
  enabled?: boolean;

  /** Unique name for this hook (e.g. `'governance:pre-tool-call'`). */
  name: string;

  /** Lifecycle phase in which this hook fires. */
  phase: HookPhase;

  /**
   * Numeric priority — higher values run sooner within the same phase.
   *
   * @see HookPriority for built-in categories.
   */
  priority: number;
}

// ---------------------------------------------------------------------------
// Conflict warning (output of compileHooks)
// ---------------------------------------------------------------------------

/**
 * Warning emitted by `compileHooks` when two hooks conflict over a context
 * field.  Includes the resolution strategy and a human-readable reason.
 */
export interface ConflictWarning {
  /** Context field (or comma-separated fields) that both hooks touch. */
  field: string;

  /** Name of the first conflicting hook. */
  hook1: string;

  /** Name of the second conflicting hook. */
  hook2: string;

  /** Human-readable explanation of why the conflict exists and how it was resolved. */
  reason: string;

  /** Strategy used to resolve the conflict. */
  strategy: ConflictStrategy;
}

// ---------------------------------------------------------------------------
// Execution plan (output of compileHooks)
// ---------------------------------------------------------------------------

/**
 * Result of compiling a set of hook definitions.
 *
 * Contains the resolved execution order (hook names, topologically sorted)
 * and any conflict warnings that were detected during compilation.
 */
export interface HookExecutionPlan {
  /** Hook names in execution order (topologically sorted, priority-aware). */
  order: string[];

  /** Warnings about conflicting hooks detected during compilation. */
  warnings: ConflictWarning[];
}
