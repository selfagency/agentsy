import { describe, expect, it } from 'vitest';

import { collectConflicts, resolveConflict } from './conflict-resolution.js';
import type { ConflictRecord, SyncRecord } from './types.js';

function createRecord(overrides: Partial<SyncRecord> & Pick<SyncRecord, 'id'>): SyncRecord {
  const baseRecord: SyncRecord = {
    content: 'value',
    id: overrides.id,
    tier: 'wiki',
    updatedAt: '2026-05-15T00:00:00.000Z'
  };

  return {
    ...baseRecord,
    ...overrides
  };
}

function createConflict(overrides: Partial<ConflictRecord> = {}): ConflictRecord {
  const baseConflict: ConflictRecord = {
    detectedAt: '2026-05-15T02:00:00.000Z',
    id: 'conflict-1',
    local: createRecord({
      content: 'local',
      id: 'page-1',
      updatedAt: '2026-05-15T00:00:00.000Z'
    }),
    policy: 'lastWriteWins',
    recordId: 'page-1',
    remote: createRecord({
      content: 'remote',
      id: 'page-1',
      updatedAt: '2026-05-15T01:00:00.000Z'
    }),
    tier: 'wiki'
  };

  return {
    ...baseConflict,
    ...overrides,
    local: overrides.local ?? baseConflict.local,
    remote: overrides.remote ?? baseConflict.remote
  };
}

describe('collectConflicts', () => {
  it('collects normalized conflicts with stable ids', () => {
    const conflicts = collectConflicts(
      [
        createRecord({
          content: 'local-v1',
          id: 'page-1',
          updatedAt: '2026-05-15T00:00:00.000Z'
        })
      ],
      [
        createRecord({
          content: 'remote-v2',
          id: 'page-1',
          updatedAt: '2026-05-15T01:00:00.000Z'
        })
      ],
      {
        detectedAt: '2026-05-15T03:00:00.000Z',
        policy: 'manualRequired'
      }
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      detectedAt: '2026-05-15T03:00:00.000Z',
      policy: 'manualRequired',
      recordId: 'page-1'
    });
    expect(conflicts[0]?.id).toMatch(/^sha256:/u);
  });

  it('ignores identical mirrored records', () => {
    const mirrored = createRecord({
      content: 'same',
      id: 'page-1',
      updatedAt: '2026-05-15T00:00:00.000Z'
    });

    expect(collectConflicts([mirrored], [{ ...mirrored }])).toStrictEqual([]);
  });

  it('matches records by composite tier and id', () => {
    const conflicts = collectConflicts(
      [createRecord({ content: 'local wiki', id: 'page-1', tier: 'wiki' })],
      [
        createRecord({ content: '[0.1,0.2]', id: 'page-1', tier: 'vector' }),
        createRecord({ content: 'remote wiki', id: 'page-1', tier: 'wiki' })
      ]
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      local: { content: 'local wiki' },
      remote: { content: 'remote wiki' },
      tier: 'wiki'
    });
  });
});

describe('resolveConflict', () => {
  it('supports lastWriteWins', () => {
    const result = resolveConflict(createConflict(), 'lastWriteWins');

    expect(result).toMatchObject({
      record: {
        content: 'remote'
      },
      status: 'resolved'
    });
  });

  it('supports localWins and remoteWins', () => {
    const conflict = createConflict();

    expect(resolveConflict(conflict, 'localWins')).toMatchObject({
      record: { content: 'local' },
      status: 'resolved'
    });
    expect(resolveConflict(conflict, 'remoteWins')).toMatchObject({
      record: { content: 'remote' },
      status: 'resolved'
    });
  });

  it('supports deterministic fieldMerge ordering for wiki records', () => {
    const conflict = createConflict({
      local: createRecord({
        content: 'local-content',
        id: 'page-1',
        metadata: { owner: 'local' },
        relationships: ['local-link'],
        vectorFingerprint: 'local-fingerprint'
      }),
      remote: createRecord({
        content: 'remote-content',
        id: 'page-1',
        metadata: { owner: 'remote' },
        relationships: ['remote-link'],
        vectorFingerprint: 'remote-fingerprint'
      })
    });

    const result = resolveConflict(conflict, 'fieldMerge', {
      wikiFieldPrecedence: {
        content: 'remote',
        metadata: 'local',
        relationships: 'local',
        vectorFingerprint: 'remote'
      }
    });

    expect(result).toMatchObject({
      record: {
        content: 'remote-content',
        metadata: { owner: 'local' },
        relationships: ['local-link'],
        vectorFingerprint: 'remote-fingerprint'
      },
      status: 'resolved'
    });
  });

  it('marks manualRequired conflicts as unresolved', () => {
    const result = resolveConflict(createConflict(), 'manualRequired');

    expect(result).toMatchObject({
      record: null,
      status: 'manual'
    });
  });
});
