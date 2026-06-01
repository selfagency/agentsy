import { describe, expect, it } from 'vitest';

import {
  computeImportance,
  computeImportanceForItems,
  DEFAULT_IMPORTANCE_FACTORS,
  type ImportanceFactors
} from './importance.js';
import { createTestMemoryItem, resetTestItemIdCounter } from './testing.js';

describe('computeImportance', () => {
  it('returns a score between 0 and 1', () => {
    const item = createTestMemoryItem({ createdAt: 10_000 });
    const score = computeImportance(item, DEFAULT_IMPORTANCE_FACTORS, 10_000);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('gives higher scores to recent items', () => {
    const recentItem = createTestMemoryItem({ createdAt: 10_000 });
    const oldItem = createTestMemoryItem({ createdAt: 0 });
    const recentScore = computeImportance(recentItem, DEFAULT_IMPORTANCE_FACTORS, 10_000);
    const oldScore = computeImportance(oldItem, DEFAULT_IMPORTANCE_FACTORS, 10_000);
    expect(recentScore).toBeGreaterThan(oldScore);
  });

  it('gives higher scores to frequently accessed items', () => {
    const frequentItem = createTestMemoryItem({ accessCount: 10, createdAt: 10_000 });
    const rareItem = createTestMemoryItem({ accessCount: 0, createdAt: 10_000 });
    const frequentScore = computeImportance(frequentItem, DEFAULT_IMPORTANCE_FACTORS, 10_000);
    const rareScore = computeImportance(rareItem, DEFAULT_IMPORTANCE_FACTORS, 10_000);
    expect(frequentScore).toBeGreaterThan(rareScore);
  });

  it('gives higher scores to doc write-heap items over ref', () => {
    const docItem = createTestMemoryItem({ writeHeap: 'doc', createdAt: 10_000 });
    const refItem = createTestMemoryItem({ writeHeap: 'ref', createdAt: 10_000 });
    const docScore = computeImportance(docItem, DEFAULT_IMPORTANCE_FACTORS, 10_000);
    const refScore = computeImportance(refItem, DEFAULT_IMPORTANCE_FACTORS, 10_000);
    expect(docScore).toBeGreaterThan(refScore);
  });

  it('applies custom factors', () => {
    const item = createTestMemoryItem({ accessCount: 5, createdAt: 10_000 });
    const defaultScore = computeImportance(item, DEFAULT_IMPORTANCE_FACTORS, 10_000);
    const customFactors: ImportanceFactors = {
      ...DEFAULT_IMPORTANCE_FACTORS,
      frequencyWeight: 0.8,
      recencyWeight: 0.1
    };
    const customScore = computeImportance(item, customFactors, 10_000);
    // With higher frequency weight and same accessCount, custom should be different
    expect(customScore).not.toBe(defaultScore);
  });

  it('uses performance.now when now is not provided', () => {
    const item = createTestMemoryItem({ createdAt: performance.now() });
    const score = computeImportance(item, DEFAULT_IMPORTANCE_FACTORS);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('computeImportanceForItems', () => {
  it('computes scores for multiple items', () => {
    resetTestItemIdCounter();
    const items = [createTestMemoryItem({ createdAt: 10_000 }), createTestMemoryItem({ createdAt: 0 })];
    const scores = computeImportanceForItems(items, DEFAULT_IMPORTANCE_FACTORS, 10_000);
    expect(scores.size).toBe(2);
    for (const score of scores.values()) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
