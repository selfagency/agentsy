import { describe, expect, it } from 'vitest';

import { createBackupManifest, verifyBackupManifest } from './backup-manifest.js';

describe('backup manifest', () => {
  it('creates manifest metadata with checksum and counts', () => {
    const manifest = createBackupManifest({
      snapshotId: 'snapshot-1',
      sourceVersion: 2,
      schemaVersion: 1,
      targetDatabaseId: 'agentsy-memory',
      records: [
        { id: 'record-1', tier: 'wiki', updatedAt: '2026-05-15T00:00:00.000Z', content: 'value-1' },
        { id: 'record-2', tier: 'raw', updatedAt: '2026-05-15T00:00:00.000Z', content: 'value-2' }
      ],
      createdAt: '2026-05-15T01:00:00.000Z'
    });

    expect(manifest).toMatchObject({
      id: 'snapshot-1',
      sourceVersion: 2,
      schemaVersion: 1,
      targetDatabaseId: 'agentsy-memory',
      recordCount: 2,
      createdAt: '2026-05-15T01:00:00.000Z'
    });
    expect(manifest.checksum).toMatch(/^sha256:/u);
  });

  it('detects tampered manifests', () => {
    const manifest = createBackupManifest({
      snapshotId: 'snapshot-1',
      sourceVersion: 2,
      schemaVersion: 1,
      targetDatabaseId: 'agentsy-memory',
      records: [{ id: 'record-1', tier: 'wiki', updatedAt: '2026-05-15T00:00:00.000Z', content: 'value-1' }],
      createdAt: '2026-05-15T01:00:00.000Z'
    });

    expect(verifyBackupManifest(manifest, manifest.records)).toBe(true);
    expect(
      verifyBackupManifest(
        {
          ...manifest,
          checksum: 'sha256:tampered'
        },
        manifest.records
      )
    ).toBe(false);
  });
});
