import type { SessionStore } from '@agentsy/session';

export interface RuntimeTask {
  id: string;
  run(signal: AbortSignal): Promise<void>;
}

export interface RuntimeWorkflowTask extends RuntimeTask {
  dependsOn?: string[];
}

export interface RuntimeTaskResult {
  taskId: string;
  status: 'completed' | 'failed' | 'skipped';
  startedAt: number;
  finishedAt: number;
  error?: Error;
}

export interface RuntimeSnapshot {
  sessionId: string;
  completedTaskIds: string[];
  results: RuntimeTaskResult[];
  updatedAt: number;
}

export interface RuntimeOptions {
  onError?: (error: Error, task: RuntimeTask) => void;
  onTaskStart?: (task: RuntimeTask) => void;
  onTaskComplete?: (result: RuntimeTaskResult, task: RuntimeTask) => void;
}

export interface RuntimeExecutor {
  execute(tasks: RuntimeTask[], signal?: AbortSignal): Promise<void>;
  executeWithResults(tasks: RuntimeTask[], signal?: AbortSignal): Promise<RuntimeTaskResult[]>;
}

export interface RuntimeLoopOptions extends RuntimeOptions {
  sessionId?: string;
  snapshot?: RuntimeSnapshot;
  sessionStore?: SessionStore;
  snapshotKey?: string;
}

export interface RuntimeLoop {
  execute(tasks: RuntimeTask[], signal?: AbortSignal): Promise<RuntimeSnapshot>;
  getSnapshot(): RuntimeSnapshot;
}

export interface RuntimeWorkflowExecutor {
  execute(tasks: RuntimeWorkflowTask[], signal?: AbortSignal): Promise<RuntimeSnapshot>;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Runtime task failed');
}

function createEmptySnapshot(sessionId: string): RuntimeSnapshot {
  return {
    sessionId,
    completedTaskIds: [],
    results: [],
    updatedAt: Date.now(),
  };
}

function isRuntimeTaskResult(value: unknown): value is RuntimeTaskResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.taskId === 'string' &&
    (candidate.status === 'completed' || candidate.status === 'failed' || candidate.status === 'skipped') &&
    typeof candidate.startedAt === 'number' &&
    typeof candidate.finishedAt === 'number'
  );
}

function isRuntimeSnapshot(value: unknown): value is RuntimeSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sessionId === 'string' &&
    Array.isArray(candidate.completedTaskIds) &&
    candidate.completedTaskIds.every(taskId => typeof taskId === 'string') &&
    Array.isArray(candidate.results) &&
    candidate.results.every(isRuntimeTaskResult) &&
    typeof candidate.updatedAt === 'number'
  );
}

function cloneSnapshot(snapshot: RuntimeSnapshot): RuntimeSnapshot {
  return {
    sessionId: snapshot.sessionId,
    completedTaskIds: [...snapshot.completedTaskIds],
    results: snapshot.results.map(result => ({ ...result })),
    updatedAt: snapshot.updatedAt,
  };
}

export function loadRuntimeSnapshotFromSession(
  sessionStore: Pick<SessionStore, 'getValue'>,
  snapshotKey: string = 'runtimeSnapshot',
): RuntimeSnapshot | null {
  const snapshot = sessionStore.getValue(snapshotKey);
  return isRuntimeSnapshot(snapshot) ? cloneSnapshot(snapshot) : null;
}

export function saveRuntimeSnapshotToSession(
  sessionStore: Pick<SessionStore, 'setValue'>,
  snapshot: RuntimeSnapshot,
  snapshotKey: string = 'runtimeSnapshot',
): void {
  sessionStore.setValue(snapshotKey, cloneSnapshot(snapshot));
}

