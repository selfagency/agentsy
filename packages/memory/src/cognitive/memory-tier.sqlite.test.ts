import { describe, expect, it } from 'vitest';

import { createDatabaseConnection } from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';
import { createMemoryTier } from './memory-tier.js';
import { createTierTestClock, createTestMemoryItem } from './testing.js';
import type { TierConfig } from './tier-types.js';

function makeConfig(overrides: Partial<TierConfig> = {}): TierConfig {
  return {
    compressionTarget: 0.5,
    consolidationThreshold: 0.5,
    level: 1,
    maxItems: 10,
    maxTokens: 500,
    name: 'sensory_buffer',
    ttlMs: 60_000,
    ...overrides
  };
}

describe('createMemoryTier with SQLite', () => {
  it('writes and reads items from the database', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const tier = createMemoryTier({ config: makeConfig(), db });
    const item = createTestMemoryItem({ tokenCount: 10 });

    const written = tier.write(item);
    expect(written).not.toBeNull();

    const result = tier.read();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(item.id);
    expect(result.items[0]?.content).toBe(item.content);

    sqlite.close();
  });

  it('enforces maxItems capacity', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const tier = createMemoryTier({ config: makeConfig({ maxItems: 2 }), db });

    tier.write(createTestMemoryItem({ tokenCount: 5 }));
    tier.write(createTestMemoryItem({ tokenCount: 5 }));
    const rejected = tier.write(createTestMemoryItem({ tokenCount: 5 }));

    expect(rejected).toBeNull();
    expect(tier.capacity().usedItems).toBe(2);

    sqlite.close();
  });

  it('enforces maxTokens capacity', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const tier = createMemoryTier({ config: makeConfig({ maxTokens: 20 }), db });

    tier.write(createTestMemoryItem({ tokenCount: 10 }));
    tier.write(createTestMemoryItem({ tokenCount: 10 }));
    const rejected = tier.write(createTestMemoryItem({ tokenCount: 1 }));

    expect(rejected).toBeNull();
    expect(tier.capacity().usedTokens).toBe(20);

    sqlite.close();
  });

  it('prevents duplicate ids in the same tier', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const tier = createMemoryTier({ config: makeConfig(), db });
    const item = createTestMemoryItem({ tokenCount: 5 });

    tier.write(item);
    const duplicate = tier.write(item);

    expect(duplicate).toBeNull();

    sqlite.close();
  });

  it('filters by minImportance, kind, and writeHeap', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const tier = createMemoryTier({ config: makeConfig(), db });

    tier.write(createTestMemoryItem({ tokenCount: 5, importance: 0.9, kind: 'episodic', writeHeap: 'event' }));
    tier.write(createTestMemoryItem({ tokenCount: 5, importance: 0.3, kind: 'semantic', writeHeap: 'query' }));

    const highImportance = tier.read({ minImportance: 0.5 });
    expect(highImportance.items).toHaveLength(1);
    expect(highImportance.items[0]?.importance).toBe(0.9);

    const episodic = tier.read({ kind: 'episodic' });
    expect(episodic.items).toHaveLength(1);

    const eventHeap = tier.read({ writeHeap: 'event' });
    expect(eventHeap.items).toHaveLength(1);

    sqlite.close();
  });

  it('evicts lowest importance items', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const tier = createMemoryTier({ config: makeConfig(), db });

    tier.write(createTestMemoryItem({ tokenCount: 5, importance: 0.9 }));
    tier.write(createTestMemoryItem({ tokenCount: 5, importance: 0.1 }));

    const evicted = tier.evict(1);
    expect(evicted).toHaveLength(1);
    expect(evicted[0]?.importance).toBe(0.1);
    expect(tier.capacity().usedItems).toBe(1);

    sqlite.close();
  });

  it('promotes items to another tier', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const source = createMemoryTier({ config: makeConfig({ name: 'sensory_buffer', level: 1 }), db });
    const target = createMemoryTier({
      config: makeConfig({ name: 'sensory_register', level: 2 }),
      db
    });

    const item = createTestMemoryItem({ tokenCount: 5, importance: 0.9 });
    source.write(item);

    const promoted = source.promote(1, target);
    expect(promoted).toBe(1);
    expect(source.capacity().usedItems).toBe(0);
    expect(target.capacity().usedItems).toBe(1);

    sqlite.close();
  });

  it('demotes items from a higher tier', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const higher = createMemoryTier({
      config: makeConfig({ name: 'sensory_register', level: 2, maxTokens: 400 }),
      db
    });
    const lower = createMemoryTier({ config: makeConfig({ name: 'sensory_buffer', level: 1 }), db });

    higher.write(createTestMemoryItem({ tokenCount: 5, importance: 0.1 }));
    higher.write(createTestMemoryItem({ tokenCount: 5, importance: 0.9 }));

    const demoted = lower.demote(1, higher);
    expect(demoted).toBe(1);
    expect(lower.capacity().usedItems).toBe(1);
    expect(higher.capacity().usedItems).toBe(2);

    sqlite.close();
  });

  it('clears all items', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const tier = createMemoryTier({ config: makeConfig(), db });
    tier.write(createTestMemoryItem({ tokenCount: 5 }));
    tier.write(createTestMemoryItem({ tokenCount: 5 }));

    tier.clear();
    expect(tier.capacity().usedItems).toBe(0);
    expect(tier.capacity().usedTokens).toBe(0);

    sqlite.close();
  });

  it('evicts expired items based on ttlMs', () => {
    const clock = createTierTestClock(10_000);
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const tier = createMemoryTier({ config: makeConfig({ ttlMs: 1_000 }), db, now: clock.now });

    tier.write(createTestMemoryItem({ tokenCount: 5, createdAt: clock.now() }));
    clock.advance(500);
    tier.write(createTestMemoryItem({ tokenCount: 5, createdAt: clock.now() }));
    clock.advance(600);

    const result = tier.read();
    expect(result.items).toHaveLength(1);

    sqlite.close();
  });
});
