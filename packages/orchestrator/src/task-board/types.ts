/**
 * Task board types — durable task tracking, idempotency, checkpoint support.
 *
 * Defines the lifecycle: pending → ready → running → completed / failed
 * with pause support for approval gates and recovery.
 *
 * @module @agentsy/orchestrator/task-board
 */

// ---------------------------------------------------------------------------
// Task lifecycle
// ---------------------------------------------------------------------------

/**
 * Status lifecycle: pending → ready → running → completed / failed.
 * `paused` is a recoverable pause (e.g. approval gate).
 */
export type TaskStatus = 'pending' | 'ready' | 'running' | 'paused' | 'completed' | 'failed';

// ---------------------------------------------------------------------------
// Core data types
// ---------------------------------------------------------------------------

/**
 * A single task in the board.
 * Represents one atomic unit of work within a plan step.
 */
export interface Task {
  id: string;
  planId: string;
  stepId: string;
  type: string;
  status: TaskStatus;
  metadata: Record<string, unknown>;
  dependencies: string[];

  createdAt: Date;
  updatedAt: Date;

  /** Link to parent task for sub-task decomposition trees. */
  parentTaskId?: string;

  /** Snapshot stored at time of pause for recovery. */
  checkpointData?: CheckpointSnapshot;
}

/**
 * A single execution attempt of a task.
 * Tasks may be retried; each retry creates a new attempt.
 */
export interface TaskAttempt {
  id: string;
  taskId: string;
  attemptNumber: number;

  startedAt: Date;
  completedAt?: Date;

  status: 'running' | 'completed' | 'failed';

  output?: unknown;
  error?: { message: string; stack?: string };

  toolCalls: ToolCallRecord[];
}

/**
 * Record of a single tool invocation within an attempt.
 * Used for idempotency replay and audit.
 */
export interface ToolCallRecord {
  toolName: string;
  input: unknown;
  output: unknown;
  tokens?: number;
  resultId?: string;
}

// ---------------------------------------------------------------------------
// Checkpoint snapshot
// ---------------------------------------------------------------------------

/**
 * Serialisable snapshot of execution state at a point in time.
 * Stored for recovery after failure or pause.
 */
export interface CheckpointSnapshot {
  /** How many steps completed up to this point. */
  stepIndex: number;

  /** Serialised context at checkpoint time. */
  contextSnapshot: Record<string, unknown>;

  /** Cached tool results for idempotent replay (keyed by toolCallId). */
  toolResultCache: Record<string, unknown>;

  /** When the checkpoint was taken. */
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Task board interface
// ---------------------------------------------------------------------------

/**
 * Durable task board abstraction.
 *
 * Manages task lifecycle, dependency resolution, per-attempt tool-call
 * tracking (idempotency), and checkpoint snapshots for recovery.
 *
 * Methods are async by design — production implementations will back
 * this with a database (Redis, Postgres, etc.).
 */
export interface ITaskBoard {
  // ── CRUD ──────────────────────────────────────────────────────────────

  /** Create a new task and return it with generated id / timestamps. */
  createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;

  /** Retrieve a task by id, or undefined if not found. */
  getTask(id: string): Promise<Task | undefined>;

  /** Apply partial updates to an existing task and return the updated task. */
  updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task>;

  // ── Dependency resolution ────────────────────────────────────────────

  /**
   * Return all tasks under `planId` whose dependencies are satisfied
   * (every dependency task has status === 'completed').
   *
   * Synchronous to avoid races in the hot execution loop; callers should
   * coordinate externally or rely on the in-memory guarantee.
   */
  getReadyTasks(planId: string): Task[];

  // ── Attempt lifecycle ─────────────────────────────────────────────────

  /** Create a new execution attempt for the given task. */
  createAttempt(taskId: string): Promise<TaskAttempt>;

  // ── Idempotency ──────────────────────────────────────────────────────

  /**
   * Persist a tool execution record so the same toolCallId can be
   * skipped on retry (deduplication).
   */
  recordToolExecution(attemptId: string, toolCallId: string, record: ToolCallRecord): Promise<void>;

  /**
   * Retrieve a previously cached tool result by toolCallId.
   * Returns undefined when no cached result exists.
   */
  getToolExecutionResult(toolCallId: string): Promise<unknown | undefined>;

  // ── Checkpoint / recovery ────────────────────────────────────────────

  /**
   * Persist a checkpoint snapshot for a task + attempt pair so
   * execution can resume after a pause or failure.
   */
  saveCheckpoint(taskId: string, attemptId: string, data: CheckpointSnapshot): Promise<void>;

  /**
   * Load the latest checkpoint for a task.
   * Returns undefined when no checkpoint exists.
   */
  getCheckpoint(taskId: string): Promise<CheckpointSnapshot | undefined>;
}
