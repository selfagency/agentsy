import { describe, expect, it } from 'vitest';

import type { ReplicaAwareUsage, ReplicaBudget } from './headroom.js';
import { UsageAggregator } from './usage-aggregator.js';

const testBudget: ReplicaBudget = {
  replicaId: 'openai-main/gpt-4o-mini',
  logicalModelId: 'gpt-4o-mini',
  providerId: 'openai-main',
  maxTokensHour: 10_000,
  maxTokensMinute: 500,
  maxCostHour: 5,
  maxCostMinute: 0.5,
  maxRequestsMinute: 100
};

function makeUsage(overrides: Partial<ReplicaAwareUsage> & { tokensUsed: number; cost: number }): ReplicaAwareUsage {
  return {
    budgetId: 'test',
    model: 'gpt-4o-mini',
    provider: 'openai-main',
    requestType: 'completion',
    timestamp: new Date(),
    ...overrides
  };
}

describe('UsageAggregator', () => {
  it('records usage and reports headroom snapshot', () => {
    const agg = new UsageAggregator();
    agg.addBudget(testBudget);

    agg.recordUsage(
      makeUsage({
        replicaId: 'openai-main/gpt-4o-mini',
        tokensUsed: 100,
        cost: 0.1
      })
    );

    const snapshot = agg.getHeadroomSnapshot('openai-main/gpt-4o-mini');
    expect(snapshot).toBeDefined();
    expect(snapshot!.replicaId).toBe('openai-main/gpt-4o-mini');
    expect(snapshot!.logicalModelId).toBe('gpt-4o-mini');
    expect(snapshot!.confidence).toBe('tokenomics-derived');
  });

  it('subtracts used tokens from budget', () => {
    const agg = new UsageAggregator();
    agg.addBudget({ ...testBudget, maxTokensMinute: 500 });

    agg.recordUsage(
      makeUsage({
        replicaId: 'openai-main/gpt-4o-mini',
        tokensUsed: 100,
        cost: 0.1,
        timestamp: new Date()
      })
    );

    const snapshot = agg.getHeadroomSnapshot('openai-main/gpt-4o-mini');
    expect(snapshot!.remainingTokensMinute).toBe(400);
  });

  it('returns undefined when no budget is configured', () => {
    const agg = new UsageAggregator();
    expect(agg.getHeadroomSnapshot('no-budget')).toBeUndefined();
  });

  it('returns budget via getBudget', () => {
    const agg = new UsageAggregator();
    agg.addBudget(testBudget);
    expect(agg.getBudget('openai-main/gpt-4o-mini')).toBe(testBudget);
  });

  it('handles multiple replica budgets independently', () => {
    const agg = new UsageAggregator();
    agg.addBudget(testBudget);
    agg.addBudget({
      ...testBudget,
      replicaId: 'anthropic-main/claude-3-5-sonnet',
      maxTokensMinute: 1000
    });

    agg.recordUsage(
      makeUsage({
        replicaId: 'openai-main/gpt-4o-mini',
        tokensUsed: 200,
        cost: 0.2
      })
    );

    expect(agg.getHeadroomSnapshot('openai-main/gpt-4o-mini')!.remainingTokensMinute).toBe(300);
    expect(agg.getHeadroomSnapshot('anthropic-main/claude-3-5-sonnet')!.remainingTokensMinute).toBe(1000);
  });

  it('computes remaining cost from budget', () => {
    const agg = new UsageAggregator();
    agg.addBudget({
      ...testBudget,
      replicaId: 'cost-test',
      maxCostHour: 1,
      maxCostMinute: 0.5
    });

    agg.recordUsage(
      makeUsage({
        replicaId: 'cost-test',
        tokensUsed: 50,
        cost: 0.1
      })
    );

    const snapshot = agg.getHeadroomSnapshot('cost-test');
    expect(snapshot!.remainingCostHour).toBeCloseTo(0.9);
    expect(snapshot!.remainingCostMinute).toBeCloseTo(0.4);
  });

  it('does not count usage outside the time window', () => {
    const agg = new UsageAggregator();
    agg.addBudget({ ...testBudget, maxTokensMinute: 500 });

    // Record usage from 2 minutes ago
    agg.recordUsage(
      makeUsage({
        replicaId: 'openai-main/gpt-4o-mini',
        tokensUsed: 500,
        cost: 0.5,
        timestamp: new Date(Date.now() - 120_000)
      })
    );

    // Minute window only covers last 60s, so this shouldn't be counted
    const snapshot = agg.getHeadroomSnapshot('openai-main/gpt-4o-mini');
    expect(snapshot!.remainingTokensMinute).toBe(500);
  });

  it('counts requests correctly', () => {
    const agg = new UsageAggregator();
    agg.addBudget({ ...testBudget, maxRequestsMinute: 10 });

    agg.recordUsage(makeUsage({ replicaId: 'openai-main/gpt-4o-mini', tokensUsed: 1, cost: 0 }));
    agg.recordUsage(makeUsage({ replicaId: 'openai-main/gpt-4o-mini', tokensUsed: 1, cost: 0 }));
    agg.recordUsage(makeUsage({ replicaId: 'openai-main/gpt-4o-mini', tokensUsed: 1, cost: 0 }));

    const snapshot = agg.getHeadroomSnapshot('openai-main/gpt-4o-mini');
    expect(snapshot!.remainingRequestsMinute).toBe(7);
  });
});
