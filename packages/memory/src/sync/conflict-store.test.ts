import { describe, expect, it } from 'vitest';

import { createConflictStore } from './conflict-store.js';
import type { ConflictRecord, SyncRecord } from './types.js';

function createRecord(id: string, content: string): SyncRecord {
  return {
    id,
    tier: 'wiki',
    updatedAt: '2026-05-15T00:00:00.000Z',
    content
  };
}

function createConflict(id: string): ConflictRecord {
  return {
    id,
    recordId: `record-${id}`,
    tier: 'wiki',
    local: createRecord(`record-${id}`, 'local'),
    remote: createRecord(`record-${id}`, 'remote'),
    detectedAt: '2026-05-15T01:00:00.000Z',
    policy: 'manualRequired'
  };
}

describe('createConflictStore', () => {
  it('stores and lists unresolved conflicts', async () => {
    const store = createConflictStore();
    const first = createConflict('conflict-1');
    const second = createConflict('conflict-2');

    await store.save(first);
    await store.save(second);

    expect(await store.list()).toEqual([first, second]);
    expect(await store.get('conflict-1')).toEqual(first);
    expect(await store.pendingCount()).toBe(2);
  });

  it('marks conflicts as resolved and removes them from pending list', async () => {
    const store = createConflictStore();
    const conflict = createConflict('conflict-1');

    await store.save(conflict);
    await store.resolve('conflict-1');

    expect(await store.get('conflict-1')).toBeNull();
    expect(await store.pendingCount()).toBe(0);
  });
});
