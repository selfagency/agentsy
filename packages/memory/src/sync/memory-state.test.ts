import { describe, expect, it, vi } from 'vitest';

import type { MemoryState } from './memory-state.js';
import { createMemoryStateAdapter, deserializeMemoryState, serializeMemoryState } from './memory-state.js';

function createState(): MemoryState {
  return {
    pages: [
      {
        body: 'World',
        format: 'markdown',
        pageId: 'page-1',
        tags: ['intro'],
        title: 'Hello',
        updatedAt: new Date('2026-05-15T10:05:00.000Z'),
        version: 2,
        writerIds: ['writer-1']
      }
    ],
    rawCaptures: [
      {
        content: 'hello',
        createdAt: new Date('2026-05-15T10:00:00.000Z'),
        id: 'raw-1',
        normalizedContent: 'hello',
        sourceId: 'source-1',
        sourceType: 'conversation'
      }
    ],
    vectors: [
      {
        embedding: [0.1, 0.2, 0.3],
        pageId: 'page-1'
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
      pages: [
        {
          body: 'World',
          pageId: 'page-1',
          tags: ['intro'],
          title: 'Hello',
          version: 2
        }
      ],
      rawCaptures: [
        {
          content: 'hello',
          id: 'raw-1',
          sourceId: 'source-1',
          sourceType: 'conversation'
        }
      ],
      vectors: [{ embedding: [0.1, 0.2, 0.3], pageId: 'page-1' }]
    });
  });

  it('creates an adapter that bridges memory state and sync snapshots', async () => {
    const state = createState();
    const applyState = vi.fn(async () => {});
    const adapter = createMemoryStateAdapter({
      applyState,
      getCursor: () => 'cursor-2',
      getState: async () => state
    });

    const snapshot = await adapter.getCurrentState();
    await adapter.applySnapshot(snapshot);

    expect(snapshot.cursor).toBe('cursor-2');
    expect(applyState).toHaveBeenCalledWith(
      expect.objectContaining({
        pages: expect.arrayContaining([expect.objectContaining({ pageId: 'page-1' })]),
        rawCaptures: expect.arrayContaining([expect.objectContaining({ id: 'raw-1' })]),
        vectors: expect.arrayContaining([expect.objectContaining({ pageId: 'page-1' })])
      })
    );
  });

  it('rejects vector snapshots with mismatched fingerprints', () => {
    const snapshot = serializeMemoryState(createState(), 'cursor-1');
    const vectorRecord = snapshot.records.find(record => record.tier === 'vector');

    if (!vectorRecord) {
      throw new Error('Expected vector record in snapshot');
    }

    vectorRecord.content = JSON.stringify([9, 9, 9]);

    expect(() => deserializeMemoryState(snapshot)).toThrow(/fingerprint mismatch/u);
  });
});
