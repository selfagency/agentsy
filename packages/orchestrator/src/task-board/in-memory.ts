/**
 * In-memory implementation of ITaskBoard.
 *
 * Provides durable task lifecycle management, DAG validation, idempotent
 * tool execution tracking, checkpoint snapshots, and workflow archiving.
 * All state is held in Maps — suitable for single-process use.
 *
 * @module @agentsy/orchestrator/task-board
 */

import { randomUUID } from 'node:crypto';

import type { CheckpointSnapshot, ITaskBoard, Task, TaskAttempt, TaskStatus, ToolCallRecord } from './types.js';

// ---------------------------------------------------------------------------
// Custom errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a task lookup by id returns no result.
 */
export class TaskNotFoundError extends Error {
  readonly taskId: string;

  constructor(taskId: string) {
    super(`Task "${taskId}" not found`);
    this.name = 'TaskNotFoundError';
    this.taskId = taskId;
  }
}

/**
 * Thrown when a dependency id referenced by a task does not exist.
 */
export class DependencyNotFoundError extends Error {
  readonly dependencyId: string;

  constructor(dependencyId: string) {
    super(`Dependency "${dependencyId}" not found`);
    this.name = 'DependencyNotFoundError';
    this.dependencyId = dependencyId;
  }
}

/**
 * Thrown when cycle detection finds a cycle in the dependency graph.
 */
export class CircularDependencyError extends Error {
  readonly taskId: string;
  readonly cycle: readonly string[];

  constructor(taskId: string, cycle: string[]) {
    super(`Circular dependency detected for task "${taskId}": ${cycle.join(' → ')}`);
    this.name = 'CircularDependencyError';
    this.taskId = taskId;
    this.cycle = cycle;
  }
}

/**
 * Thrown when a task status transition is not allowed by the lifecycle.
 */
export class InvalidStatusTransitionError extends Error {
  readonly taskId: string;
  readonly from: TaskStatus;
  readonly to: TaskStatus;

  constructor(taskId: string, from: TaskStatus, to: TaskStatus) {
    super(`Invalid status transition for task "${taskId}": ${from} → ${to}`);
    this.name = 'InvalidStatusTransitionError';
    this.taskId = taskId;
    this.from = from;
    this.to = to;
  }
}

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS = new Map<TaskStatus, readonly TaskStatus[]>([
  ['pending', ['ready', 'failed']],
  ['ready', ['running', 'failed']],
  ['running', ['completed', 'failed', 'paused']],
  ['paused', ['running', 'failed']],
  ['completed', []],
  ['failed', []]
]);

// ---------------------------------------------------------------------------
// InMemoryTaskBoard
// ---------------------------------------------------------------------------

/**
 * In-memory task board implementing the ITaskBoard interface.
 *
 * Stores tasks, attempts, tool results, checkpoints, and archives in Maps.
 * Methods are async by default (to match ITaskBoard) but execute synchronously
 * since all state is in-process.
 */
export class InMemoryTaskBoard implements ITaskBoard {
  readonly #tasks = new Map<string, Task>();
  readonly #attempts = new Map<string, TaskAttempt[]>();
  readonly #toolResults = new Map<string, unknown>();
  readonly #checkpoints = new Map<string, CheckpointSnapshot>();
  readonly #archives = new Map<string, Task[]>();

  // -----------------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------------

  createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    // Validate all dependency references exist
    for (const depId of task.dependencies) {
      if (!this.#tasks.has(depId)) {
        throw new DependencyNotFoundError(depId);
      }
    }

    // Generate unique id (collision-avoidant)
    let id: string;
    do {
      id = `task_${randomUUID()}`;
    } while (this.#tasks.has(id));

    // Validate no cycles would be introduced
    const graph = this.#buildDependencyGraph(id, task.planId, task.dependencies);
    this.#validateNoCycles(graph);

    const now = new Date();
    const newTask: Task = {
      ...task,
      id,
      createdAt: now,
      updatedAt: now
    };

    this.#tasks.set(id, newTask);
    return Promise.resolve(newTask);
  }

  getTask(id: string): Promise<Task | undefined> {
    return Promise.resolve(this.#tasks.get(id));
  }

  updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task> {
    const existing = this.#tasks.get(id);
    if (!existing) {
      throw new TaskNotFoundError(id);
    }

    // Validate status transition if status is changing
    if (updates.status !== undefined && updates.status !== existing.status) {
      this.#validateTransition(existing.status, updates.status, id);
    }

    // Validate no cycles when dependencies are changing
    if (updates.dependencies !== undefined) {
      const deps = updates.dependencies;
      for (const depId of deps) {
        if (!this.#tasks.has(depId)) {
          throw new DependencyNotFoundError(depId);
        }
      }
      const graph = this.#buildDependencyGraph(id, existing.planId, deps);
      this.#validateNoCycles(graph);
    }

    const updated: Task = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date()
    };

    this.#tasks.set(id, updated);
    return Promise.resolve(updated);
  }

  // -----------------------------------------------------------------------
  // Dependency resolution
  // -----------------------------------------------------------------------

  getReadyTasks(planId: string): Task[] {
    const candidates = Array.from(this.#tasks.values()).filter(
      t => t.planId === planId && t.status !== 'completed' && t.status !== 'failed'
    );

    return candidates.filter(task => {
      for (const depId of task.dependencies) {
        const dep = this.#tasks.get(depId);
        if (dep?.status !== 'completed') {
          return false;
        }
      }
      return true;
    });
  }

