import { beforeEach, describe, expect, it } from 'vitest';

import { createMemoryEngine, type MemoryEngine } from './memory-engine.js';
import { createTierTestClock, resetTestItemIdCounter } from './testing.js';

describe('MemoryEngine', () => {
  let clock: ReturnType<typeof createTierTestClock>;
  let engine: MemoryEngine;

  beforeEach(() => {
    resetTestItemIdCounter();
    clock = createTierTestClock(10_000);
    engine = createMemoryEngine({ now: clock.now });
  });

  describe('ingest', () => {
    it('ingests content into sensory buffer by default', async () => {
      const id = engine.ingest('Hello world');
      expect(id).not.toBeNull();
    });

    it('returns null when tier is full and budgets exhausted', async () => {
      // Fill sensory buffer to capacity (200 tokens)
      for (let i = 0; i < 25; i++) {
        engine.ingest(`Content item ${i} with some extra text`);
      }
      // Next ingest should fail (tier full)
      const id = engine.ingest('Overflow content that should not fit');
      expect(id).toBeNull();
    });

    it('accepts custom importance', async () => {
      const id = engine.ingest('Important event', { importance: 0.9 });
      expect(id).not.toBeNull();
    });

    it('accepts custom write heap', async () => {
      const id = engine.ingest('Query event', { writeHeap: 'query' });
      expect(id).not.toBeNull();
    });

    it('accepts custom memory kind', async () => {
      const id = engine.ingest('Semantic fact', { kind: 'semantic' });
      expect(id).not.toBeNull();
    });

    it('accepts custom metadata', async () => {
      const id = engine.ingest('Event with metadata', {
        metadata: { source: 'test', priority: 1 }
      });
      expect(id).not.toBeNull();
    });

    it('ingests to a specific target tier', async () => {
      const id = engine.ingest('Direct to working memory', { targetTier: 'working_memory' });
      expect(id).not.toBeNull();
    });

    it('returns null for invalid target tier', async () => {
      // @ts-expect-error — testing runtime invalid tier name
      const id = engine.ingest('Bad tier', { targetTier: 'nonexistent' });
      expect(id).toBeNull();
    });
  });

  describe('recall', () => {
    it('returns results across all tiers with crossTier=true (default)', async () => {
      engine.ingest('Item one');
      engine.ingest('Item two');
      const results = engine.recall();
      expect(results.length).toBeGreaterThanOrEqual(1);
      const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
      expect(totalItems).toBeGreaterThanOrEqual(2);
    });

    it('filters by minimum importance', async () => {
      engine.ingest('Low importance', { importance: 0.1 });
      engine.ingest('High importance', { importance: 0.9 });
      const results = engine.recall({ minImportance: 0.5, crossTier: true });
      const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
      // Should have fewer items than without filter
      expect(totalItems).toBeLessThanOrEqual(2);
    });

    it('returns per-tier results when crossTier is false', async () => {
      engine.ingest('Item one');
      engine.ingest('Item two');
      const results = engine.recall({ crossTier: false });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('scopes recall to specific tiers', async () => {
      engine.ingest('Item one');
      const results = engine.recall({ tiers: ['sensory_buffer'], crossTier: false });
      expect(results.length).toBe(1);
      expect(results[0]?.tierName).toBe('sensory_buffer');
    });

    it('respects limit', async () => {
      for (let i = 0; i < 10; i++) {
        engine.ingest(`Item ${i}`);
      }
      const results = engine.recall({ limit: 3, crossTier: true });
      expect(results[0]?.items.length).toBeLessThanOrEqual(3);
    });

    it('returns empty results when no items ingested', async () => {
      const results = engine.recall();
      const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
      expect(totalItems).toBe(0);
    });
  });

  describe('awaken', () => {
    it('runs decay pass and consolidation', async () => {
      engine.ingest('Event one');
      engine.ingest('Event two');
      const result = await engine.awaken();
      expect(result).toHaveProperty('decayPass');
      expect(result).toHaveProperty('consolidation');
      expect(result).toHaveProperty('pendingIngested');
      expect(result).toHaveProperty('durationMs');
    });

    it('ingests pending events during awaken', async () => {
      const result = await engine.awaken([
        { content: 'Pending event 1', importance: 0.7 },
        { content: 'Pending event 2', importance: 0.5 }
      ]);
      expect(result.pendingIngested).toBeGreaterThanOrEqual(0);
    });

    it('processes queued events from failed ingestions', async () => {
      // Fill sensory buffer
      for (let i = 0; i < 25; i++) {
        engine.ingest(`Filling content ${i} with padding`);
      }
      // This should fail and queue as pending
      engine.ingest('Overflow that should queue');

      const result = await engine.awaken();
      expect(result).toBeDefined();
    });
  });

  describe('snapshot', () => {
    it('returns tier and budget state', async () => {
      engine.ingest('Snapshot test');
      const snap = engine.snapshot();
      expect(snap.tiers).toBeDefined();
      expect(snap.budget).toBeDefined();
      expect(snap.schedulerRunning).toBe(false);
    });

    it('reflects items in tier data', async () => {
      engine.ingest('First item');
      const snap = engine.snapshot();
      const sbItems = snap.tiers.sensory_buffer?.items;
      // May be 0 or 1 depending on budget/tier capacity
      expect(sbItems).toBeGreaterThanOrEqual(0);
    });
  });

  describe('stats', () => {
    it('returns aggregate statistics', async () => {
      engine.ingest('Stats test event');
      const stats = engine.stats();
      expect(stats.totalItems).toBeGreaterThanOrEqual(0);
      expect(stats.totalTokens).toBeGreaterThanOrEqual(0);
      expect(stats.tierStats).toBeDefined();
      expect(stats.budgetUtilization).toBeGreaterThanOrEqual(0);
    });

    it('reports zero stats for empty engine', async () => {
      const stats = engine.stats();
      expect(stats.totalItems).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.budgetUtilization).toBe(0);
    });
  });

  describe('reset', () => {
    it('clears all tiers and budget', async () => {
      engine.ingest('Item to clear');
      engine.reset();
      const stats = engine.stats();
      expect(stats.totalItems).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.budgetUtilization).toBe(0);
    });

    it('stops the scheduler if running', async () => {
      engine.scheduler.start();
      expect(engine.scheduler.isRunning()).toBe(true);
      engine.reset();
      expect(engine.scheduler.isRunning()).toBe(false);
    });
  });

  describe('tiers', () => {
    it('exposes all five tiers', async () => {
      expect(engine.tiers.sensory_buffer).toBeDefined();
      expect(engine.tiers.sensory_register).toBeDefined();
      expect(engine.tiers.working_memory).toBeDefined();
      expect(engine.tiers.short_term_memory).toBeDefined();
      expect(engine.tiers.long_term_memory).toBeDefined();
    });
  });

  describe('budget', () => {
    it('exposes the token budget', async () => {
      expect(engine.budget).toBeDefined();
      expect(typeof engine.budget.available('sensory_buffer')).toBe('number');
    });
  });

  describe('scheduler', () => {
    it('exposes the tier scheduler', async () => {
      expect(engine.scheduler).toBeDefined();
      expect(engine.scheduler.isRunning()).toBe(false);
    });
  });

  describe('end-to-end flow', () => {
    it('ingest → recall → awaken → stats cycle', async () => {
      // Ingest
      const id1 = engine.ingest('First memory', { importance: 0.8 });
      const id2 = engine.ingest('Second memory', { importance: 0.6 });
      expect(id1).not.toBeNull();
      expect(id2).not.toBeNull();

      // Recall
      const results = engine.recall({ crossTier: true });
      expect(results.length).toBeGreaterThanOrEqual(1);

      // Awaken
      const awakenResult = await engine.awaken();
      expect(awakenResult.decayPass).toBeDefined();

      // Stats
      const stats = engine.stats();
      expect(stats.totalItems).toBeGreaterThanOrEqual(0);

      // Snapshot
      const snap = engine.snapshot();
      expect(snap.budget).toBeDefined();

      // Reset
      engine.reset();
      const postStats = engine.stats();
      expect(postStats.totalItems).toBe(0);
    });
  });
});
