import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSyncScheduler } from './sync-scheduler.js';
import type { SyncRunResult, SyncSnapshot } from './types.js';

describe('createSyncScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts periodic sync runs and exposes the next run time', async () => {
    const sync = vi.fn<() => Promise<SyncRunResult>>().mockResolvedValue({
      status: 'success',
      uploaded: 1,
      downloaded: 1,
      resolvedConflicts: 0,
      unresolvedConflicts: 0,
      nextCursor: 'cursor-2'
    });
    const scheduler = createSyncScheduler(
      { sync },
      {
        intervalMs: 1_000,
        initialDelayMs: 100,
        maxDelayMs: 5_000,
        maxRetries: 2,
        jitterRatio: 0,
        getLocalState: () => ({ cursor: 'cursor-1', records: [] }) satisfies SyncSnapshot
      }
    );

    scheduler.start();
    expect(scheduler.getNextRunAt()?.toISOString()).toBe('2026-05-15T00:00:00.100Z');

    await vi.advanceTimersByTimeAsync(100);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('backs off after errors and respects triggerNow', async () => {
    const sync = vi
      .fn<() => Promise<SyncRunResult>>()
      .mockResolvedValueOnce({
        status: 'error',
        uploaded: 0,
        downloaded: 0,
        resolvedConflicts: 0,
        unresolvedConflicts: 0,
        nextCursor: 'cursor-1',
        error: { code: 'SYNC_FAILED', message: 'offline', retryable: true }
      })
      .mockResolvedValue({
        status: 'success',
        uploaded: 1,
        downloaded: 0,
        resolvedConflicts: 0,
        unresolvedConflicts: 0,
        nextCursor: 'cursor-2'
      });

    const scheduler = createSyncScheduler(
      { sync },
      {
        intervalMs: 1_000,
        initialDelayMs: 100,
        maxDelayMs: 5_000,
        maxRetries: 2,
        jitterRatio: 0,
        getLocalState: () => ({ cursor: 'cursor-1', records: [] }) satisfies SyncSnapshot
      }
    );

    scheduler.start();
    await vi.advanceTimersByTimeAsync(100);

    expect(sync).toHaveBeenCalledTimes(1);
    expect(scheduler.getNextRunAt()?.toISOString()).toBe('2026-05-15T00:00:01.300Z');

    await scheduler.triggerNow();
    expect(sync).toHaveBeenCalledTimes(2);
  });
});
