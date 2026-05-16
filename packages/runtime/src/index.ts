import type { SessionStore } from '@agentsy/session';
import { randomUUID } from 'node:crypto';

export {
  buildRuntimeContext,
  type BuildRuntimeContextInput,
  type RuntimeContextReuse,
  type RuntimeReusableSegment
} from './cache-aware-context.js';
export {
  buildRuntimeMemoryContextXml,
  injectRuntimeMemoryContext,
  type RuntimeCitation,
  type RuntimeMemoryEvidence,
  type RuntimeMemoryInjectionOptions
} from './memory-injection.js';

export interface RuntimeTask {
  id: string;
  run(signal: AbortSignal, context: RuntimeTaskContext): Promise<void>;
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
  depth: number;
  completedTaskIds: string[];
  results: RuntimeTaskResult[];
  childSnapshots: RuntimeSnapshot[];
  updatedAt: number;
}

export interface RuntimeTaskContext {
  sessionId: string;
  depth: number;
  spawn(tasks: RuntimeTask[], signal?: AbortSignal, sessionId?: string): Promise<RuntimeSnapshot>;
}

export interface RuntimeOptions {
  onError?: (error: Error, task: RuntimeTask) => void;
  onTaskStart?: (task: RuntimeTask) => void;
  onTaskComplete?: (result: RuntimeTaskResult, task: RuntimeTask) => void;
  taskContext?: RuntimeTaskContext;
}

export interface RuntimeExecutor {
  execute(this: void, tasks: RuntimeTask[], signal?: AbortSignal): Promise<void>;
  executeWithResults(this: void, tasks: RuntimeTask[], signal?: AbortSignal): Promise<RuntimeTaskResult[]>;
}

export interface RuntimeLoopOptions extends RuntimeOptions {
  sessionId?: string;
  snapshot?: RuntimeSnapshot;
  sessionStore?: SessionStore;
  snapshotKey?: string;
  depth?: number;
  maxDepth?: number;
}

export interface RuntimeLoop {
  execute(tasks: RuntimeTask[], signal?: AbortSignal): Promise<RuntimeSnapshot>;
  spawn(tasks: RuntimeTask[], signal?: AbortSignal, sessionId?: string): Promise<RuntimeSnapshot>;
  getSnapshot(): RuntimeSnapshot;
  getDepth(): number;
}

export interface RuntimeWorkflowExecutor {
  execute(tasks: RuntimeWorkflowTask[], signal?: AbortSignal): Promise<RuntimeSnapshot>;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Runtime task failed');
}

function createEmptySnapshot(sessionId: string, depth: number): RuntimeSnapshot {
  return {
    sessionId,
    depth,
    completedTaskIds: [],
    results: [],
    childSnapshots: [],
    updatedAt: Date.now()
  };
}

function createRuntimeId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
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
    typeof candidate.depth === 'number' &&
    Array.isArray(candidate.completedTaskIds) &&
    candidate.completedTaskIds.every(taskId => typeof taskId === 'string') &&
    Array.isArray(candidate.results) &&
    candidate.results.every(isRuntimeTaskResult) &&
    Array.isArray(candidate.childSnapshots) &&
    candidate.childSnapshots.every(isRuntimeSnapshot) &&
    typeof candidate.updatedAt === 'number'
  );
}

function cloneSnapshot(snapshot: RuntimeSnapshot): RuntimeSnapshot {
  return {
    sessionId: snapshot.sessionId,
    depth: snapshot.depth,
    completedTaskIds: [...snapshot.completedTaskIds],
    results: snapshot.results.map(result => ({ ...result })),
    childSnapshots: snapshot.childSnapshots.map(cloneSnapshot),
    updatedAt: snapshot.updatedAt
  };
}

export function loadRuntimeSnapshotFromSession(
  sessionStore: Pick<SessionStore, 'getValue'>,
  snapshotKey: string = 'runtimeSnapshot'
): RuntimeSnapshot | null {
  const snapshot = sessionStore.getValue(snapshotKey);
  return isRuntimeSnapshot(snapshot) ? cloneSnapshot(snapshot) : null;
}

