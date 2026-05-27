import { describe, expect, it } from 'vitest';

import { createIndexManager } from './index-manager.js';

describe('IndexManager', () => {
  const base = {
    chunkIndex: 0,
    content: 'short-lived access tokens',
    id: 'doc-1',
    sourceId: 'wiki:oauth',
    sourceType: 'wiki' as const,
    title: 'OAuth',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };

  it('tracks inserted, updated, and skipped documents with fingerprints', () => {
    const manager = createIndexManager();

    const first = manager.upsertMany([base]);
    const second = manager.upsertMany([base]);
    const third = manager.upsertMany([{ ...base, content: 'rotating refresh tokens' }]);

    expect(first).toStrictEqual({ inserted: 1, skipped: 0, updated: 0 });
    expect(second).toStrictEqual({ inserted: 0, skipped: 1, updated: 0 });
    expect(third).toStrictEqual({ inserted: 0, skipped: 0, updated: 1 });
    expect(manager.get('doc-1')?.version).toBe(2);
  });

  it('get returns null for nonexistent document', () => {
    const manager = createIndexManager();

    expect(manager.get('nonexistent')).toBeNull();
  });

  it('list returns all documents', () => {
    const manager = createIndexManager();

    manager.upsertMany([base]);
    manager.upsertMany([{ ...base, id: 'doc-2', content: 'another doc' }]);

    const all = manager.list();
    expect(all.length).toBe(2);
    const ids = all.map(r => r.document.id).sort();
    expect(ids).toStrictEqual(['doc-1', 'doc-2']);
  });

  it('list returns empty array when no documents', () => {
    const manager = createIndexManager();

    expect(manager.list()).toStrictEqual([]);
  });

  it('remove returns true for existing document', () => {
    const manager = createIndexManager();

    manager.upsertMany([base]);
    const result = manager.remove('doc-1');

    expect(result).toBe(true);
    expect(manager.get('doc-1')).toBeNull();
  });

  it('remove returns false for nonexistent document', () => {
    const manager = createIndexManager();

    const result = manager.remove('nonexistent');
    expect(result).toBe(false);
  });

  it('list returns copies that are not affected by subsequent mutations', () => {
    const manager = createIndexManager();

    manager.upsertMany([base]);
    const before = manager.list();
    expect(before.length).toBe(1);

    // Mutate the returned reference
    (before[0] as { document: unknown; fingerprint: string; version: number }).version = 99;

    // Internal state should be unchanged
    const after = manager.list();
    expect(after[0]?.version).toBe(1);
  });
});
