import { describe, expect, it } from 'vitest';

import { createMemoryMetrics } from './metrics.js';

describe('MemoryMetrics', () => {
  it('tracks latency, retrieval quality, and injection budget impact', () => {
    const metrics = createMemoryMetrics();

    metrics.recordCoordinationLatency('pubsub.publish', 2.3);
    metrics.recordRetrieval('oauth', {
      hitCount: 3,
      latencyMs: 4.1,
      topScore: 0.92
    });
    metrics.recordInjection({ budgetTokens: 1000, usedTokens: 320 });

    const snapshot = metrics.snapshot();
    expect(snapshot.coordination['pubsub.publish']?.count).toBe(1);
    expect(snapshot.retrieval.queries).toBe(1);
    expect(snapshot.injection.usedTokens).toBe(320);
    expect(snapshot.injection.budgetRatio).toBeCloseTo(0.32, 3);
  });

  it('returns zeros for empty snapshot', () => {
    const metrics = createMemoryMetrics();
    const snapshot = metrics.snapshot();

    expect(snapshot.coordination).toStrictEqual({});
    expect(snapshot.retrieval.averageLatencyMs).toBe(0);
    expect(snapshot.retrieval.averageTopScore).toBe(0);
    expect(snapshot.retrieval.queries).toBe(0);
    expect(snapshot.injection.budgetRatio).toBe(0);
    expect(snapshot.injection.usedTokens).toBe(0);
    expect(snapshot.injection.budgetTokens).toBe(0);
  });

  it('caps topScore at 1.0', () => {
    const metrics = createMemoryMetrics();
    metrics.recordRetrieval('q', { hitCount: 1, latencyMs: 1, topScore: 1.5 });
    const snapshot = metrics.snapshot();
    expect(snapshot.retrieval.averageTopScore).toBe(1);
  });

  it('clamps negative values to 0', () => {
    const metrics = createMemoryMetrics();
    metrics.recordRetrieval('q', { hitCount: -5, latencyMs: -10 });
    metrics.recordInjection({ budgetTokens: 100, usedTokens: -50 });
    const snapshot = metrics.snapshot();
    expect(snapshot.retrieval.totalHits).toBe(0);
    expect(snapshot.retrieval.averageLatencyMs).toBe(0);
    expect(snapshot.injection.usedTokens).toBe(0);
    expect(snapshot.injection.budgetTokens).toBe(100);
  });

  it('records coordination latency without topScore', () => {
    const metrics = createMemoryMetrics();
    metrics.recordRetrieval('q', { hitCount: 2, latencyMs: 5 });
    const snapshot = metrics.snapshot();
    expect(snapshot.retrieval.averageTopScore).toBe(0);
    expect(snapshot.retrieval.averageLatencyMs).toBe(5);
  });
});
