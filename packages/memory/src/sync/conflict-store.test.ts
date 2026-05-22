import { describe, expect, it } from 'vitest';

import { createConflictStore } from './conflict-store.js';
import type { ConflictRecord, SyncRecord } from './types.js';

function createRecord(id: string, content: string): SyncRecord {
  return {
    content,
    id,
    tier: 'wiki',
    updatedAt: '2026-05-15T00:00:00.000Z'
  };
}

function createConflict(id: string): ConflictRecord {
  return {
    detectedAt: '2026-05-15T01:00:00.000Z',
    id,
    local: createRecord(`record-${id}`, 'local'),
    policy: 'manualRequired',
    recordId: `record-${id}`,
    remote: createRecord(`record-${id}`, 'remote'),
    tier: 'wiki'
  };
}

describe('createConflictStore', () => {
  it('stores and lists unresolved conflicts', async () => {
    const store = createConflictStore();
    const first = createConflict('conflict-1');
    const second = createConflict('conflict-2');

    await store.save(first);
    await store.save(second);

    await expect(store.list()).resolves.toStrictEqual([first, second]);
    await expect(store.get('conflict-1')).resolves.toStrictEqual(first);
    await expect(store.pendingCount()).resolves.toBe(2);
  });

  it('marks conflicts as resolved and removes them from pending list', async () => {
    const store = createConflictStore();
    const conflict = createConflict('conflict-1');

    await store.save(conflict);
    await store.resolve('conflict-1');

    await expect(store.get('conflict-1')).resolves.toBeNull();
    await expect(store.pendingCount()).resolves.toBe(0);
  });
});
