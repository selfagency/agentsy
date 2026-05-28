import { beforeEach, describe, expect, it } from 'vitest';

import { createMemoryTier, nextTierName, prevTierName } from './memory-tier.js';
import { createTestMemoryItem, createTierTestClock, resetTestItemIdCounter } from './testing.js';
import type { TierConfig } from './tier-types.js';

function makeConfig(overrides: Partial<TierConfig> = {}): TierConfig {
  return {
    level: 1,
    name: 'sensory_buffer',
    maxTokens: 200,
    maxItems: 50,
    ttlMs: 5000,
    consolidationThreshold: 0.6,
    compressionTarget: 0.3,
    ...overrides
  };
}

describe('createMemoryTier', () => {
  let clock: ReturnType<typeof createTierTestClock>;

  beforeEach(() => {
    clock = createTierTestClock(10_000);
    resetTestItemIdCounter();
  });

  it('writes and reads an item', () => {
    const tier = createMemoryTier({ config: makeConfig(), now: clock.now });
    const item = createTestMemoryItem({
      tokenCount: 10,
      createdAt: clock.now(),
      lastAccessedAt: clock.now()
    });
    const result = tier.write(item);
    expect(result).not.toBeNull();
    expect(tier.items()).toHaveLength(1);
  });

  it('rejects duplicate id', () => {
    const tier = createMemoryTier({ config: makeConfig(), now: clock.now });
    const item = createTestMemoryItem({
      id: 'dup',
      tokenCount: 10,
      createdAt: clock.now()
    });
    tier.write(item);
    const result = tier.write({ ...item, content: 'updated' });
    expect(result).toBeNull();
  });

  it('rejects when maxItems exceeded', () => {
    const tier = createMemoryTier({
      config: makeConfig({ maxItems: 2 }),
      now: clock.now
    });
    tier.write(createTestMemoryItem({ tokenCount: 10, createdAt: clock.now() }));
    tier.write(createTestMemoryItem({ tokenCount: 10, createdAt: clock.now() }));
    const result = tier.write(createTestMemoryItem({ tokenCount: 10, createdAt: clock.now() }));
    expect(result).toBeNull();
  });

  it('rejects when maxTokens exceeded', () => {
    const tier = createMemoryTier({
      config: makeConfig({ maxTokens: 25 }),
      now: clock.now
    });
    tier.write(createTestMemoryItem({ tokenCount: 10, createdAt: clock.now() }));
    const result = tier.write(createTestMemoryItem({ tokenCount: 20, createdAt: clock.now() }));
    expect(result).toBeNull();
  });

  it('reads with minImportance filter', () => {
    const tier = createMemoryTier({ config: makeConfig(), now: clock.now });
    tier.write(createTestMemoryItem({ importance: 0.9, createdAt: clock.now() }));
    tier.write(createTestMemoryItem({ importance: 0.2, createdAt: clock.now() }));
    const result = tier.read({ minImportance: 0.5 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.importance).toBe(0.9);
  });

  it('reads with kind filter', () => {
    const tier = createMemoryTier({ config: makeConfig(), now: clock.now });
    tier.write(createTestMemoryItem({ kind: 'semantic', createdAt: clock.now() }));
    tier.write(createTestMemoryItem({ kind: 'episodic', createdAt: clock.now() }));
    const result = tier.read({ kind: 'semantic' });
    expect(result.items).toHaveLength(1);
  });

  it('reads with limit and overflowed flag', () => {
    const tier = createMemoryTier({ config: makeConfig(), now: clock.now });
    tier.write(createTestMemoryItem({ importance: 0.9, createdAt: clock.now() }));
    tier.write(createTestMemoryItem({ importance: 0.8, createdAt: clock.now() }));
    tier.write(createTestMemoryItem({ importance: 0.7, createdAt: clock.now() }));
    const result = tier.read({ limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.overflowed).toBe(true);
  });

  it('evicts lowest-importance items', () => {
    const tier = createMemoryTier({ config: makeConfig(), now: clock.now });
    tier.write(
      createTestMemoryItem({
        id: 'low',
        importance: 0.1,
        tokenCount: 10,
        createdAt: clock.now()
      })
    );
    tier.write(
      createTestMemoryItem({
        id: 'high',
        importance: 0.9,
        tokenCount: 10,
        createdAt: clock.now()
      })
    );
    const evicted = tier.evict(1);
    expect(evicted).toHaveLength(1);
    expect(evicted[0]?.id).toBe('low');
    expect(tier.items()).toHaveLength(1);
  });

  it('expires items past TTL on read/write', () => {
    const tier = createMemoryTier({
      config: makeConfig({ ttlMs: 1000 }),
      now: clock.now
    });
    tier.write(createTestMemoryItem({ tokenCount: 10, createdAt: clock.now() }));
    expect(tier.items()).toHaveLength(1);
    clock.advance(2000);
    const result = tier.read();
    expect(result.items).toHaveLength(0);
  });

  it('capacity tracks usage', () => {
    const tier = createMemoryTier({
      config: makeConfig({ maxTokens: 100, maxItems: 10 }),
      now: clock.now
    });
    tier.write(createTestMemoryItem({ tokenCount: 30, createdAt: clock.now() }));
    const cap = tier.capacity();
    expect(cap.usedTokens).toBe(30);
    expect(cap.usedItems).toBe(1);
  });

  it('promotes items to higher tier', () => {
    const lower = createMemoryTier({ config: makeConfig(), now: clock.now });
    const higher = createMemoryTier({
      config: makeConfig({
        level: 2,
        name: 'sensory_register',
        maxTokens: 400
      }),
      now: clock.now
    });
    lower.write(
      createTestMemoryItem({
        importance: 0.8,
        tokenCount: 10,
        createdAt: clock.now()
      })
    );
    lower.write(
      createTestMemoryItem({
        importance: 0.3,
        tokenCount: 10,
        createdAt: clock.now()
      })
    );
    const promoted = lower.promote(1, higher);
    expect(promoted).toBe(1);
    expect(lower.items()).toHaveLength(1);
    expect(higher.items()).toHaveLength(1);
    expect(higher.items()[0]?.importance).toBe(0.8);
  });

  it('demotes items from higher tier', () => {
    const higher = createMemoryTier({
      config: makeConfig({
        level: 2,
        name: 'sensory_register',
        maxTokens: 400,
        maxItems: 10
      }),
      now: clock.now
    });
    const lower = createMemoryTier({
      config: makeConfig({ maxTokens: 200, maxItems: 50 }),
      now: clock.now
    });
    higher.write(
      createTestMemoryItem({
        importance: 0.1,
        tokenCount: 10,
        createdAt: clock.now()
      })
    );
    higher.write(
      createTestMemoryItem({
        importance: 0.9,
        tokenCount: 10,
        createdAt: clock.now()
      })
    );
    const demoted = lower.demote(1, higher);
    expect(demoted).toBe(1);
  });

  it('clear resets all state', () => {
    const tier = createMemoryTier({ config: makeConfig(), now: clock.now });
    tier.write(createTestMemoryItem({ tokenCount: 10, createdAt: clock.now() }));
    tier.clear();
    expect(tier.items()).toHaveLength(0);
    expect(tier.capacity().usedTokens).toBe(0);
  });
});

describe('nextTierName / prevTierName', () => {
  it('navigates forward through tiers', () => {
    expect(nextTierName('sensory_buffer')).toBe('sensory_register');
    expect(nextTierName('sensory_register')).toBe('working_memory');
    expect(nextTierName('working_memory')).toBe('short_term_memory');
    expect(nextTierName('short_term_memory')).toBe('long_term_memory');
    expect(nextTierName('long_term_memory')).toBeNull();
  });

  it('navigates backward through tiers', () => {
    expect(prevTierName('long_term_memory')).toBe('short_term_memory');
    expect(prevTierName('sensory_buffer')).toBeNull();
  });
});
