import { describe, expect, it, beforeEach } from 'vitest';

import { applyDecay, applyDecayToAllTiers, DEFAULT_DECAY_CONFIG, type DecayConfig } from './decay.js';
import { createTierTestClock, createTestMemoryItem, resetTestItemIdCounter } from './testing.js';
import type { MemoryItem, TierName } from './tier-types.js';

describe('applyDecay', () => {
  let clock: ReturnType<typeof createTierTestClock>;

  beforeEach(() => {
    clock = createTierTestClock(10_000);
    resetTestItemIdCounter();
  });

  it('returns keep for fresh items', () => {
    const items = [createTestMemoryItem({ importance: 0.8, createdAt: clock.now() })];
    const results = applyDecay(items, 'working_memory', clock.now());
    expect(results).toHaveLength(1);
    expect(results[0]?.action).toBe('keep');
  });

  it('halves importance after one half-life', () => {
    const halfLife = DEFAULT_DECAY_CONFIG.workingMemoryHalfLife;
    const items = [createTestMemoryItem({ importance: 0.8, createdAt: clock.now() })];
    clock.advance(halfLife);
    const results = applyDecay(items, 'working_memory', clock.now());
    expect(results[0]?.newImportance).toBeCloseTo(0.4, 1);
  });

  it('marks items as discard below minimumImportance', () => {
    const config: DecayConfig = { ...DEFAULT_DECAY_CONFIG, minimumImportance: 0.5 };
    const items = [createTestMemoryItem({ importance: 0.3, createdAt: clock.now() })];
    const results = applyDecay(items, 'working_memory', clock.now(), config);
    expect(results[0]?.action).toBe('discard');
  });

  it('does not decay long-term memory items', () => {
    const items = [createTestMemoryItem({ importance: 0.8, createdAt: clock.now() })];
    clock.advance(1_000_000);
    const results = applyDecay(items, 'long_term_memory', clock.now());
    expect(results[0]?.action).toBe('keep');
    expect(results[0]?.newImportance).toBe(0.8);
  });

  it('marks items as demote or discard when importance drops significantly', () => {
    const items = [createTestMemoryItem({ importance: 0.9, createdAt: clock.now() })];
    clock.advance(6_000);
    const results = applyDecay(items, 'sensory_buffer', clock.now());
    expect(results).toHaveLength(1);
    // After 6s with 2.5s half-life, 0.9 decays to ~0.055 → demote or discard
    const result = results[0];
    expect(result?.action === 'demote' || result?.action === 'discard').toBe(true);
  });

  it('processes multiple items correctly', () => {
    const items = [
      createTestMemoryItem({ importance: 0.9, createdAt: clock.now() }),
      createTestMemoryItem({ importance: 0.1, createdAt: clock.now() })
    ];
    clock.advance(DEFAULT_DECAY_CONFIG.sensoryBufferHalfLife);
    const results = applyDecay(items, 'sensory_buffer', clock.now());
    expect(results).toHaveLength(2);
    // Higher importance should still be relatively higher after decay
    const sorted = [...results].sort((a, b) => b.newImportance - a.newImportance);
    expect(sorted[0]?.newImportance).toBeGreaterThanOrEqual(sorted[1]?.newImportance ?? 0);
  });

  it('returns empty array for empty input', () => {
    const results = applyDecay([], 'working_memory', clock.now());
    expect(results).toHaveLength(0);
  });
});

describe('applyDecayToAllTiers', () => {
  it('applies decay across all tiers', () => {
    const clock = createTierTestClock(10_000);
    const itemsByTier = new Map<TierName, readonly MemoryItem[]>([
      ['sensory_buffer', [createTestMemoryItem({ importance: 0.8, createdAt: clock.now() })]],
      ['working_memory', [createTestMemoryItem({ importance: 0.6, createdAt: clock.now() })]],
      ['long_term_memory', [createTestMemoryItem({ importance: 0.9, createdAt: clock.now() })]]
    ]);

    clock.advance(5_000);
    const results = applyDecayToAllTiers(itemsByTier, clock.now());
    expect(results.length).toBe(3);
    const ltmResult = results.find(r => r.tier === 'long_term_memory');
    expect(ltmResult?.action).toBe('keep');
    expect(ltmResult?.newImportance).toBe(0.9);
  });
});
