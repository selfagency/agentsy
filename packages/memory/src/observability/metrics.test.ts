import { describe, expect, it } from 'vitest';

import { createMemoryMetrics } from './metrics.js';

describe('MemoryMetrics', () => {
  it('tracks latency, retrieval quality, and injection budget impact', () => {
    const metrics = createMemoryMetrics();

    metrics.recordCoordinationLatency('pubsub.publish', 2.3);
    metrics.recordRetrieval('oauth', { latencyMs: 4.1, hitCount: 3, topScore: 0.92 });
    metrics.recordInjection({ usedTokens: 320, budgetTokens: 1000 });

    const snapshot = metrics.snapshot();
    expect(snapshot.coordination['pubsub.publish']?.count).toBe(1);
    expect(snapshot.retrieval.queries).toBe(1);
    expect(snapshot.injection.usedTokens).toBe(320);
    expect(snapshot.injection.budgetRatio).toBeCloseTo(0.32, 3);
  });
});
