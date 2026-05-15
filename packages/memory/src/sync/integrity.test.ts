import { describe, expect, it } from 'vitest';

import { cloneSyncSnapshot, computeSyncChecksum, validateRemoteSnapshot, verifySyncChecksum } from './integrity.js';

describe('sync integrity helpers', () => {
  it('validates a well-formed remote snapshot', () => {
    const snapshot = {
      cursor: 'cursor-1',
      records: [{ id: 'record-1', tier: 'wiki', updatedAt: '2026-05-15T00:00:00.000Z', content: 'value-1' }]
    };

    expect(validateRemoteSnapshot(snapshot)).toEqual({ valid: true, errors: [] });
  });

  it('rejects malformed remote snapshots', () => {
    expect(
      validateRemoteSnapshot({
        cursor: 42,
        records: [{ id: '', tier: 'broken', updatedAt: 'nope', content: 12 }]
      })
    ).toEqual({
      valid: false,
      errors: expect.arrayContaining([
        expect.stringMatching(/cursor/u),
        expect.stringMatching(/id/u),
        expect.stringMatching(/tier/u),
        expect.stringMatching(/updatedAt/u),
        expect.stringMatching(/content/u)
      ])
    });
  });

  it('computes and verifies checksums', () => {
    const payload = {
      cursor: 'cursor-1',
      records: [{ id: 'record-1', tier: 'wiki', updatedAt: '2026-05-15T00:00:00.000Z', content: 'value-1' }]
    };
    const checksum = computeSyncChecksum(payload);

    expect(verifySyncChecksum(payload, checksum)).toBe(true);
    expect(verifySyncChecksum(payload, 'sha256:tampered')).toBe(false);
  });

  it('deep-clones nested metadata in snapshots', () => {
    const snapshot = {
      cursor: 'cursor-1',
      records: [
        {
          id: 'record-1',
          tier: 'wiki' as const,
          updatedAt: '2026-05-15T00:00:00.000Z',
          content: 'value-1',
          metadata: { nested: { value: 'original' } }
        }
      ]
    };

    const clone = cloneSyncSnapshot(snapshot);
    (snapshot.records[0]?.metadata as { nested: { value: string } }).nested.value = 'mutated';

    expect(clone.records[0]?.metadata).toMatchObject({ nested: { value: 'original' } });
  });
});
