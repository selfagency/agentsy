export interface Scheduler {
  schedule(jobId: string, delayMs: number, callback: () => void): void;
  cancel(jobId: string): void;
  pendingCount(): number;
}

export function createInMemoryScheduler(): Scheduler {
  const jobs = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    schedule(jobId: string, delayMs: number, callback: () => void) {
      const existing = jobs.get(jobId);
      if (existing) {
        clearTimeout(existing);
      }

      const timeout = setTimeout(
        () => {
          jobs.delete(jobId);
          callback();
        },
        Math.max(0, delayMs),
      );

      jobs.set(jobId, timeout);
    },

    cancel(jobId: string) {
      const timeout = jobs.get(jobId);
      if (!timeout) {
        return;
      }

      clearTimeout(timeout);
      jobs.delete(jobId);
    },

    pendingCount() {
      return jobs.size;
    },
  };
}
