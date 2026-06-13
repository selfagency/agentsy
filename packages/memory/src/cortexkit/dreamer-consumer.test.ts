import { describe, expect, it, vi } from 'vitest';
import { createDreamerConsumer, type WikiUpserter } from './dreamer-consumer.js';

/** Build a mock DB where each get/all call reads from a mutable state array. */
function makeMutableDb(initialEpoch: number) {
  let epoch = initialEpoch;
  const memories: Array<{ id: number; category: string; content: string; importance: number }> = [];

  const mock = {
    epoch,
    setEpoch: (n: number) => {
      epoch = n;
    },
    addMemory: (m: (typeof memories)[number]) => {
      memories.push(m);
    },
    prepare: vi.fn((sql: string) => ({
      get: vi.fn(() => {
        if (sql.includes('project_memory_epoch')) {
          return epoch > 0 ? { project_memory_epoch: epoch } : undefined;
        }
        return; // eslint-disable-line no-useless-return
      }),
      all: vi.fn(() => {
        if (sql.includes('project_memories')) {
          return [...memories];
        }
        return [];
      })
    }))
  };

  return mock;
}

describe('createDreamerConsumer', () => {
  it('reports zero when epoch has not changed', async () => {
    const db = makeMutableDb(3);
    const wiki: WikiUpserter = { upsertPage: vi.fn().mockResolvedValue({}) };
    const consumer = createDreamerConsumer({ db: db as any, wiki, projectPath: '/test' });

    const result = await consumer.checkAndSync();

    expect(result).toEqual({ synced: 0, skipped: 0 });
    expect(wiki.upsertPage).not.toHaveBeenCalled();
  });

  it('syncs memories when epoch advances', async () => {
    const db = makeMutableDb(1);
    db.addMemory({ id: 1, category: 'ARCHITECTURE', content: 'Use TypeScript', importance: 0.9 });
    db.addMemory({ id: 2, category: 'CONSTRAINTS', content: 'No any', importance: 0.7 });
    const wiki: WikiUpserter = { upsertPage: vi.fn().mockResolvedValue({}) };
    const consumer = createDreamerConsumer({ db: db as any, wiki, projectPath: '/test' });

    // First call at epoch 1 — no change vs boot
    expect((await consumer.checkAndSync()).synced).toBe(0);

    // Advance epoch
    db.setEpoch(2);
    const result = await consumer.checkAndSync();

    expect(result.synced).toBe(2);
    expect(wiki.upsertPage).toHaveBeenCalledTimes(2);
  });

  it('skips low-importance memories', async () => {
    const db = makeMutableDb(1);
    db.addMemory({ id: 1, category: 'NAMING', content: 'Low value', importance: 0.1 });
    db.addMemory({ id: 2, category: 'PROJECT_RULES', content: 'Important rule', importance: 0.9 });
    const wiki: WikiUpserter = { upsertPage: vi.fn().mockResolvedValue({}) };
    const consumer = createDreamerConsumer({ db: db as any, wiki, projectPath: '/test' });

    // First call at epoch 1 — no change vs boot
    await consumer.checkAndSync();

    // Advance epoch
    db.setEpoch(2);
    const result = await consumer.checkAndSync();

    expect(result.skipped).toBe(1);
    expect(result.synced).toBe(1);
  });

  it('isolates wiki errors', async () => {
    const db = makeMutableDb(1);
    db.addMemory({ id: 1, category: 'CONFIG_VALUES', content: 'Config', importance: 0.8 });
    const wiki: WikiUpserter = { upsertPage: vi.fn().mockRejectedValue(new Error('wiki down')) };
    const consumer = createDreamerConsumer({ db: db as any, wiki, projectPath: '/test' });

    // First call at epoch 1 — no change vs boot
    await consumer.checkAndSync();

    // Advance epoch
    db.setEpoch(2);
    const result = await consumer.checkAndSync();

    expect(result.synced).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('tracks lastKnownEpoch on state', async () => {
    const db = makeMutableDb(5);
    const wiki: WikiUpserter = { upsertPage: vi.fn() };
    const consumer = createDreamerConsumer({ db: db as any, wiki, projectPath: '/test' });

    expect(consumer.state.lastKnownEpoch).toBe(5);

    db.setEpoch(7);
    await consumer.checkAndSync();

    expect(consumer.state.lastKnownEpoch).toBe(7);
  });
});