export function saveRuntimeSnapshotToSession(
  sessionStore: Pick<SessionStore, 'setValue'>,
  snapshot: RuntimeSnapshot,
  snapshotKey: string = 'runtimeSnapshot'
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

export const createRuntimeExecutor = (options: RuntimeOptions = {}): RuntimeExecutor => {
  const executeWithResults = async (
    tasks: RuntimeTask[],
    signal: AbortSignal = new AbortController().signal
  ): Promise<RuntimeTaskResult[]> => {
    const results: RuntimeTaskResult[] = [];

    for (const task of tasks) {
      if (signal.aborted) {
        break;
      }

      const startedAt = Date.now();
      options.onTaskStart?.(task);

      try {
        await task.run(signal, options.taskContext ?? createDetachedRuntimeTaskContext());
        const result: RuntimeTaskResult = {
          taskId: task.id,
          status: 'completed',
          startedAt,
          finishedAt: Date.now()
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
          error: runtimeError
        };
        results.push(result);
        options.onTaskComplete?.(result, task);
      }
    }

    return results;
  };

  const execute = async (tasks: RuntimeTask[], signal: AbortSignal = new AbortController().signal): Promise<void> => {
    await executeWithResults(tasks, signal);
  };

  return {
    execute,
    executeWithResults
  };
};

function createDetachedRuntimeTaskContext(): RuntimeTaskContext {
  return {
    sessionId: 'runtime-detached',
    depth: 0,
    async spawn() {
      throw new Error('Runtime spawning is unavailable without an attached runtime loop context');
    }
  };
}

function initializeLoopSnapshot(options: RuntimeLoopOptions, sessionId: string, depth: number): RuntimeSnapshot {
  const persisted = options.sessionStore
    ? loadRuntimeSnapshotFromSession(options.sessionStore, options.snapshotKey)
    : null;
  return options.snapshot !== undefined && options.snapshot !== null
    ? cloneSnapshot(options.snapshot)
    : (persisted ?? createEmptySnapshot(sessionId, depth));
}

export function createRuntimeLoop(options: RuntimeLoopOptions = {}): RuntimeLoop {
  const sessionId = options.sessionId ?? createRuntimeId('runtime');
  const depth = options.depth ?? 0;
  const maxDepth = options.maxDepth ?? 3;
  let snapshot = initializeLoopSnapshot(options, sessionId, depth);

  const spawn = async (tasks: RuntimeTask[], signal = new AbortController().signal, childSessionId?: string) => {
    if (depth + 1 > maxDepth) {
      throw new Error(`Runtime spawn depth exceeded maxDepth (${maxDepth})`);
    }

    const nextChildSessionId = childSessionId ?? `${sessionId}:child:${snapshot.childSnapshots.length + 1}`;
    const childLoop = createRuntimeLoop({
      ...options,
      sessionId: nextChildSessionId,
      depth: depth + 1,
      maxDepth
    });
    const childSnapshot = await childLoop.execute(tasks, signal);
    snapshot = {
      ...snapshot,
      childSnapshots: [...snapshot.childSnapshots, childSnapshot],
      updatedAt: Date.now()
    };

    if (options.sessionStore) {
      saveRuntimeSnapshotToSession(options.sessionStore, snapshot, options.snapshotKey);
    }

    return cloneSnapshot(childSnapshot);
  };

  const executor = createRuntimeExecutor({
    ...options,
    taskContext: {
      sessionId,
      depth,
      spawn
    }
  });

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
        depth,
        completedTaskIds: nextCompletedTaskIds,
        results: [...snapshot.results, ...results],
        childSnapshots: snapshot.childSnapshots,
        updatedAt: Date.now()
      };

      if (options.sessionStore) {
        saveRuntimeSnapshotToSession(options.sessionStore, snapshot, options.snapshotKey);
      }

      return cloneSnapshot(snapshot);
    },

    spawn,

    getSnapshot() {
      return cloneSnapshot(snapshot);
    },

    getDepth() {
      return depth;
    }
  };
}

export function createRuntimeWorkflowExecutor(options: RuntimeLoopOptions = {}): RuntimeWorkflowExecutor {
  const loop = createRuntimeLoop(options);

  return {
    async execute(tasks, signal) {
      const orderedTasks = getExecutionOrder(tasks);
      return loop.execute(orderedTasks, signal);
    }
  };
}

// Phase 4 — Virtual sandbox
export * from './sandbox/policy/secrets-guard.js';
export * from './sandbox/virtual/container-detector.js';
export * from './sandbox/virtual/dynamic-trigger.js';
export * from './sandbox/virtual/router.js';
export * from './sandbox/virtual/virtual-sandbox.js';
