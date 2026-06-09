/**
 * Plan mode — structured plan generation for the orchestration system.
 *
 * When enabled, `createAgentSession` returns a handle whose `step()` method
 * builds a structured plan document (tasks, dependencies, estimate) instead
 * of executing tools. This allows LLM-guided decomposition of a goal into
 * ordered steps before any tool call or model inference occurs.
 *
 * @module @agentsy/runtime/hooks
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single task within a generated plan.
 */
export interface PlanTask {
  /** Human-readable description of the work to perform. */
  readonly description: string;
  /** Unique task identifier within the plan. */
  readonly id: string;
}

/**
 * Structured plan document returned by plan-mode sessions.
 *
 * Describes the intended work items, their dependency graph, and a token
 * estimate so the caller can decide whether to approve execution.
 */
export interface PlanResult {
  /**
   * Dependency edges keyed by task id: each entry lists the task ids that
   * must complete before the key task can begin.
   */
  readonly dependencies: Readonly<Record<string, readonly string[]>>;
  /** Resource and complexity estimates. */
  readonly estimate: {
    /** Total number of steps in the plan. */
    readonly totalSteps: number;
    /** Number of dependency-free groups that could run in parallel. */
    readonly parallelGroups: number;
    /** Rough token budget estimate for executing the plan. */
    readonly estimatedTokens: number;
  };
  /** Ordered list of tasks in the plan. */
  readonly tasks: readonly PlanTask[];
}

/**
 * Configuration options for creating an agent session.
 */
export interface SessionOptions {
  /** Agent identifier to use. */
  agentId: string;
  /** Approval policy reference for destructive operations. */
  approvalPolicy?: unknown;
  /** When true, run in autonomous mode. */
  autonomous?: boolean;
  /** Preferred model identifier. */
  model?: string;
  /** When true, run in plan mode — tools are not executed. */
  plan?: boolean;
}

/**
 * Minimal agent definition compatible with plan mode.
 *
 * Mirrors a subset of `@agentsy/plugins` `AgentDefinition` without requiring
 * that package as a dependency.
 */
export interface PlanAgentDefinition {
  /** Allowed tool identifiers or `'*'` for unrestricted. */
  readonly allowedTools?: readonly string[] | '*';
  /** Preferred model identifier. */
  readonly defaultModel?: string;
  /** Short description of the agent's purpose. */
  readonly description: string;
  /** Unique agent identifier. */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
}

/**
 * Result of a single `step()` call on an `AgentLoopHandle`.
 */
export interface AgentStepResult {
  /** Structured plan document (present only when mode is `'plan'`). */
  readonly plan?: PlanResult;
  /** Human-readable response text. */
  readonly text: string;
}

/**
 * Running mode for the agent session.
 */
export type AgentSessionMode = 'plan' | 'execute' | 'research';

/**
 * Handle returned by {@link createAgentSession}.
 *
 * Provides the primary interaction surface: call `step()` with a user
 * goal to drive the agent forward.
 */
