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
      downloaded: 1,
      nextCursor: 'cursor-2',
      resolvedConflicts: 0,
      status: 'success',
      unresolvedConflicts: 0,
      uploaded: 1
    });
    const scheduler = createSyncScheduler(
      { sync },
      {
        getLocalState: () => ({ cursor: 'cursor-1', records: [] }) satisfies SyncSnapshot,
        initialDelayMs: 100,
        intervalMs: 1000,
        jitterRatio: 0,
        maxDelayMs: 5000,
        maxRetries: 2
      }
    );

    scheduler.start();
    expect(scheduler.getNextRunAt()?.toISOString()).toBe('2026-05-15T00:00:00.100Z');

    await vi.advanceTimersByTimeAsync(100);
    expect(sync).toHaveBeenCalledOnce();
  });

  it('backs off after errors and respects triggerNow', async () => {
    const sync = vi
      .fn<() => Promise<SyncRunResult>>()
      .mockResolvedValueOnce({
        downloaded: 0,
        error: { code: 'SYNC_FAILED', message: 'offline', retryable: true },
        nextCursor: 'cursor-1',
        resolvedConflicts: 0,
        status: 'error',
        unresolvedConflicts: 0,
        uploaded: 0
      })
      .mockResolvedValue({
        downloaded: 0,
        nextCursor: 'cursor-2',
        resolvedConflicts: 0,
        status: 'success',
        unresolvedConflicts: 0,
        uploaded: 1
      });

    const scheduler = createSyncScheduler(
      { sync },
      {
        getLocalState: () => ({ cursor: 'cursor-1', records: [] }) satisfies SyncSnapshot,
        initialDelayMs: 100,
        intervalMs: 1000,
        jitterRatio: 0,
        maxDelayMs: 5000,
        maxRetries: 2
      }
    );

    scheduler.start();
    await vi.advanceTimersByTimeAsync(100);

    expect(sync).toHaveBeenCalledOnce();
    expect(scheduler.getNextRunAt()?.toISOString()).toBe('2026-05-15T00:00:01.300Z');

    await scheduler.triggerNow();
    expect(sync).toHaveBeenCalledTimes(2);
  });
});
