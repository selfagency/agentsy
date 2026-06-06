import { describe, expect, it } from 'vitest';

import { UsageAggregator } from '../quotas/usage-aggregator.js';
import { createReplicaHeadroomProvider } from './headroom-provider.js';

describe('createReplicaHeadroomProvider', () => {
  it('returns headroom snapshot from aggregator', async () => {
    const agg = new UsageAggregator();
    agg.addBudget({
      replicaId: 'test-replica',
      logicalModelId: 'gpt-4o-mini',
      providerId: 'test-provider',
      maxTokensMinute: 1000
    });

    const provider = createReplicaHeadroomProvider(agg);
    const snapshot = await provider.getReplicaHeadroom('test-replica');

    expect(snapshot).toBeDefined();
    expect(snapshot!.replicaId).toBe('test-replica');
    expect(snapshot!.remainingTokensMinute).toBe(1000);
  });

  it('returns undefined for unknown replica', async () => {
    const agg = new UsageAggregator();
    const provider = createReplicaHeadroomProvider(agg);
    const snapshot = await provider.getReplicaHeadroom('nope');
    expect(snapshot).toBeUndefined();
  });

  it('returns 0 headroom percentage when no budget exists', async () => {
    const agg = new UsageAggregator();
    const provider = createReplicaHeadroomProvider(agg);
    expect(await provider.getHeadroomPercentage('nope')).toBe(0);
  });

  it('returns 100 headroom percentage when fully remaining', async () => {
    const agg = new UsageAggregator();
    agg.addBudget({
      replicaId: 'full-replica',
      logicalModelId: 'gpt-4o-mini',
      providerId: 'test',
      maxTokensMinute: 1000
    });

    const provider = createReplicaHeadroomProvider(agg);
    expect(await provider.getHeadroomPercentage('full-replica')).toBe(100);
  });

  it('returns correct percentage after usage', async () => {
    const agg = new UsageAggregator();
    agg.addBudget({
      replicaId: 'used-replica',
      logicalModelId: 'gpt-4o-mini',
      providerId: 'test',
      maxTokensMinute: 1000
    });

    agg.recordUsage({
      budgetId: 'test',
      model: 'gpt-4o-mini',
      provider: 'test',
      requestType: 'completion',
      timestamp: new Date(),
      tokensUsed: 300,
      cost: 0.3,
      replicaId: 'used-replica'
    });

    const provider = createReplicaHeadroomProvider(agg);
    expect(await provider.getHeadroomPercentage('used-replica')).toBe(70);
  });
});
