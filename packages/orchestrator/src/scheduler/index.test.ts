import { describe, expect, it } from 'vitest';
import { createSchedulerRegistry } from './index.js';

describe('createSchedulerRegistry', () => {
  it('registers pending and scheduled tasks', () => {
    const registry = createSchedulerRegistry();

    const pending = registry.register({ id: 'pending', prompt: 'run soon' });
    const scheduled = registry.register({
      id: 'scheduled',
      prompt: 'run later',
      runAt: Date.now() + 1_000,
      lane: 'nightly',
    });

    expect(pending.status).toBe('pending');
    expect(scheduled.status).toBe('scheduled');
    expect(registry.list()).toHaveLength(2);
  });

  it('cancels existing tasks', () => {
    const registry = createSchedulerRegistry([{ id: 'task-1', prompt: 'hello' }]);

    const cancelled = registry.cancel('task-1');

    expect(cancelled?.status).toBe('cancelled');
    expect(registry.get('task-1')?.status).toBe('cancelled');
  });

  it('filters tasks by lane and status', () => {
    const registry = createSchedulerRegistry([
      { id: 'a', prompt: 'alpha', lane: 'default' },
      { id: 'b', prompt: 'beta', lane: 'nightly', runAt: Date.now() + 100 },
    ]);

    expect(registry.list({ lane: 'nightly' })).toHaveLength(1);
    expect(registry.list({ status: 'scheduled' })).toHaveLength(1);
  });

  it('returns null when cancelling unknown tasks', () => {
    const registry = createSchedulerRegistry();

    expect(registry.cancel('missing')).toBeNull();
  });
});