  getDependencies(taskId: string, transitive?: boolean): string[] {
    const task = this.#tasks.get(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    if (!transitive) {
      return [...task.dependencies];
    }

    // Transitive closure via DFS
    const visited = new Set<string>();

    // fallow-ignore-next-line complexity
    const traverse = (currentId: string): void => {
      const current = this.#tasks.get(currentId);
      if (!current) {
        return;
      }
      for (const depId of current.dependencies) {
        if (visited.has(depId)) {
          continue;
        }
        visited.add(depId);
        traverse(depId);
      }
    };

    traverse(taskId);
    return Array.from(visited);
  }

  // -----------------------------------------------------------------------
  // Attempt lifecycle
  // -----------------------------------------------------------------------

  createAttempt(taskId: string): Promise<TaskAttempt> {
    const task = this.#tasks.get(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    const existingAttempts = this.#attempts.get(taskId) ?? [];
    const attemptNumber = existingAttempts.length + 1;

    const attempt: TaskAttempt = {
      id: randomUUID(),
      taskId,
      attemptNumber,
      startedAt: new Date(),
      status: 'running',
      toolCalls: []
    };

    existingAttempts.push(attempt);
    this.#attempts.set(taskId, existingAttempts);

    return Promise.resolve(attempt);
  }

  // -----------------------------------------------------------------------
  // Idempotency — tool execution results keyed by toolCallId
  // -----------------------------------------------------------------------

  recordToolExecution(_attemptId: string, toolCallId: string, record: ToolCallRecord): Promise<void> {
    this.#toolResults.set(toolCallId, record.output);
    return Promise.resolve();
  }

  getToolExecutionResult(toolCallId: string): Promise<unknown | undefined> {
    return Promise.resolve(this.#toolResults.get(toolCallId));
  }

  // -----------------------------------------------------------------------
  // Checkpoint / recovery
  // -----------------------------------------------------------------------

  saveCheckpoint(taskId: string, _attemptId: string, data: CheckpointSnapshot): Promise<void> {
    this.#checkpoints.set(taskId, data);
    return Promise.resolve();
  }

  getCheckpoint(taskId: string): Promise<CheckpointSnapshot | undefined> {
    return Promise.resolve(this.#checkpoints.get(taskId));
  }

  // -----------------------------------------------------------------------
  // Archive — move all plan tasks to cold storage
  // -----------------------------------------------------------------------

  archiveWorkflow(planId: string): void {
    const planTasks: Task[] = [];
    for (const [id, task] of this.#tasks) {
      if (task.planId === planId) {
        planTasks.push(task);
        this.#tasks.delete(id);
      }
    }
    this.#archives.set(planId, planTasks);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Build the full dependency graph for a plan, including a proposed new
   * task node and its outgoing edges. Used by cycle detection.
   */
  #buildDependencyGraph(newTaskId: string, planId: string, newDeps: string[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const [, task] of this.#tasks) {
      if (task.planId === planId) {
        graph.set(task.id, [...task.dependencies]);
      }
    }

    graph.set(newTaskId, [...newDeps]);
    return graph;
  }

  /**
   * DFS-based cycle detection using white/grey/black coloring.
   * Throws CircularDependencyError when a back edge (grey → grey) is found.
   */
  #validateNoCycles(graph: Map<string, string[]>): void {
    const WHITE = 0;
    const GREY = 1;
    const BLACK = 2;

    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();

    for (const node of graph.keys()) {
      color.set(node, WHITE);
      parent.set(node, null);
    }

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: DFS-based cycle detection
    const dfs = (node: string): void => {
      color.set(node, GREY);

      const deps = graph.get(node) ?? [];
      for (const dep of deps) {
        // Skip references to tasks outside this plan — they exist but can't
        // create cycles since the new task only has outgoing edges to them.
        if (!graph.has(dep)) {
          continue;
        }

        const depColor = color.get(dep);
        if (depColor === GREY) {
          // Back edge found — reconstruct cycle path
          const cycle: string[] = [dep];
          let current = node;
          while (current !== dep) {
            cycle.push(current);
            const p = parent.get(current);
            if (p === null || p === undefined) {
              break;
            }
            current = p;
          }
          cycle.push(dep);
          cycle.reverse();
          throw new CircularDependencyError(node, cycle);
        }

        if (depColor === WHITE) {
          parent.set(dep, node);
          dfs(dep);
        }
      }

      color.set(node, BLACK);
    };

    for (const node of graph.keys()) {
      if (color.get(node) === WHITE) {
        dfs(node);
      }
    }
  }

  /**
   * Validate that a status transition is allowed by the lifecycle rules.
   * Throws InvalidStatusTransitionError on disallowed transitions.
   */
  #validateTransition(from: TaskStatus, to: TaskStatus, taskId: string): void {
    const allowed = VALID_TRANSITIONS.get(from) ?? [];
    if (!allowed.includes(to)) {
      throw new InvalidStatusTransitionError(taskId, from, to);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory function (matching package convention)
// ---------------------------------------------------------------------------

/**
 * Create a new InMemoryTaskBoard instance.
 */
export function createInMemoryTaskBoard(): InMemoryTaskBoard {
  return new InMemoryTaskBoard();
}
