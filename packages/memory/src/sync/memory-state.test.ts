import { describe, expect, it, vi } from 'vitest';

import { createMemoryStateAdapter, deserializeMemoryState, serializeMemoryState } from './memory-state.js';
import type { MemoryState } from './memory-state.js';

function createState(): MemoryState {
  return {
    rawCaptures: [
      {
        id: 'raw-1',
        sourceId: 'source-1',
        sourceType: 'conversation',
        content: 'hello',
        normalizedContent: 'hello',
        createdAt: new Date('2026-05-15T10:00:00.000Z')
      }
    ],
    pages: [
      {
        pageId: 'page-1',
        title: 'Hello',
        body: 'World',
        tags: ['intro'],
        version: 2,
        format: 'markdown',
        writerIds: ['writer-1'],
        updatedAt: new Date('2026-05-15T10:05:00.000Z')
      }
    ],
    vectors: [
      {
        pageId: 'page-1',
        embedding: [0.1, 0.2, 0.3]
      }
    ]
  };
}

describe('memory state serialization', () => {
  it('serializes three-tier memory state into a sync snapshot', () => {
    const snapshot = serializeMemoryState(createState(), 'cursor-1');

    expect(snapshot).toMatchObject({
      cursor: 'cursor-1',
      records: [
        { id: 'raw-1', tier: 'raw' },
        { id: 'page-1', tier: 'wiki' },
        { id: 'page-1', tier: 'vector' }
      ]
    });
    expect(snapshot.records[2]?.vectorFingerprint).toMatch(/^sha256:/u);
  });

  it('deserializes a snapshot back into memory state', () => {
    const snapshot = serializeMemoryState(createState(), 'cursor-1');

    expect(deserializeMemoryState(snapshot)).toMatchObject({
      rawCaptures: [{ id: 'raw-1', sourceId: 'source-1', sourceType: 'conversation', content: 'hello' }],
      pages: [{ pageId: 'page-1', title: 'Hello', body: 'World', tags: ['intro'], version: 2 }],
      vectors: [{ pageId: 'page-1', embedding: [0.1, 0.2, 0.3] }]
    });
  });

  it('creates an adapter that bridges memory state and sync snapshots', async () => {
    const state = createState();
    const applyState = vi.fn(async () => {});
    const adapter = createMemoryStateAdapter({
      getState: async () => state,
      applyState,
      getCursor: () => 'cursor-2'
    });

    const snapshot = await adapter.getCurrentState();
    await adapter.applySnapshot(snapshot);

    expect(snapshot.cursor).toBe('cursor-2');
    expect(applyState).toHaveBeenCalledWith(
      expect.objectContaining({
        rawCaptures: expect.arrayContaining([expect.objectContaining({ id: 'raw-1' })]),
        pages: expect.arrayContaining([expect.objectContaining({ pageId: 'page-1' })]),
        vectors: expect.arrayContaining([expect.objectContaining({ pageId: 'page-1' })])
      })
    );
  });
});
