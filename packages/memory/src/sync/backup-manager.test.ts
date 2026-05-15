import { describe, expect, it } from 'vitest';

import { createBackupManager } from './backup-manager.js';
import type { SyncRecord } from './types.js';

function createState(records: SyncRecord[]) {
  return {
    cursor: 'cursor-1',
    records
  };
}

describe('createBackupManager', () => {
  it('creates and verifies snapshots', async () => {
    const state = createState([
      { id: 'record-1', tier: 'wiki', updatedAt: '2026-05-15T00:00:00.000Z', content: 'value-1' }
    ]);
    const manager = createBackupManager({
      databaseId: 'agentsy-memory',
      schemaVersion: 1,
      getCurrentState: async () => state,
      applySnapshot: async () => {}
    });

    const snapshot = await manager.createSnapshot();

    expect(await manager.verifySnapshot(snapshot.id)).toBe(true);
    expect(snapshot.recordCount).toBe(1);
  });

  it('requires explicit force for mismatched restore targets', async () => {
    let restored = createState([]);
    const initial = createState([
      { id: 'record-1', tier: 'wiki', updatedAt: '2026-05-15T00:00:00.000Z', content: 'value-1' }
    ]);
    const manager = createBackupManager({
      databaseId: 'agentsy-memory',
      schemaVersion: 1,
      getCurrentState: async () => initial,
      applySnapshot: async snapshot => {
        restored = snapshot;
      }
    });

    const snapshot = await manager.createSnapshot();

    await expect(
      manager.restoreSnapshot(snapshot.id, {
        targetDatabaseId: 'other-memory',
        schemaVersion: 1
      })
    ).rejects.toThrow(/target database identity/u);

    await expect(
      manager.restoreSnapshot(snapshot.id, {
        targetDatabaseId: 'other-memory',
        schemaVersion: 1,
        force: true
      })
    ).resolves.toMatchObject({
      snapshotId: snapshot.id,
      restoredCount: 1
    });
    expect(restored.records).toHaveLength(1);
  });

  it('creates rollback restore points', async () => {
    let current = createState([
      { id: 'record-old', tier: 'wiki', updatedAt: '2026-05-15T00:00:00.000Z', content: 'old' }
    ]);
    const manager = createBackupManager({
      databaseId: 'agentsy-memory',
      schemaVersion: 1,
      getCurrentState: async () => current,
      applySnapshot: async snapshot => {
        current = snapshot;
      }
    });

    const freshSnapshot = await manager.createSnapshot();
    current = createState([{ id: 'record-new', tier: 'wiki', updatedAt: '2026-05-16T00:00:00.000Z', content: 'new' }]);

    const restore = await manager.restoreSnapshot(freshSnapshot.id, {
      targetDatabaseId: 'agentsy-memory',
      schemaVersion: 1
    });

    expect(current.records[0]?.id).toBe('record-old');

    await manager.rollback(restore.rollbackSnapshotId!);
    expect(current.records[0]?.id).toBe('record-new');
  });
});
