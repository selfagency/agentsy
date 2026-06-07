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
    expect(snapshot?.replicaId).toBe('test-replica');
    expect(snapshot?.remainingTokensMinute).toBe(1000);
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

describe('computeHeadroomFromAggregator fallback chain', () => {
  it('falls through minute-level granularity to hour-level when minute limits absent', async () => {
    const agg = new UsageAggregator();
    agg.addBudget({
      replicaId: 'hour-replica',
      logicalModelId: 'gpt-4o-mini',
      providerId: 'test',
      maxTokensHour: 2000
    });
    const provider = createReplicaHeadroomProvider(agg);
    // Skips: minute-tokens, requests, cost (all undefined/undefined)
    // Hits: tokensHour = 2000/2000
    expect(await provider.getHeadroomPercentage('hour-replica')).toBe(100);
  });

  it('computes from cost-week granularity when closer-level limits absent', async () => {
    const agg = new UsageAggregator();
    agg.addBudget({
      replicaId: 'cost-week',
      logicalModelId: 'gpt-4o-mini',
      providerId: 'test',
      maxCostWeek: 1000
    });
    agg.recordUsage({
      budgetId: 'test',
      model: 'gpt-4o-mini',
      provider: 'test',
      requestType: 'completion',
      timestamp: new Date(),
      tokensUsed: 100,
      cost: 300,
      replicaId: 'cost-week'
    });
    const provider = createReplicaHeadroomProvider(agg);
    // Walks through: minute-tokens → requests → cost-minute → hour-tokens →
    //   week-tokens → month-tokens → cost-hour → cost-week (700/1000)
    expect(await provider.getHeadroomPercentage('cost-week')).toBe(70);
  });

  it('falls through entire chain to 0 when no budget dimensions are configured', async () => {
    const agg = new UsageAggregator();
    agg.addBudget({
      replicaId: 'bare-replica',
      logicalModelId: 'gpt-4o-mini',
      providerId: 'test'
      // No max* limits — every tryComputeHeadroom returns undefined
    });
    const provider = createReplicaHeadroomProvider(agg);
    // All 9 tryComputeHeadroom calls return undefined → final ?? 0
    expect(await provider.getHeadroomPercentage('bare-replica')).toBe(0);
  });
});