function getExecutionOrder(tasks: RuntimeWorkflowTask[]): RuntimeWorkflowTask[] {
  const taskMap = new Map(tasks.map(task => [task.id, task]));
  const ordered: RuntimeWorkflowTask[] = [];
  const temporary = new Set<string>();
  const permanent = new Set<string>();

  const visit = (task: RuntimeWorkflowTask): void => {
    if (permanent.has(task.id)) {
      return;
    }

    if (temporary.has(task.id)) {
      throw new Error(`Runtime workflow contains a cycle at task "${task.id}"`);
    }

    temporary.add(task.id);

    for (const dependencyId of task.dependsOn ?? []) {
      const dependency = taskMap.get(dependencyId);
      if (!dependency) {
        throw new Error(`Runtime workflow task "${task.id}" depends on missing task "${dependencyId}"`);
      }
      visit(dependency);
    }

    temporary.delete(task.id);
    permanent.add(task.id);
    ordered.push(task);
  };

  for (const task of tasks) {
    visit(task);
  }

  return ordered;
}

export const createRuntimeExecutor = (options: RuntimeOptions = {}): RuntimeExecutor => ({
  async execute(tasks, signal = new AbortController().signal) {
    await this.executeWithResults(tasks, signal);
  },

  async executeWithResults(tasks, signal = new AbortController().signal) {
    const results: RuntimeTaskResult[] = [];

    for (const task of tasks) {
      if (signal.aborted) {
        break;
      }

      const startedAt = Date.now();
      options.onTaskStart?.(task);

      try {
        await task.run(signal);
        const result: RuntimeTaskResult = {
          taskId: task.id,
          status: 'completed',
          startedAt,
          finishedAt: Date.now(),
        };
        results.push(result);
        options.onTaskComplete?.(result, task);
      } catch (error) {
        const runtimeError = toError(error);
        options.onError?.(runtimeError, task);
        const result: RuntimeTaskResult = {
          taskId: task.id,
          status: 'failed',
          startedAt,
          finishedAt: Date.now(),
          error: runtimeError,
        };
        results.push(result);
        options.onTaskComplete?.(result, task);
      }
    }

    return results;
  },
});

export function createRuntimeLoop(options: RuntimeLoopOptions = {}): RuntimeLoop {
  const sessionId = options.sessionId ?? `runtime_${Math.random().toString(36).slice(2, 10)}`;
  const persistedSnapshot = options.sessionStore
    ? loadRuntimeSnapshotFromSession(options.sessionStore, options.snapshotKey)
    : null;
  let snapshot = options.snapshot
    ? cloneSnapshot(options.snapshot)
    : (persistedSnapshot ?? createEmptySnapshot(sessionId));

  const executor = createRuntimeExecutor(options);

  return {
    async execute(tasks, signal = new AbortController().signal) {
      const completedTaskIds = new Set(snapshot.completedTaskIds);
      const pendingTasks = tasks.filter(task => !completedTaskIds.has(task.id));
      const results = await executor.executeWithResults(pendingTasks, signal);

      const nextCompletedTaskIds = [...snapshot.completedTaskIds];
      for (const result of results) {
        if (result.status === 'completed' && !completedTaskIds.has(result.taskId)) {
          nextCompletedTaskIds.push(result.taskId);
          completedTaskIds.add(result.taskId);
        }
      }

      snapshot = {
        sessionId,
        completedTaskIds: nextCompletedTaskIds,
        results: [...snapshot.results, ...results],
        updatedAt: Date.now(),
      };

      if (options.sessionStore) {
        saveRuntimeSnapshotToSession(options.sessionStore, snapshot, options.snapshotKey);
      }

      return cloneSnapshot(snapshot);
    },

    getSnapshot() {
      return cloneSnapshot(snapshot);
    },
  };
}

export function createRuntimeWorkflowExecutor(options: RuntimeLoopOptions = {}): RuntimeWorkflowExecutor {
  const loop = createRuntimeLoop(options);

  return {
    async execute(tasks, signal) {
      const orderedTasks = getExecutionOrder(tasks);
      return loop.execute(orderedTasks, signal);
    },
  };
}
