import { describe, expect, it } from 'vitest';

import type { CheckpointSnapshot, Task, ToolCallRecord } from './types.js';
import {
  CircularDependencyError,
  DependencyNotFoundError,
  InvalidStatusTransitionError,
  TaskNotFoundError,
  createInMemoryTaskBoard
} from './in-memory.js';

function baseTask(overrides: Partial<Task> = {}): Omit<Task, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    planId: overrides.planId ?? 'plan-1',
    stepId: overrides.stepId ?? 'step-1',
    type: overrides.type ?? 'task',
    status: overrides.status ?? 'pending',
    metadata: overrides.metadata ?? {},
    dependencies: overrides.dependencies ?? [],
    ...overrides
  };
}

describe('InMemoryTaskBoard', () => {
  describe('createTask', () => {
    it('should create a task with a unique id and timestamps', async () => {
      const board = createInMemoryTaskBoard();
      const task = await board.createTask(baseTask({ planId: 'plan-1' }));
      expect(task.id).toMatch(/^task_/u);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(task.planId).toBe('plan-1');
    });

    it('should validate that dependency references exist', async () => {
      const board = createInMemoryTaskBoard();
      await expect(board.createTask(baseTask({ dependencies: ['nonexistent'] }))).rejects.toThrow(
        DependencyNotFoundError
      );
    });

    it('should reject circular dependencies via updateTask', async () => {
      const board = createInMemoryTaskBoard();
      const taskA = await board.createTask(baseTask({ planId: 'plan-1' }));
      // taskA has no deps. Create taskB that depends on taskA. Now make taskA depend on taskB → cycle A→B→A
      const taskB = await board.createTask(baseTask({ planId: 'plan-1', dependencies: [taskA.id] }));
      // Update taskA to depend on taskB — this creates a cycle
      await expect(board.updateTask(taskA.id, { dependencies: [taskB.id] })).rejects.toThrow(CircularDependencyError);
    });
  });

  describe('getTask', () => {
    it('should return a task by id', async () => {
      const board = createInMemoryTaskBoard();
      const created = await board.createTask(baseTask());
      const found = await board.getTask(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it('should return undefined for an unknown id', async () => {
      const board = createInMemoryTaskBoard();
      const result = await board.getTask('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('updateTask', () => {
    it('should merge partial updates and update timestamps', async () => {
      const board = createInMemoryTaskBoard();
      const task = await board.createTask(baseTask({ planId: 'plan-1', status: 'ready' }));
      const updated = await board.updateTask(task.id, { status: 'running' });
      expect(updated.status).toBe('running');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(task.updatedAt.getTime());
    });

    it('should throw on invalid status transitions', async () => {
      const board = createInMemoryTaskBoard();
      const task = await board.createTask(baseTask({ planId: 'plan-1', status: 'pending' }));
      await expect(board.updateTask(task.id, { status: 'completed' })).rejects.toThrow(InvalidStatusTransitionError);
    });

    it('should throw TaskNotFoundError for unknown id', async () => {
      const board = createInMemoryTaskBoard();
      await expect(board.updateTask('nonexistent', { status: 'running' })).rejects.toThrow(TaskNotFoundError);
    });
  });

  describe('getReadyTasks', () => {
    it('should only return tasks whose dependencies are completed', async () => {
      const board = createInMemoryTaskBoard();

      // Create taskA (no deps — ready immediately)
      const taskA = await board.createTask(
        baseTask({
          planId: 'plan-1',
          stepId: 'step-a',
          status: 'pending',
          dependencies: []
        })
      );

      // Create taskB (depends on taskA — not ready yet)
      const taskB = await board.createTask(
        baseTask({
          planId: 'plan-1',
          stepId: 'step-b',
          status: 'pending',
          dependencies: [taskA.id]
        })
      );

      // getReadyTasks should find taskA (no deps) but not taskB
      const ready1 = board.getReadyTasks('plan-1');
      expect(ready1.map(t => t.id)).toContain(taskA.id);
      expect(ready1.map(t => t.id)).not.toContain(taskB.id);

      // Complete taskA through proper status transitions
      await board.updateTask(taskA.id, { status: 'ready' });
      await board.updateTask(taskA.id, { status: 'running' });
      await board.updateTask(taskA.id, { status: 'completed' });

      // Now taskB should be ready
      const ready2 = board.getReadyTasks('plan-1');
      expect(ready2.map(t => t.id)).toContain(taskB.id);
    });
  });

  describe('createAttempt', () => {
    it('should increment attemptNumber and store in attempts map', async () => {
      const board = createInMemoryTaskBoard();
      const task = await board.createTask(baseTask({ planId: 'plan-1', status: 'ready' }));

      const attempt1 = await board.createAttempt(task.id);
      expect(attempt1.attemptNumber).toBe(1);
      expect(attempt1.taskId).toBe(task.id);
      expect(attempt1.status).toBe('running');

      const attempt2 = await board.createAttempt(task.id);
      expect(attempt2.attemptNumber).toBe(2);
    });

    it('should throw for unknown task', async () => {
      const board = createInMemoryTaskBoard();
      await expect(board.createAttempt('nonexistent')).rejects.toThrow(TaskNotFoundError);
    });
  });

  describe('recordToolExecution + getToolExecutionResult', () => {
    it('should store and fetch results by toolCallId', async () => {
      const board = createInMemoryTaskBoard();
      const record: ToolCallRecord = {
        toolName: 'test_tool',
        input: { arg: 1 },
        output: { result: 'ok' }
      };

      await board.recordToolExecution('attempt-1', 'call-1', record);
      const result = await board.getToolExecutionResult('call-1');
      expect(result).toEqual({ result: 'ok' });

      // Unknown toolCallId returns undefined
      const missing = await board.getToolExecutionResult('call-unknown');
      expect(missing).toBeUndefined();
    });
  });

  describe('saveCheckpoint + getCheckpoint', () => {
    it('should roundtrip a checkpoint snapshot', async () => {
      const board = createInMemoryTaskBoard();
      const task = await board.createTask(baseTask({ planId: 'plan-1', status: 'ready' }));
      const attempt = await board.createAttempt(task.id);

      const snapshot: CheckpointSnapshot = {
        stepIndex: 1,
        contextSnapshot: { progress: 0.5 },
        toolResultCache: { 'call-1': 'done' },
        timestamp: new Date()
      };

      await board.saveCheckpoint(task.id, attempt.id, snapshot);
      const loaded = await board.getCheckpoint(task.id);
      expect(loaded).toBeDefined();
      expect(loaded!.stepIndex).toBe(1);
      expect(loaded!.contextSnapshot).toEqual({ progress: 0.5 });

      // Unknown task returns undefined
      const missing = await board.getCheckpoint('nonexistent');
      expect(missing).toBeUndefined();
    });
  });

  describe('archiveWorkflow', () => {
    it('should move plan tasks to archive and remove from active tasks', async () => {
      const board = createInMemoryTaskBoard();
      const taskA = await board.createTask(baseTask({ planId: 'plan-1', stepId: 'step-a' }));
      const taskB = await board.createTask(baseTask({ planId: 'plan-1', stepId: 'step-b' }));

      board.archiveWorkflow('plan-1');

      const a = await board.getTask(taskA.id);
      const b = await board.getTask(taskB.id);
      expect(a).toBeUndefined();
      expect(b).toBeUndefined();

      // Tasks from other plans remain
      const taskOther = await board.createTask(baseTask({ planId: 'plan-2' }));
      const found = await board.getTask(taskOther.id);
      expect(found).toBeDefined();
    });
  });
});
