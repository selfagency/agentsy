import { describe, expect, it } from "vitest";

import { createBackupManager } from "./backup-manager.js";
import type { SyncRecord } from "./types.js";

function createState(records: SyncRecord[]) {
  return {
    cursor: "cursor-1",
    records,
  };
}

describe(createBackupManager, () => {
  it("creates and verifies snapshots", async () => {
    const state = createState([
      {
        content: "value-1",
        id: "record-1",
        tier: "wiki",
        updatedAt: "2026-05-15T00:00:00.000Z",
      },
    ]);
    const manager = createBackupManager({
      applySnapshot: async () => {},
      databaseId: "agentsy-memory",
      getCurrentState: async () => state,
      schemaVersion: 1,
    });

    const snapshot = await manager.createSnapshot();

    await expect(manager.verifySnapshot(snapshot.id)).resolves.toBeTruthy();
    expect(snapshot.recordCount).toBe(1);
  });

  it("requires explicit force for mismatched restore targets", async () => {
    let restored = createState([]);
    const initial = createState([
      {
        content: "value-1",
        id: "record-1",
        tier: "wiki",
        updatedAt: "2026-05-15T00:00:00.000Z",
      },
    ]);
    const manager = createBackupManager({
      applySnapshot: async (snapshot) => {
        restored = snapshot;
      },
      databaseId: "agentsy-memory",
      getCurrentState: async () => initial,
      schemaVersion: 1,
    });

    const snapshot = await manager.createSnapshot();

    await expect(
      manager.restoreSnapshot(snapshot.id, {
        schemaVersion: 1,
        targetDatabaseId: "other-memory",
      })
    ).rejects.toThrow(/target database identity/u);

    await expect(
      manager.restoreSnapshot(snapshot.id, {
        force: true,
        schemaVersion: 1,
        targetDatabaseId: "other-memory",
      })
    ).resolves.toMatchObject({
      restoredCount: 1,
      snapshotId: snapshot.id,
    });
    expect(restored.records).toHaveLength(1);
  });

  it("creates rollback restore points", async () => {
    let current = createState([
      {
        content: "old",
        id: "record-old",
        tier: "wiki",
        updatedAt: "2026-05-15T00:00:00.000Z",
      },
    ]);
    const manager = createBackupManager({
      applySnapshot: async (snapshot) => {
        current = snapshot;
      },
      databaseId: "agentsy-memory",
      getCurrentState: async () => current,
      schemaVersion: 1,
    });

    const freshSnapshot = await manager.createSnapshot();
    current = createState([
      {
        content: "new",
        id: "record-new",
        tier: "wiki",
        updatedAt: "2026-05-16T00:00:00.000Z",
      },
    ]);

    const restore = await manager.restoreSnapshot(freshSnapshot.id, {
      schemaVersion: 1,
      targetDatabaseId: "agentsy-memory",
    });
    const { rollbackSnapshotId } = restore;

    expect(current.records[0]?.id).toBe("record-old");
    expect(rollbackSnapshotId).toBeDefined();

    if (!rollbackSnapshotId) {
      throw new Error("Expected restore to include rollback snapshot id");
    }

    await manager.rollback(rollbackSnapshotId);
    expect(current.records[0]?.id).toBe("record-new");
  });
});
