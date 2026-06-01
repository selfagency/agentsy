import { describe, expect, it, vi } from 'vitest';

import { createReindexScheduler } from './reindex-scheduler.js';

describe('ReindexScheduler', () => {
  it('starts, triggers, and stops without duplicate intervals', async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    const scheduler = createReindexScheduler({ intervalMs: 300, run });

    scheduler.start();
    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);

    await scheduler.triggerNow();
    expect(run).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(650);
    expect(run).toHaveBeenCalledTimes(3);

    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
    vi.useRealTimers();
  });
});
