import { describe, expect, it } from 'vitest';

import { createBackupManifest, verifyBackupManifest } from './backup-manifest.js';

describe('backup manifest', () => {
  it('creates manifest metadata with checksum and counts', () => {
    const manifest = createBackupManifest({
      createdAt: '2026-05-15T01:00:00.000Z',
      records: [
        {
          content: 'value-1',
          id: 'record-1',
          tier: 'wiki',
          updatedAt: '2026-05-15T00:00:00.000Z'
        },
        {
          content: 'value-2',
          id: 'record-2',
          tier: 'raw',
          updatedAt: '2026-05-15T00:00:00.000Z'
        }
      ],
      schemaVersion: 1,
      snapshotId: 'snapshot-1',
      sourceVersion: 2,
      targetDatabaseId: 'agentsy-memory'
    });

    expect(manifest).toMatchObject({
      createdAt: '2026-05-15T01:00:00.000Z',
      id: 'snapshot-1',
      recordCount: 2,
      schemaVersion: 1,
      sourceVersion: 2,
      targetDatabaseId: 'agentsy-memory'
    });
    expect(manifest.checksum).toMatch(/^sha256:/u);
  });

  it('detects tampered manifests', () => {
    const manifest = createBackupManifest({
      createdAt: '2026-05-15T01:00:00.000Z',
      records: [
        {
          content: 'value-1',
          id: 'record-1',
          tier: 'wiki',
          updatedAt: '2026-05-15T00:00:00.000Z'
        }
      ],
      schemaVersion: 1,
      snapshotId: 'snapshot-1',
      sourceVersion: 2,
      targetDatabaseId: 'agentsy-memory'
    });

    expect(verifyBackupManifest(manifest, manifest.records)).toBeTruthy();
    expect(
      verifyBackupManifest(
        {
          ...manifest,
          checksum: 'sha256:tampered'
        },
        manifest.records
      )
    ).toBeFalsy();
  });

  it('deep-clones metadata in manifest records', () => {
    const source = [
      {
        content: 'value-1',
        id: 'record-1',
        metadata: { nested: { value: 'original' } },
        tier: 'wiki' as const,
        updatedAt: '2026-05-15T00:00:00.000Z'
      }
    ];

    const manifest = createBackupManifest({
      createdAt: '2026-05-15T01:00:00.000Z',
      records: source,
      schemaVersion: 1,
      snapshotId: 'snapshot-1',
      sourceVersion: 2,
      targetDatabaseId: 'agentsy-memory'
    });

    const record = source[0] as { metadata: { nested: { value: string } } };
    record.metadata.nested.value = 'mutated';

    expect(manifest.records[0]?.metadata).toMatchObject({
      nested: { value: 'original' }
    });
  });
});
