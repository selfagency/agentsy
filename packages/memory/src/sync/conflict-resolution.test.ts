import { describe, expect, it } from 'vitest';

import { collectConflicts, resolveConflict } from './conflict-resolution.js';
import type { ConflictRecord, SyncRecord } from './types.js';

function createRecord(overrides: Partial<SyncRecord> & Pick<SyncRecord, 'id'>): SyncRecord {
  const baseRecord: SyncRecord = {
    id: overrides.id,
    tier: 'wiki',
    updatedAt: '2026-05-15T00:00:00.000Z',
    content: 'value'
  };

  return {
    ...baseRecord,
    ...overrides
  };
}

function createConflict(overrides: Partial<ConflictRecord> = {}): ConflictRecord {
  const baseConflict: ConflictRecord = {
    id: 'conflict-1',
    recordId: 'page-1',
    tier: 'wiki',
    local: createRecord({ id: 'page-1', content: 'local', updatedAt: '2026-05-15T00:00:00.000Z' }),
    remote: createRecord({ id: 'page-1', content: 'remote', updatedAt: '2026-05-15T01:00:00.000Z' }),
    detectedAt: '2026-05-15T02:00:00.000Z',
    policy: 'lastWriteWins'
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
      [createRecord({ id: 'page-1', content: 'local-v1', updatedAt: '2026-05-15T00:00:00.000Z' })],
      [createRecord({ id: 'page-1', content: 'remote-v2', updatedAt: '2026-05-15T01:00:00.000Z' })],
      {
        detectedAt: '2026-05-15T03:00:00.000Z',
        policy: 'manualRequired'
      }
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      recordId: 'page-1',
      detectedAt: '2026-05-15T03:00:00.000Z',
      policy: 'manualRequired'
    });
    expect(conflicts[0]?.id).toMatch(/^sha256:/u);
  });

  it('ignores identical mirrored records', () => {
    const mirrored = createRecord({ id: 'page-1', content: 'same', updatedAt: '2026-05-15T00:00:00.000Z' });

    expect(collectConflicts([mirrored], [{ ...mirrored }])).toEqual([]);
  });

  it('matches records by composite tier and id', () => {
    const conflicts = collectConflicts(
      [createRecord({ id: 'page-1', tier: 'wiki', content: 'local wiki' })],
      [
        createRecord({ id: 'page-1', tier: 'vector', content: '[0.1,0.2]' }),
        createRecord({ id: 'page-1', tier: 'wiki', content: 'remote wiki' })
      ]
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      tier: 'wiki',
      local: { content: 'local wiki' },
      remote: { content: 'remote wiki' }
    });
  });
});

describe('resolveConflict', () => {
  it('supports lastWriteWins', () => {
    const result = resolveConflict(createConflict(), 'lastWriteWins');

    expect(result).toMatchObject({
      status: 'resolved',
      record: {
        content: 'remote'
      }
    });
  });

  it('supports localWins and remoteWins', () => {
    const conflict = createConflict();

    expect(resolveConflict(conflict, 'localWins')).toMatchObject({
      status: 'resolved',
      record: { content: 'local' }
    });
    expect(resolveConflict(conflict, 'remoteWins')).toMatchObject({
      status: 'resolved',
      record: { content: 'remote' }
    });
  });

  it('supports deterministic fieldMerge ordering for wiki records', () => {
    const conflict = createConflict({
      local: createRecord({
        id: 'page-1',
        content: 'local-content',
        metadata: { owner: 'local' },
        relationships: ['local-link'],
        vectorFingerprint: 'local-fingerprint'
      }),
      remote: createRecord({
        id: 'page-1',
        content: 'remote-content',
        metadata: { owner: 'remote' },
        relationships: ['remote-link'],
        vectorFingerprint: 'remote-fingerprint'
      })
    });

    const result = resolveConflict(conflict, 'fieldMerge', {
      wikiFieldPrecedence: {
        metadata: 'local',
        content: 'remote',
        relationships: 'local',
        vectorFingerprint: 'remote'
      }
    });

    expect(result).toMatchObject({
      status: 'resolved',
      record: {
        metadata: { owner: 'local' },
        content: 'remote-content',
        relationships: ['local-link'],
        vectorFingerprint: 'remote-fingerprint'
      }
    });
  });

  it('marks manualRequired conflicts as unresolved', () => {
    const result = resolveConflict(createConflict(), 'manualRequired');

    expect(result).toMatchObject({
      status: 'manual',
      record: null
    });
  });
});
