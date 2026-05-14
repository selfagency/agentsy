/**
 * Runtime execution infrastructure types.
 */

/**
 * A runtime task that can be executed.
 */
export interface RuntimeTask {
  /** Task identifier. */
  id: string;

  /** Run the task. */
  run(signal: AbortSignal, context: RuntimeTaskContext): Promise<void>;
}

/**
 * Runtime task with dependency information.
 */
export interface RuntimeWorkflowTask extends RuntimeTask {
  /** Task IDs this task depends on. */
  dependsOn?: string[];
}

/**
 * Result from executing a runtime task.
 */
export interface RuntimeTaskResult {
  /** Task identifier. */
  taskId: string;

  /** Execution status. */
  status: 'completed' | 'failed' | 'skipped';

  /** Start timestamp. */
  startedAt: number;

  /** Finish timestamp. */
  finishedAt: number;

  /** Error if execution failed. */
  error?: Error;
}

/**
 * Snapshot of runtime execution state.
 */
export interface RuntimeSnapshot {
  /** Session identifier. */
  sessionId: string;

  /** Execution depth (for nested tasks). */
  depth: number;

  /** IDs of completed tasks. */
  completedTaskIds: string[];

  /** Results from executed tasks. */
  results: RuntimeTaskResult[];

  /** Snapshots from child executions. */
  childSnapshots: RuntimeSnapshot[];

  /** Last update timestamp. */
  updatedAt: number;
}

/**
 * Context provided to running tasks.
 */
export interface RuntimeTaskContext {
  /** Session identifier. */
  sessionId: string;

  /** Execution depth. */
  depth: number;

  /** Spawn child tasks for parallel execution. */
  spawn(tasks: RuntimeTask[], signal?: AbortSignal, sessionId?: string): Promise<RuntimeSnapshot>;
}

/**
 * Options for runtime executor.
 */
export interface RuntimeOptions {
  /** Error handler. */
  onError?: (error: Error, task: RuntimeTask) => void;

  /** Handler called when task starts. */
  onTaskStart?: (task: RuntimeTask) => void;

  /** Handler called when task completes. */
  onTaskComplete?: (result: RuntimeTaskResult, task: RuntimeTask) => void;

  /** Task context to inject. */
  taskContext?: RuntimeTaskContext;
}

/**
 * Runtime executor that can run tasks.
 */
export interface RuntimeExecutor {
  /** Execute tasks without returning results. */
  execute(tasks: RuntimeTask[], signal?: AbortSignal): Promise<void>;

  /** Execute tasks and return results. */
  executeWithResults(tasks: RuntimeTask[], signal?: AbortSignal): Promise<RuntimeTaskResult[]>;
}

/**
 * Options for runtime loop with persistence.
 */
export interface RuntimeLoopOptions extends RuntimeOptions {
  /** Session identifier. */
  sessionId?: string;

  /** Initial snapshot (for resuming). */
  snapshot?: RuntimeSnapshot;

  /** Session store for persistence. */
  sessionStore?: unknown;

  /** Key to store snapshot under. */
  snapshotKey?: string;

  /** Initial execution depth. */
  depth?: number;

  /** Maximum execution depth (prevents infinite recursion). */
  maxDepth?: number;
}

/**
 * Runtime loop that tracks state and supports persistence.
 */
export interface RuntimeLoop {
  /** Execute tasks and return updated snapshot. */
  execute(tasks: RuntimeTask[], signal?: AbortSignal): Promise<RuntimeSnapshot>;

  /** Spawn child tasks in a new execution context. */
  spawn(tasks: RuntimeTask[], signal?: AbortSignal, sessionId?: string): Promise<RuntimeSnapshot>;

  /** Get current snapshot. */
  getSnapshot(): RuntimeSnapshot;

  /** Get current execution depth. */
  getDepth(): number;
}

/**
 * Workflow executor that respects dependencies.
 */
export interface RuntimeWorkflowExecutor {
  /** Execute workflow tasks respecting dependency order. */
  execute(tasks: RuntimeWorkflowTask[], signal?: AbortSignal): Promise<RuntimeSnapshot>;
}