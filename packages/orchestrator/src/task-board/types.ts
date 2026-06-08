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
  /** Snapshot stored at time of pause for recovery. */
  checkpointData?: CheckpointSnapshot;

  createdAt: Date;
  dependencies: string[];
  id: string;
  metadata: Record<string, unknown>;

  /** Link to parent task for sub-task decomposition trees. */
  parentTaskId?: string;
  planId: string;
  status: TaskStatus;
  stepId: string;
  type: string;
  updatedAt: Date;
}

/**
 * A single execution attempt of a task.
 * Tasks may be retried; each retry creates a new attempt.
 */
export interface TaskAttempt {
  attemptNumber: number;
  completedAt?: Date;
  error?: { message: string; stack?: string };
  id: string;

  output?: unknown;

  startedAt: Date;

  status: 'running' | 'completed' | 'failed';
  taskId: string;

  toolCalls: ToolCallRecord[];
}

/**
 * Record of a single tool invocation within an attempt.
 * Used for idempotency replay and audit.
 */
export interface ToolCallRecord {
  input: unknown;
  output: unknown;
  resultId?: string;
  tokens?: number;
  toolName: string;
}

// ---------------------------------------------------------------------------
// Checkpoint snapshot
// ---------------------------------------------------------------------------

/**
 * Serialisable snapshot of execution state at a point in time.
 * Stored for recovery after failure or pause.
 */
export interface CheckpointSnapshot {
  /** Serialised context at checkpoint time. */
  contextSnapshot: Record<string, unknown>;
  /** How many steps completed up to this point. */
  stepIndex: number;

  /** When the checkpoint was taken. */
  timestamp: Date;

  /** Cached tool results for idempotent replay (keyed by toolCallId). */
  toolResultCache: Record<string, unknown>;
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
  // ── Attempt lifecycle ─────────────────────────────────────────────────

  /** Create a new execution attempt for the given task. */
  createAttempt(taskId: string): Promise<TaskAttempt>;
  // ── CRUD ──────────────────────────────────────────────────────────────

  /** Create a new task and return it with generated id / timestamps. */
  createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;

  /**
   * Load the latest checkpoint for a task.
   * Returns undefined when no checkpoint exists.
   */
  getCheckpoint(taskId: string): Promise<CheckpointSnapshot | undefined>;

  // ── Dependency resolution ────────────────────────────────────────────

  /**
   * Return all tasks under `planId` whose dependencies are satisfied
   * (every dependency task has status === 'completed').
   *
   * Synchronous to avoid races in the hot execution loop; callers should
   * coordinate externally or rely on the in-memory guarantee.
   */
  getReadyTasks(planId: string): Task[];

  /** Retrieve a task by id, or undefined if not found. */
  getTask(id: string): Promise<Task | undefined>;

  /**
   * Retrieve a previously cached tool result by toolCallId.
   * Returns undefined when no cached result exists.
   */
  getToolExecutionResult(toolCallId: string): Promise<unknown>;

  // ── Idempotency ──────────────────────────────────────────────────────

  /**
   * Persist a tool execution record so the same toolCallId can be
   * skipped on retry (deduplication).
   */
  recordToolExecution(attemptId: string, toolCallId: string, record: ToolCallRecord): Promise<void>;

  // ── Checkpoint / recovery ────────────────────────────────────────────

  /**
   * Persist a checkpoint snapshot for a task + attempt pair so
   * execution can resume after a pause or failure.
   */
  saveCheckpoint(taskId: string, attemptId: string, data: CheckpointSnapshot): Promise<void>;

  /** Apply partial updates to an existing task and return the updated task. */
  updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task>;
}
