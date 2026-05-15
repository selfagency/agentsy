import { randomUUID } from 'node:crypto';

import { createBackupManifest, verifyBackupManifest } from './backup-manifest.js';
import { cloneSyncSnapshot } from './integrity.js';
import type { BackupManager, BackupManagerOptions, BackupManifest, RestoreResult, SyncSnapshot } from './types.js';

interface StoredSnapshot {
  manifest: BackupManifest;
  snapshot: SyncSnapshot;
}

function createRestoreResult(snapshotId: string, restoredCount: number, rollbackSnapshotId?: string): RestoreResult {
  return {
    snapshotId,
    restoredCount,
    restoredAt: new Date().toISOString(),
    ...(rollbackSnapshotId === undefined ? {} : { rollbackSnapshotId })
  };
}

class InMemoryBackupManager implements BackupManager {
  readonly #snapshots = new Map<string, StoredSnapshot>();
  readonly #restorePoints = new Map<string, SyncSnapshot>();

  constructor(private readonly options: BackupManagerOptions) {}

  async createSnapshot(): Promise<BackupManifest> {
    const current = cloneSyncSnapshot(await this.options.getCurrentState());
    const now = (this.options.now ?? (() => new Date()))().toISOString();
    const snapshotId = (this.options.createId ?? randomUUID)();
    const manifest = createBackupManifest({
      snapshotId,
      sourceVersion: 1,
      schemaVersion: this.options.schemaVersion,
      targetDatabaseId: this.options.databaseId,
      records: current.records,
      createdAt: now
    });

    this.#snapshots.set(snapshotId, {
      manifest,
      snapshot: current
    });

    return manifest;
  }

  async verifySnapshot(snapshotId: string): Promise<boolean> {
    const stored = this.#snapshots.get(snapshotId);
    if (!stored) {
      return false;
    }

    return verifyBackupManifest(stored.manifest, stored.snapshot.records);
  }

  async restoreSnapshot(
    snapshotId: string,
    options: { targetDatabaseId: string; schemaVersion: number; force?: boolean }
  ): Promise<RestoreResult> {
    const stored = this.#snapshots.get(snapshotId);
    if (!stored) {
      throw new Error(`Unknown snapshot ${snapshotId}`);
    }

    const targetMatches = stored.manifest.targetDatabaseId === options.targetDatabaseId;
    const schemaMatches = stored.manifest.schemaVersion === options.schemaVersion;

    if ((!targetMatches || !schemaMatches) && !options.force) {
      if (!targetMatches) {
        throw new Error('Restore target database identity does not match the snapshot target database identity.');
      }

      throw new Error('Restore schema version is incompatible with the snapshot schema version.');
    }

    const restorePointId = (this.options.createId ?? randomUUID)();
    this.#restorePoints.set(restorePointId, cloneSyncSnapshot(await this.options.getCurrentState()));
    await this.options.applySnapshot(cloneSyncSnapshot(stored.snapshot));

    return createRestoreResult(snapshotId, stored.snapshot.records.length, restorePointId);
  }

  async rollback(restorePointId: string): Promise<RestoreResult> {
    const restorePoint = this.#restorePoints.get(restorePointId);
    if (!restorePoint) {
      throw new Error(`Unknown restore point ${restorePointId}`);
    }

    await this.options.applySnapshot(cloneSyncSnapshot(restorePoint));
    this.#restorePoints.delete(restorePointId);

    return createRestoreResult(restorePointId, restorePoint.records.length);
  }
}

export function createBackupManager(options: BackupManagerOptions): BackupManager {
  return new InMemoryBackupManager(options);
}
