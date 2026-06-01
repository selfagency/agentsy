import { describe, expect, it } from 'vitest';
import type { CoordinationTask } from './task-queue.js';
import { createInMemoryTaskQueue } from './task-queue.js';

describe('TaskQueue', () => {
  describe('enqueue', () => {
    it('should accept a task', async () => {
      const queue = createInMemoryTaskQueue();
      const task = { id: '1', type: 'test' };

      await expect(queue.enqueue(task)).resolves.toBeUndefined();
    });

    it('should allow enqueueing multiple tasks', async () => {
      const queue = createInMemoryTaskQueue();
      const task1 = { id: '1', type: 'test' };
      const task2 = { id: '2', type: 'test' };
      const task3 = { id: '3', type: 'test' };

      await queue.enqueue(task1);
      await queue.enqueue(task2);
      await queue.enqueue(task3);

      expect(queue.size()).toBe(3);
    });

    it('should support tasks with payloads', async () => {
      const queue = createInMemoryTaskQueue();
      const task = {
        id: 'task-1',
        payload: {
          message: 'hello',
          priority: 'high',
          timestamp: Date.now()
        },
        type: 'process-message'
      };

      await queue.enqueue(task);
      expect(queue.size()).toBe(1);
    });

    it('should support tasks without payloads', async () => {
      const queue = createInMemoryTaskQueue();
      const task = { id: 'simple-task', type: 'background-job' };

      await queue.enqueue(task);
      expect(queue.size()).toBe(1);
    });
  });

  describe('dequeue', () => {
    it('should return null when queue is empty', async () => {
      const queue = createInMemoryTaskQueue();

      const task = await queue.dequeue();

      expect(task).toBeNull();
    });

    it('should return the first task in FIFO order', async () => {
      const queue = createInMemoryTaskQueue();
      const task1 = { id: '1', type: 'test' };
      const task2 = { id: '2', type: 'test' };

      await queue.enqueue(task1);
      await queue.enqueue(task2);

      const dequeued = await queue.dequeue();

      expect(dequeued).toStrictEqual(task1);
      expect(queue.size()).toBe(1);
    });

    it('should maintain FIFO order with multiple dequeues', async () => {
      const queue = createInMemoryTaskQueue();
      const task1 = { id: '1', type: 'test' };
      const task2 = { id: '2', type: 'test' };
      const task3 = { id: '3', type: 'test' };

      await queue.enqueue(task1);
      await queue.enqueue(task2);
      await queue.enqueue(task3);

      const first = await queue.dequeue();
      const second = await queue.dequeue();
      const third = await queue.dequeue();
      const fourth = await queue.dequeue();

      expect(first).toStrictEqual(task1);
      expect(second).toStrictEqual(task2);
      expect(third).toStrictEqual(task3);
      expect(fourth).toBeNull();
    });

    it('should decrement size after dequeue', async () => {
      const queue = createInMemoryTaskQueue();
      const task = { id: '1', type: 'test' };

      await queue.enqueue(task);
      expect(queue.size()).toBe(1);

      await queue.dequeue();
      expect(queue.size()).toBe(0);
    });

    it('should support dequeue on empty queue multiple times', async () => {
      const queue = createInMemoryTaskQueue();

      const first = await queue.dequeue();
      const second = await queue.dequeue();
      const third = await queue.dequeue();

      expect(first).toBeNull();
      expect(second).toBeNull();
      expect(third).toBeNull();
    });

    it('should preserve task payload through dequeue', async () => {
      const queue = createInMemoryTaskQueue();
      const task = {
        id: 'task-with-payload',
        payload: {
          action: 'update',
          metadata: { createdAt: Date.now(), retries: 0 },
          userId: 'user-123'
        },
        type: 'data-processing'
      };

      await queue.enqueue(task);
      const dequeued = await queue.dequeue();

      expect(dequeued).toStrictEqual(task);
      expect(dequeued?.payload).toStrictEqual(task.payload);
    });
  });

  describe('size', () => {
    it('should return 0 for empty queue', () => {
      const queue = createInMemoryTaskQueue();
      expect(queue.size()).toBe(0);
    });

    it('should return accurate size after enqueue', async () => {
      const queue = createInMemoryTaskQueue();

      expect(queue.size()).toBe(0);

      await queue.enqueue({ id: '1', type: 'test' });
      expect(queue.size()).toBe(1);

      await queue.enqueue({ id: '2', type: 'test' });
      expect(queue.size()).toBe(2);

      await queue.enqueue({ id: '3', type: 'test' });
      expect(queue.size()).toBe(3);
    });

    it('should return accurate size after dequeue', async () => {
      const queue = createInMemoryTaskQueue();

      await queue.enqueue({ id: '1', type: 'test' });
      await queue.enqueue({ id: '2', type: 'test' });
      await queue.enqueue({ id: '3', type: 'test' });

      expect(queue.size()).toBe(3);

      await queue.dequeue();
      expect(queue.size()).toBe(2);

      await queue.dequeue();
      expect(queue.size()).toBe(1);

      await queue.dequeue();
      expect(queue.size()).toBe(0);
    });

    it('should track size accurately during mixed operations', async () => {
      const queue = createInMemoryTaskQueue();

      await queue.enqueue({ id: '1', type: 'test' });
      await queue.enqueue({ id: '2', type: 'test' });
      expect(queue.size()).toBe(2);

      await queue.dequeue();
      expect(queue.size()).toBe(1);

      await queue.enqueue({ id: '3', type: 'test' });
      expect(queue.size()).toBe(2);

      await queue.dequeue();
      await queue.dequeue();
      expect(queue.size()).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should support producer-consumer pattern', async () => {
      const queue = createInMemoryTaskQueue();
      const tasks = [
        { id: '1', type: 'task' },
        { id: '2', type: 'task' },
        { id: '3', type: 'task' }
      ];

      // Producer: enqueue all tasks
      for (const task of tasks) {
        await queue.enqueue(task);
      }

      // Consumer: dequeue all tasks
      const consumed: CoordinationTask[] = [];
      while (true) {
        const task = await queue.dequeue();
        if (task === null) {
          break;
        }

        consumed.push(task);
      }

      expect(consumed).toStrictEqual(tasks);
      expect(queue.size()).toBe(0);
    });

    it('should handle many tasks', async () => {
      const queue = createInMemoryTaskQueue();
      const count = 1000;

      // Enqueue
      for (let i = 0; i < count; i++) {
        await queue.enqueue({ id: `task-${i}`, type: 'batch' });
      }

      expect(queue.size()).toBe(count);

      // Dequeue
      for (let i = 0; i < count; i++) {
        const task = await queue.dequeue();
        expect(task?.id).toBe(`task-${i}`);
      }

      expect(queue.size()).toBe(0);
    });

    it('should support interleaved enqueue and dequeue', async () => {
      const queue = createInMemoryTaskQueue();

      await queue.enqueue({ id: '1', type: 'test' });
      await queue.enqueue({ id: '2', type: 'test' });

      const task1 = await queue.dequeue();
      expect(task1?.id).toBe('1');

      await queue.enqueue({ id: '3', type: 'test' });
      await queue.enqueue({ id: '4', type: 'test' });

      const task2 = await queue.dequeue();
      expect(task2?.id).toBe('2');

      const task3 = await queue.dequeue();
      expect(task3?.id).toBe('3');

      const task4 = await queue.dequeue();
      expect(task4?.id).toBe('4');

      expect(queue.size()).toBe(0);
    });

    it('should preserve task order with varied payload sizes', async () => {
      const queue = createInMemoryTaskQueue();

      const smallTask = { id: '1', type: 'small' };
      const mediumTask = {
        id: '2',
        payload: { data: 'x'.repeat(100) },
        type: 'medium'
      };
      const largeTask = {
        id: '3',
        payload: {
          data: 'y'.repeat(10_000),
          nested: { deep: { structure: true } }
        },
        type: 'large'
      };

      await queue.enqueue(smallTask);
      await queue.enqueue(mediumTask);
      await queue.enqueue(largeTask);

      const d1 = await queue.dequeue();
      const d2 = await queue.dequeue();
      const d3 = await queue.dequeue();

      expect(d1).toStrictEqual(smallTask);
      expect(d2).toStrictEqual(mediumTask);
      expect(d3).toStrictEqual(largeTask);
    });
  });
});
