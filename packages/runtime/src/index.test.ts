import { describe, expect, it, vi } from 'vitest';
import { createRuntimeExecutor, type RuntimeTask } from './index.js';

describe('createRuntimeExecutor', () => {
  it('executes tasks in order', async () => {
    const calls: string[] = [];
    const executor = createRuntimeExecutor();
    const tasks: RuntimeTask[] = [
      {
        id: 'a',
        run: async () => {
          calls.push('a');
        },
      },
      {
        id: 'b',
        run: async () => {
          calls.push('b');
        },
      },
    ];

    await executor.execute(tasks);

    expect(calls).toEqual(['a', 'b']);
  });

  it('stops execution when signal is aborted', async () => {
    const calls: string[] = [];
    const abortController = new AbortController();
    const executor = createRuntimeExecutor();
    const tasks: RuntimeTask[] = [
      {
        id: 'a',
        run: async () => {
          calls.push('a');
          abortController.abort();
        },
      },
      {
        id: 'b',
        run: async () => {
          calls.push('b');
        },
      },
    ];

    await executor.execute(tasks, abortController.signal);

    expect(calls).toEqual(['a']);
  });

  it('passes task errors to onError callback', async () => {
    const onError = vi.fn();
    const executor = createRuntimeExecutor({ onError });
    const task: RuntimeTask = {
      id: 'a',
      run: async () => {
        throw new Error('boom');
      },
    };

    await executor.execute([task]);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0].message).toBe('boom');
    expect(onError.mock.calls[0]?.[1]).toBe(task);
  });
});
