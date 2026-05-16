export interface ReindexSchedulerOptions {
  intervalMs: number;
  run: () => Promise<void>;
}

export interface ReindexScheduler {
  start(): void;
  stop(): void;
  triggerNow(): Promise<void>;
  isRunning(): boolean;
}

export function createReindexScheduler(options: ReindexSchedulerOptions): ReindexScheduler {
  let timer: NodeJS.Timeout | null = null;

  const runSafely = async () => {
    try {
      await options.run();
    } catch {
      // intentionally swallowed: scheduler should be resilient in degraded mode
    }
  };

  return {
    isRunning() {
      return timer !== null;
    },

    start() {
      if (timer) {
        return;
      }

      timer = setInterval(
        () => {
          void runSafely();
        },
        Math.max(250, options.intervalMs)
      );
    },

    stop() {
      if (!timer) {
        return;
      }

      clearInterval(timer);
      timer = null;
    },

    async triggerNow() {
      await runSafely();
    }
  };
}
