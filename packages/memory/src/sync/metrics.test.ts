import { describe, expect, it } from "vitest";

import { createSyncMetricsRegistry } from "./metrics.js";

describe(createSyncMetricsRegistry, () => {
  it("tracks sync, conflict, backup, and restore counters", () => {
    const metrics = createSyncMetricsRegistry();

    metrics.recordSyncRun({
      conflicts: 1,
      durationMs: 120,
      queueDepth: 2,
      retries: 0,
      status: "success",
    });
    metrics.recordSyncRun({
      conflicts: 2,
      durationMs: 240,
      queueDepth: 3,
      retries: 1,
      status: "error",
    });
    metrics.recordBackupRun({ durationMs: 80, success: true });
    metrics.recordRestoreRun({ durationMs: 60, success: true });

    expect(metrics.snapshot()).toStrictEqual({
      backup_restore_total: 1,
      backup_runs_total: 1,
      backup_success_rate: 1,
      queue_depth: {
        average: 2.5,
        max: 3,
      },
      restore_success_rate: 1,
      retries_total: 1,
      sync_conflicts_total: 3,
      sync_duration_ms: {
        average: 180,
        max: 240,
      },
      sync_failures_total: 1,
      sync_runs_total: 2,
    });
  });
});
