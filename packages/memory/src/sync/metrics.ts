import type {
  SyncMetricsRegistry,
  SyncMetricsRegistrySnapshot,
} from "./types.js";

interface DurationAccumulator {
  total: number;
  count: number;
  max: number;
}

function createAccumulator(): DurationAccumulator {
  return { count: 0, max: 0, total: 0 };
}

function toAverage(accumulator: DurationAccumulator): number {
  return accumulator.count === 0 ? 0 : accumulator.total / accumulator.count;
}

export function createSyncMetricsRegistry(): SyncMetricsRegistry {
  let syncRuns = 0;
  let syncFailures = 0;
  let syncConflicts = 0;
  let backupRuns = 0;
  let backupSuccesses = 0;
  let restoreRuns = 0;
  let restoreSuccesses = 0;
  let retriesTotal = 0;
  const syncDurations = createAccumulator();
  const queueDepth = createAccumulator();

  return {
    recordBackupRun(input) {
      backupRuns += 1;
      if (input.success) {
        backupSuccesses += 1;
      }
    },

    recordRestoreRun(input) {
      restoreRuns += 1;
      if (input.success) {
        restoreSuccesses += 1;
      }
    },

    recordSyncRun(input) {
      syncRuns += 1;
      if (input.status === "error") {
        syncFailures += 1;
      }

      syncConflicts += Math.max(0, input.conflicts);
      retriesTotal += Math.max(0, input.retries);
      syncDurations.total += Math.max(0, input.durationMs);
      syncDurations.count += 1;
      syncDurations.max = Math.max(syncDurations.max, input.durationMs);
      queueDepth.total += Math.max(0, input.queueDepth);
      queueDepth.count += 1;
      queueDepth.max = Math.max(queueDepth.max, input.queueDepth);
    },

    snapshot(): SyncMetricsRegistrySnapshot {
      return {
        backup_restore_total: restoreRuns,
        backup_runs_total: backupRuns,
        backup_success_rate:
          backupRuns === 0 ? 0 : backupSuccesses / backupRuns,
        queue_depth: {
          average: toAverage(queueDepth),
          max: queueDepth.max,
        },
        restore_success_rate:
          restoreRuns === 0 ? 0 : restoreSuccesses / restoreRuns,
        retries_total: retriesTotal,
        sync_conflicts_total: syncConflicts,
        sync_duration_ms: {
          average: toAverage(syncDurations),
          max: syncDurations.max,
        },
        sync_failures_total: syncFailures,
        sync_runs_total: syncRuns,
      };
    },
  };
}
