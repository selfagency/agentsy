import { beforeEach, describe, expect, it } from 'vitest';

import { createCompressor } from './compressor.js';
import { createTestMemoryItem, createTierTestClock, resetTestItemIdCounter } from './testing.js';

describe('createCompressor', () => {
  let clock: ReturnType<typeof createTierTestClock>;

  beforeEach(() => {
    clock = createTierTestClock(10_000);
    resetTestItemIdCounter();
  });

  it('returns empty result for empty input', () => {
    const compressor = createCompressor({ now: clock.now });
    const result = compressor.compress([], 1000);
    expect(result.chunks).toHaveLength(0);
    expect(result.discarded).toHaveLength(0);
    expect(result.tokenReduction).toBe(0);
  });

  it('compresses items within budget and computes fingerprints', () => {
    const compressor = createCompressor({ now: clock.now });
    const items = Array.from({ length: 10 }, () => createTestMemoryItem({ tokenCount: 50, createdAt: clock.now() }));
    const result = compressor.compress(items, 100);
    expect(result.chunks.length).toBeGreaterThan(0);
    const totalTokens = result.chunks.reduce((sum, c) => sum + c.tokenCount, 0);
    expect(totalTokens).toBeLessThanOrEqual(100);
    for (const chunk of result.chunks) {
      expect(chunk.fingerprint).toMatch(/^blake3:/);
      expect(chunk.metadata._compressed).toBe(true);
    }
  });

  it('discards items that exceed budget', () => {
    const compressor = createCompressor({ now: clock.now });
    const items = Array.from({ length: 5 }, () => createTestMemoryItem({ tokenCount: 100, createdAt: clock.now() }));
    const result = compressor.compress(items, 50);
    expect(result.discarded.length).toBeGreaterThan(0);
    expect(result.chunks.length).toBeLessThan(5);
  });

  it('reduces 500-token input to ≤200 tokens', () => {
    const compressor = createCompressor({ now: clock.now });
    const items = Array.from({ length: 25 }, () => createTestMemoryItem({ tokenCount: 20, createdAt: clock.now() }));
    const result = compressor.compress(items, 200);
    const totalTokens = result.chunks.reduce((sum, c) => sum + c.tokenCount, 0);
    expect(totalTokens).toBeLessThanOrEqual(200);
    expect(result.tokenReduction).toBeGreaterThan(0);
  });

  it('assigns higher importance to recent items', () => {
    const compressor = createCompressor({ now: clock.now });
    const oldItem = createTestMemoryItem({
      id: 'old',
      tokenCount: 10,
      importance: 0.5,
      createdAt: clock.now() - 60_000
    });
    const newItem = createTestMemoryItem({
      id: 'new',
      tokenCount: 10,
      importance: 0.5,
      createdAt: clock.now()
    });
    const result = compressor.compress([oldItem, newItem], 50);
    const recentChunk = result.chunks.find(c => c.id === 'new');
    const oldChunk = result.chunks.find(c => c.id === 'old');
    // Both items should survive; recent item should have equal or higher importance
    expect(recentChunk).toBeDefined();
    expect(oldChunk).toBeDefined();
    const recentImportance = recentChunk?.importance ?? 0;
    const oldImportance = oldChunk?.importance ?? 1;
    expect(recentImportance).toBeGreaterThanOrEqual(oldImportance);
  });

  it('normalizes content via ContentProcessor', () => {
    const compressor = createCompressor({ now: clock.now });
    const items = [
      createTestMemoryItem({
        content: '  Hello   World  \r\n  ',
        tokenCount: 10,
        createdAt: clock.now()
      })
    ];
    const result = compressor.compress(items, 100);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]?.content).toBe('Hello   World');
  });
});
