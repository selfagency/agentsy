import type { SyncManagerLike, SyncRunResult, SyncScheduler, SyncSchedulerOptions, SyncSnapshot } from './types.js';

function withJitter(delayMs: number, jitterRatio: number, random: () => number): number {
  if (jitterRatio <= 0) {
    return delayMs;
  }

  const jitter = delayMs * jitterRatio * random();
  return delayMs + jitter;
}

export function createSyncScheduler(manager: SyncManagerLike, options: SyncSchedulerOptions): SyncScheduler {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let nextRunAt: Date | null = null;
  let consecutiveErrors = 0;
  const now = options.now ?? (() => new Date());
  const random = options.random ?? Math.random;

  function clearScheduled(): void {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    nextRunAt = null;
  }

  function schedule(delayMs: number): void {
    clearScheduled();
    const clampedDelay = Math.max(0, delayMs);
    nextRunAt = new Date(now().getTime() + clampedDelay);
    timeout = setTimeout(async () => {
      timeout = null;
      nextRunAt = null;
      await executeRun();
    }, clampedDelay);
  }

  async function executeRun(localState?: SyncSnapshot): Promise<SyncRunResult> {
    const state = localState ?? (await options.getLocalState());
    const result = await manager.sync(state);

    if (result.status === 'error' && consecutiveErrors < options.maxRetries) {
      consecutiveErrors += 1;
      const retryDelay = Math.min(options.maxDelayMs, options.initialDelayMs * 2 ** consecutiveErrors);
      schedule(options.intervalMs + withJitter(retryDelay, options.jitterRatio ?? 0, random));
      return result;
    }

    consecutiveErrors = 0;
    schedule(withJitter(options.intervalMs, options.jitterRatio ?? 0, random));
    return result;
  }

  return {
    start() {
      schedule(options.initialDelayMs);
    },

    stop() {
      clearScheduled();
      consecutiveErrors = 0;
    },

    async triggerNow() {
      return executeRun();
    },

    getNextRunAt() {
      return nextRunAt;
    }
  };
}
