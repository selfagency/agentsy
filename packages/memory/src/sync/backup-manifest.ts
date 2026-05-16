import { computeSyncChecksum } from "./integrity.js";
import type {
  BackupManifest,
  BackupManifestInput,
  SyncRecord,
} from "./types.js";

function cloneJsonMetadata<T>(metadata: T): T {
  return structuredClone(metadata);
}

function cloneRecords(records: SyncRecord[]): SyncRecord[] {
  return records.map((record) => ({
    ...record,
    ...(record.metadata === undefined
      ? {}
      : { metadata: cloneJsonMetadata(record.metadata) }),
    ...(record.relationships === undefined
      ? {}
      : { relationships: [...record.relationships] }),
  }));
}

export function createBackupManifest(
  input: BackupManifestInput
): BackupManifest {
  const records = cloneRecords(input.records);
  const checksum = computeSyncChecksum({
    createdAt: input.createdAt,
    records,
    schemaVersion: input.schemaVersion,
    snapshotId: input.snapshotId,
    sourceVersion: input.sourceVersion,
    targetDatabaseId: input.targetDatabaseId,
  });

  return {
    checksum,
    createdAt: input.createdAt,
    id: input.snapshotId,
    recordCount: records.length,
    records,
    schemaVersion: input.schemaVersion,
    sourceVersion: input.sourceVersion,
    targetDatabaseId: input.targetDatabaseId,
  };
}

export function verifyBackupManifest(
  manifest: BackupManifest,
  records: SyncRecord[] = manifest.records
): boolean {
  const expected = createBackupManifest({
    createdAt: manifest.createdAt,
    records,
    schemaVersion: manifest.schemaVersion,
    snapshotId: manifest.id,
    sourceVersion: manifest.sourceVersion,
    targetDatabaseId: manifest.targetDatabaseId,
  });

  return (
    expected.checksum === manifest.checksum &&
    expected.recordCount === manifest.recordCount
  );
}
