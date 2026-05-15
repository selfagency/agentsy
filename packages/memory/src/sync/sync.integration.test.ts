import { describe, expect, it } from 'vitest';

import { createBackupManager } from './backup-manager.js';
import { createConflictStore } from './conflict-store.js';
import { createSyncScheduler } from './sync-scheduler.js';
import { createTursoManager } from './turso-manager.js';
import type { SyncRecord, SyncSnapshot } from './types.js';

function createRecord(id: string, content: string, updatedAt: string): SyncRecord {
  return {
    id,
    tier: 'wiki',
    updatedAt,
    content
  };
}

describe('Phase 2 sync integration', () => {
  it('syncs local and remote state end to end', async () => {
    const remoteRecords: SyncRecord[] = [createRecord('remote-1', 'Remote note', '2026-05-15T00:00:00.000Z')];
    const manager = createTursoManager({
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      authToken: 'token-value',
      syncIntervalMs: 5_000,
      maxRetries: 3,
      client: {
        async upload(snapshot) {
          remoteRecords.splice(0, remoteRecords.length, ...snapshot.records);
          return { uploadedCount: snapshot.records.length, nextCursor: 'remote-cursor-2' };
        },
        async download(cursor) {
          return { cursor, records: [...remoteRecords] };
        }
      }
    });

    const result = await manager.sync({
      cursor: 'local-cursor-1',
      records: [createRecord('local-1', 'Local note', '2026-05-15T01:00:00.000Z')]
    });

    expect(result.status).toBe('success');
    expect(remoteRecords[0]?.id).toBe('local-1');
  });

  it('persists unresolved conflicts for manual resolution workflows', async () => {
    const conflictStore = createConflictStore();
    const manager = createTursoManager({
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      authToken: 'token-value',
      syncIntervalMs: 5_000,
      maxRetries: 3,
      mergePolicy: 'manualRequired',
      conflictStore,
      client: {
        async upload(snapshot) {
          return { uploadedCount: snapshot.records.length, nextCursor: 'remote-cursor-2' };
        },
        async download(cursor) {
          return {
            cursor,
            records: [createRecord('shared-1', 'Remote edit', '2026-05-15T02:00:00.000Z')]
          };
        }
      }
    });

    const result = await manager.sync({
      cursor: 'local-cursor-1',
      records: [createRecord('shared-1', 'Local edit', '2026-05-15T01:00:00.000Z')]
    });

    expect(result).toMatchObject({
      status: 'success',
      unresolvedConflicts: 1
    });
    expect(await conflictStore.pendingCount()).toBe(1);
  });

  it('supports backup restore and rollback workflows', async () => {
    let state: SyncSnapshot = {
      cursor: 'cursor-1',
      records: [createRecord('record-1', 'before', '2026-05-15T00:00:00.000Z')]
    };
    const backupManager = createBackupManager({
      databaseId: 'agentsy-memory',
      schemaVersion: 1,
      getCurrentState: async () => state,
      applySnapshot: async snapshot => {
        state = snapshot;
      }
    });

    const snapshot = await backupManager.createSnapshot();
    state = {
      cursor: 'cursor-2',
      records: [createRecord('record-2', 'after', '2026-05-16T00:00:00.000Z')]
    };

    const restore = await backupManager.restoreSnapshot(snapshot.id, {
      targetDatabaseId: 'agentsy-memory',
      schemaVersion: 1
    });

    expect(state.records[0]?.id).toBe('record-1');

    await backupManager.rollback(restore.rollbackSnapshotId!);
    expect(state.records[0]?.id).toBe('record-2');
  });

  it('keeps local coordination available during offline sync failures', async () => {
    const manager = createTursoManager({
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      authToken: 'token-value',
      syncIntervalMs: 5_000,
      maxRetries: 3,
      client: {
        async upload() {
          throw new Error('offline');
        },
        async download() {
          throw new Error('offline');
        }
      }
    });

    const scheduler = createSyncScheduler(manager, {
      intervalMs: 1_000,
      initialDelayMs: 10,
      maxDelayMs: 5_000,
      maxRetries: 2,
      jitterRatio: 0,
      getLocalState: () => ({ cursor: 'cursor-1', records: [] })
    });

    const result = await scheduler.triggerNow();

    expect(result).toMatchObject({
      status: 'error'
    });
    expect(manager.getStatus()).toBe('error');
  });
});
