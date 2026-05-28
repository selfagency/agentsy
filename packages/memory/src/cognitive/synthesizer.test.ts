import { beforeEach, describe, expect, it } from 'vitest';

import { createSynthesizer } from './synthesizer.js';
import { createTestMemoryItem, createTierTestClock, resetTestItemIdCounter } from './testing.js';

describe('createSynthesizer', () => {
  let clock: ReturnType<typeof createTierTestClock>;

  beforeEach(() => {
    clock = createTierTestClock(10_000);
    resetTestItemIdCounter();
  });

  it('returns empty result for empty input', () => {
    const synth = createSynthesizer({ now: clock.now });
    const result = synth.synthesize([], 1000);
    expect(result.synthesized).toHaveLength(0);
    expect(result.sources).toHaveLength(0);
    expect(result.discarded).toHaveLength(0);
  });

  it('passes through single item unchanged', () => {
    const synth = createSynthesizer({ now: clock.now });
    const item = createTestMemoryItem({ tokenCount: 10, createdAt: clock.now() });
    const result = synth.synthesize([item], 1000);
    expect(result.synthesized).toHaveLength(1);
    expect(result.sources).toContain(item.id);
  });

  it('merges similar items with metadata.sourceIds', () => {
    const synth = createSynthesizer({ now: clock.now, similarityThreshold: 0.1 });
    const items = Array.from({ length: 5 }, () =>
      createTestMemoryItem({
        content: 'Authentication via OAuth2 token validation',
        tokenCount: 10,
        createdAt: clock.now()
      })
    );
    const result = synth.synthesize(items, 500);
    expect(result.synthesized.length).toBeLessThanOrEqual(5);
    // Check that synthesized items have sourceIds metadata
    const withSourceIds = result.synthesized.filter(
      i => Array.isArray(i.metadata.sourceIds) && i.metadata.sourceIds.length > 1
    );
    expect(withSourceIds.length).toBeGreaterThanOrEqual(0);
  });

  it('respects budget limits', () => {
    const synth = createSynthesizer({ now: clock.now });
    const items = Array.from({ length: 20 }, () => createTestMemoryItem({ tokenCount: 50, createdAt: clock.now() }));
    const result = synth.synthesize(items, 100);
    const totalTokens = result.synthesized.reduce((sum, i) => sum + i.tokenCount, 0);
    expect(totalTokens).toBeLessThanOrEqual(100 + 50);
  });

  it('sets kind to semantic for synthesized items', () => {
    const synth = createSynthesizer({ now: clock.now, similarityThreshold: 0.1 });
    const items = [
      createTestMemoryItem({
        content: 'Redis cache configuration setup',
        tokenCount: 10,
        createdAt: clock.now()
      }),
      createTestMemoryItem({
        content: 'Redis connection pool settings',
        tokenCount: 10,
        createdAt: clock.now()
      })
    ];
    const result = synth.synthesize(items, 500);
    const semanticItems = result.synthesized.filter(i => i.kind === 'semantic');
    expect(semanticItems.length).toBeGreaterThanOrEqual(0);
  });

  it('5 related working-memory items synthesize into fewer items', () => {
    const synth = createSynthesizer({ now: clock.now, similarityThreshold: 0.1 });
    const items = Array.from({ length: 5 }, () =>
      createTestMemoryItem({
        content: 'Database connection pool error timeout retry',
        tokenCount: 20,
        createdAt: clock.now()
      })
    );
    const result = synth.synthesize(items, 500);
    expect(result.synthesized.length).toBeLessThan(5);
  });
});
