import type { BackupManifest, BackupManifestInput, SyncRecord } from './types.js';

import { computeSyncChecksum } from './integrity.js';

function cloneJsonMetadata<T>(metadata: T): T {
  return JSON.parse(JSON.stringify(metadata)) as T;
}

function cloneRecords(records: SyncRecord[]): SyncRecord[] {
  return records.map(record => ({
    ...record,
    ...(record.metadata === undefined ? {} : { metadata: cloneJsonMetadata(record.metadata) }),
    ...(record.relationships === undefined ? {} : { relationships: [...record.relationships] })
  }));
}

export function createBackupManifest(input: BackupManifestInput): BackupManifest {
  const records = cloneRecords(input.records);
  const checksum = computeSyncChecksum({
    snapshotId: input.snapshotId,
    sourceVersion: input.sourceVersion,
    schemaVersion: input.schemaVersion,
    targetDatabaseId: input.targetDatabaseId,
    createdAt: input.createdAt,
    records
  });

  return {
    id: input.snapshotId,
    createdAt: input.createdAt,
    checksum,
    sourceVersion: input.sourceVersion,
    schemaVersion: input.schemaVersion,
    targetDatabaseId: input.targetDatabaseId,
    recordCount: records.length,
    records
  };
}

export function verifyBackupManifest(manifest: BackupManifest, records: SyncRecord[] = manifest.records): boolean {
  const expected = createBackupManifest({
    snapshotId: manifest.id,
    sourceVersion: manifest.sourceVersion,
    schemaVersion: manifest.schemaVersion,
    targetDatabaseId: manifest.targetDatabaseId,
    records,
    createdAt: manifest.createdAt
  });

  return expected.checksum === manifest.checksum && expected.recordCount === manifest.recordCount;
}
