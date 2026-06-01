import { describe, expect, it } from 'vitest';

import { createSyncMetricsRegistry } from './metrics.js';

describe('createSyncMetricsRegistry', () => {
  it('tracks sync, conflict, backup, and restore counters', () => {
    const metrics = createSyncMetricsRegistry();

    metrics.recordSyncRun({ status: 'success', durationMs: 120, queueDepth: 2, conflicts: 1, retries: 0 });
    metrics.recordSyncRun({ status: 'error', durationMs: 240, queueDepth: 3, conflicts: 2, retries: 1 });
    metrics.recordBackupRun({ success: true, durationMs: 80 });
    metrics.recordRestoreRun({ success: true, durationMs: 60 });

    expect(metrics.snapshot()).toEqual({
      sync_runs_total: 2,
      sync_failures_total: 1,
      sync_conflicts_total: 3,
      backup_runs_total: 1,
      backup_restore_total: 1,
      sync_duration_ms: {
        average: 180,
        max: 240
      },
      queue_depth: {
        average: 2.5,
        max: 3
      },
      retries_total: 1,
      backup_success_rate: 1,
      restore_success_rate: 1
    });
  });
});