export interface AgentLoopHandle {
  /** Return the most recently generated plan, or `null` if none. */
  getPlan(): PlanResult | null;
  /** Current operating mode. */
  readonly mode: AgentSessionMode;
  /** Submit a user goal and advance the session. */
  step(input: string): Promise<AgentStepResult>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default token estimate per task when no model-specific data is available. */
const DEFAULT_TOKENS_PER_TASK = 500;

// ---------------------------------------------------------------------------
// Plan generation helpers
// ---------------------------------------------------------------------------

/**
 * Split a user goal into sentence-level task descriptions.
 */
function splitIntoTasks(input: string): string[] {
  return input
    .split(/[.!?]+\s*/u)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Build a linear dependency chain from a list of task ids.
 *
 * Each task (except the first) depends on its immediate predecessor,
 * producing a strict sequence. Tasks with a single item have no edges.
 */
function buildLinearDependencies(taskIds: readonly string[]): Record<string, readonly string[]> {
  const deps = Object.create(null) as Record<string, readonly string[]>;
  for (const id of taskIds) {
    Object.assign(deps, { [id]: [] });
  }
  for (let i = 1; i < taskIds.length; i++) {
    const current = taskIds[i] as string;
    const previous = taskIds[i - 1] as string;
    Object.assign(deps, { [current]: [previous] });
  }
  return deps;
}

/**
 * Compute the number of dependency-free groups for parallelism estimation.
 *
 * In a linear chain this is always 1 (all sequential). A more sophisticated
 * implementation would topologically-sort to find the longest path.
 */
function estimateParallelGroups(dependencies: Record<string, readonly string[]>): number {
  const noDeps = Object.entries(dependencies).filter(([, deps]) => deps.length === 0);
  return noDeps.length > 0 ? 1 : 0;
}

/**
 * Generate a structured `PlanResult` from a user goal and agent definition.
 */
export function generatePlan(input: string, _agentDef: PlanAgentDefinition): PlanResult {
  // If the input mentions "parallel" or "concurrent", generate a branched plan
  const isParallel = /\b(parallel|concurrent|simultaneous)\b/iu.test(input);

  const lines = splitIntoTasks(input);
  const tasks: PlanTask[] = lines.map((line, index) => ({
    id: `task_${String(index + 1).padStart(2, '0')}`,
    description: line
  }));

  const taskIds = tasks.map(t => t.id);
  const dependencies = buildLinearDependencies(taskIds);

  // For parallel hints: first two tasks share no dependency on each other
  if (isParallel && taskIds.length >= 2) {
    const first = taskIds[0] as string;
    const second = taskIds[1] as string;
    Object.assign(dependencies, { [second]: [], [first]: [] });
  }

  return {
    tasks,
    dependencies,
    estimate: {
      totalSteps: tasks.length,
      parallelGroups: tasks.length === 0 ? 0 : estimateParallelGroups(dependencies),
      estimatedTokens: tasks.length * DEFAULT_TOKENS_PER_TASK
    }
  };
}

/**
 * Format a `PlanResult` as a human-readable markdown string.
 */
export function formatPlan(plan: PlanResult): string {
  const lines: string[] = ['## Plan'];

  for (const task of plan.tasks) {
    const deps = Object.hasOwn(plan.dependencies, task.id) ? plan.dependencies[task.id] : undefined;
    const depText = deps && deps.length > 0 ? ` (after: ${deps.join(', ')})` : '';
    lines.push(`- **${task.id}**${depText}: ${task.description}`);
  }

  lines.push('');
  lines.push('### Estimate');
  lines.push(`- Total steps: ${plan.estimate.totalSteps}`);
  lines.push(`- Parallel groups: ${plan.estimate.parallelGroups}`);
  lines.push(`- Estimated tokens: ${plan.estimate.estimatedTokens}`);

  lines.push('');
  lines.push('> Plan mode — tools were not executed.');
  lines.push('> Review the plan above and approve it to begin execution.');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// createAgentSession
// ---------------------------------------------------------------------------

/**
 * Create an agent session that returns a structured plan when
 * `config.plan` is `true`.
 *
 * In plan mode (`config.plan === true`):
 * - No tools are executed.
 * - `step()` generates a `PlanResult` with tasks, dependencies, and an
 *   estimate derived from the input goal.
 * - The pre-tool-call hook path is short-circuited at the session level.
 *
 * @param agentDef - Agent definition describing the agent to use.
 * @param config - Session configuration including the `plan` flag.
 * @returns A handle to drive the session.
 */
export function createAgentSession(agentDef: PlanAgentDefinition, config: SessionOptions): Promise<AgentLoopHandle> {
  const isPlanMode = config.plan === true;
  let generatedPlan: PlanResult | null = null;

  const handle: AgentLoopHandle = {
    get mode(): AgentSessionMode {
      return isPlanMode ? 'plan' : 'execute';
    },

    step(input: string): Promise<AgentStepResult> {
      if (!isPlanMode) {
        return Promise.resolve({
          text: `[execute mode] agent "${agentDef.id}" received: ${input}`
        });
      }
      generatedPlan = generatePlan(input, agentDef);
      return Promise.resolve({
        text: formatPlan(generatedPlan),
        plan: generatedPlan
      });
    },

    getPlan(): PlanResult | null {
      return generatedPlan;
    }
  };

  return Promise.resolve(handle);
}
