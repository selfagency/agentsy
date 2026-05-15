import { describe, expect, it } from 'vitest';

import { createIndexManager } from './index-manager.js';

describe('IndexManager', () => {
  it('tracks inserted, updated, and skipped documents with fingerprints', () => {
    const manager = createIndexManager();
    const base = {
      id: 'doc-1',
      sourceId: 'wiki:oauth',
      sourceType: 'wiki' as const,
      title: 'OAuth',
      content: 'short-lived access tokens',
      chunkIndex: 0,
      updatedAt: '2026-01-01T00:00:00.000Z'
    };

    const first = manager.upsertMany([base]);
    const second = manager.upsertMany([base]);
    const third = manager.upsertMany([{ ...base, content: 'rotating refresh tokens' }]);

    expect(first).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(second).toEqual({ inserted: 0, updated: 0, skipped: 1 });
    expect(third).toEqual({ inserted: 0, updated: 1, skipped: 0 });
    expect(manager.get('doc-1')?.version).toBe(2);
  });
});
