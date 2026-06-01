import { describe, expect, it } from 'vitest';

import { createBackupManager } from './backup-manager.js';
import { createConflictStore } from './conflict-store.js';
import { createSyncScheduler } from './sync-scheduler.js';
import { createTursoManager } from './turso-manager.js';
import type { SyncRecord, SyncSnapshot } from './types.js';

function createRecord(id: string, content: string, updatedAt: string): SyncRecord {
  return {
    content,
    id,
    tier: 'wiki',
    updatedAt
  };
}

describe('Phase 2 sync integration', () => {
  it('syncs local and remote state end to end', async () => {
    const remoteRecords: SyncRecord[] = [createRecord('remote-1', 'Remote note', '2026-05-15T00:00:00.000Z')];
    const manager = createTursoManager({
      authToken: 'token-value',
      client: {
        // biome-ignore lint/suspicious/useAwait: must match Promise-returning SyncClient interface
        async download(cursor) {
          return { cursor, records: [...remoteRecords] };
        },
        // biome-ignore lint/suspicious/useAwait: must match Promise-returning SyncClient interface
        async upload(snapshot) {
          remoteRecords.splice(0, remoteRecords.length, ...snapshot.records);
          return {
            nextCursor: 'remote-cursor-2',
            uploadedCount: snapshot.records.length
          };
        }
      },
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      maxRetries: 3,
      syncIntervalMs: 5000
    });

    const result = await manager.sync({
      cursor: 'local-cursor-1',
      records: [createRecord('local-1', 'Local note', '2026-05-15T01:00:00.000Z')]
    });

    expect(result.status).toBe('success');
    expect(remoteRecords).toStrictEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'remote-1' }), expect.objectContaining({ id: 'local-1' })])
    );
  });

  it('persists unresolved conflicts for manual resolution workflows', async () => {
    const conflictStore = createConflictStore();
    const manager = createTursoManager({
      authToken: 'token-value',
      client: {
        // biome-ignore lint/suspicious/useAwait: must match Promise-returning SyncClient interface
        async download(cursor) {
          return {
            cursor,
            records: [createRecord('shared-1', 'Remote edit', '2026-05-15T02:00:00.000Z')]
          };
        },
        // biome-ignore lint/suspicious/useAwait: must match Promise-returning SyncClient interface
        async upload(snapshot) {
          return {
            nextCursor: 'remote-cursor-2',
            uploadedCount: snapshot.records.length
          };
        }
      },
      conflictStore,
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      maxRetries: 3,
      mergePolicy: 'manualRequired',
      syncIntervalMs: 5000
    });

    const result = await manager.sync({
      cursor: 'local-cursor-1',
      records: [createRecord('shared-1', 'Local edit', '2026-05-15T01:00:00.000Z')]
    });

    expect(result).toMatchObject({
      status: 'success',
      unresolvedConflicts: 1
    });
    await expect(conflictStore.pendingCount()).resolves.toBe(1);
  });

  it('supports backup restore and rollback workflows', async () => {
    let state: SyncSnapshot = {
      cursor: 'cursor-1',
      records: [createRecord('record-1', 'before', '2026-05-15T00:00:00.000Z')]
    };
    const backupManager = createBackupManager({
      // biome-ignore lint/suspicious/useAwait: callback matches Promise<void> interface
      applySnapshot: async snapshot => {
        state = snapshot;
      },
      databaseId: 'agentsy-memory',
      getCurrentState: async () => state,
      schemaVersion: 1
    });

    const snapshot = await backupManager.createSnapshot();
    state = {
      cursor: 'cursor-2',
      records: [createRecord('record-2', 'after', '2026-05-16T00:00:00.000Z')]
    };

    const restore = await backupManager.restoreSnapshot(snapshot.id, {
      schemaVersion: 1,
      targetDatabaseId: 'agentsy-memory'
    });
    const { rollbackSnapshotId } = restore;

    expect(state.records[0]?.id).toBe('record-1');
    expect(rollbackSnapshotId).toBeDefined();

    if (!rollbackSnapshotId) {
      throw new Error('Expected restore to include rollback snapshot id');
    }

    await backupManager.rollback(rollbackSnapshotId);
    expect(state.records[0]?.id).toBe('record-2');
  });

  it('keeps local coordination available during offline sync failures', async () => {
    const manager = createTursoManager({
      authToken: 'token-value',
      client: {
        download() {
          throw new Error('offline');
        },
        upload() {
          throw new Error('offline');
        }
      },
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      maxRetries: 3,
      syncIntervalMs: 5000
    });

    const scheduler = createSyncScheduler(manager, {
      getLocalState: () => ({ cursor: 'cursor-1', records: [] }),
      initialDelayMs: 10,
      intervalMs: 1000,
      jitterRatio: 0,
      maxDelayMs: 5000,
      maxRetries: 2
    });

    const result = await scheduler.triggerNow();

    expect(result).toMatchObject({
      status: 'error'
    });
    expect(manager.getStatus()).toBe('error');
  });
});
