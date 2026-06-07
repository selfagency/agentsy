import { describe, expect, it } from 'vitest';
import type { ReplicaAwareUsage } from '../quotas/headroom.js';
import { UsageAggregator } from '../quotas/usage-aggregator.js';
import { buildRoutingReport } from './routing-report.js';

const testUsage = (overrides: Partial<ReplicaAwareUsage> = {}): ReplicaAwareUsage => ({
  budgetId: 'b1',
  tokensUsed: 0,
  cost: 0.01,
  model: 'model-a',
  provider: 'p1',
  requestType: 'completion',
  timestamp: new Date(),
  ...overrides
});

describe('buildRoutingReport', () => {
  it('returns zero-entry report when no budgets exist', () => {
    const agg = new UsageAggregator();
    const report = buildRoutingReport(agg);

    expect(report.replicaCount).toBe(0);
    expect(report.entries).toEqual([]);
    expect(report.coldReplicaIds).toEqual([]);
    expect(report.hotReplicaIds).toEqual([]);
    expect(report.generatedAt).toBeTruthy();
  });

  it('includes headroom percentage for each budgeted replica', () => {
    const agg = new UsageAggregator();
    agg.addBudget({
      replicaId: 'r1',
      logicalModelId: 'model-a',
      providerId: 'p1',
      maxTokensMinute: 100_000,
      maxTokensHour: 1_000_000
    });
    agg.addBudget({
      replicaId: 'r2',
      logicalModelId: 'model-a',
      providerId: 'p2',
      maxTokensMinute: 100_000,
      maxTokensHour: 1_000_000
    });

    agg.recordUsage(testUsage({ replicaId: 'r1', tokensUsed: 80_000, logicalModelId: 'model-a' }));

    const report = buildRoutingReport(agg);

    expect(report.replicaCount).toBe(2);
    expect(report.entries).toHaveLength(2);

    const r1 = report.entries.find(e => e.replicaId === 'r1');
    expect(r1).toBeDefined();
    expect(r1?.headroomPercentage).toBe(20);
    expect(r1?.logicalModelId).toBe('model-a');
    expect(r1?.confidence).toBe('tokenomics-derived');

    const r2 = report.entries.find(e => e.replicaId === 'r2');
    expect(r2).toBeDefined();
    expect(r2?.headroomPercentage).toBe(100);
  });

  it('flags cold and hot replicas from skew signals', () => {
    const agg = new UsageAggregator();
    for (let i = 1; i <= 3; i++) {
      agg.addBudget({
        replicaId: `r${i}`,
        logicalModelId: 'model-b',
        providerId: `p${i}`,
        maxTokensMinute: 100_000
      });
    }

    agg.recordUsage(testUsage({ replicaId: 'r1', tokensUsed: 95_000, logicalModelId: 'model-b' }));
    agg.recordUsage(testUsage({ replicaId: 'r2', tokensUsed: 50_000, logicalModelId: 'model-b' }));
    agg.recordUsage(testUsage({ replicaId: 'r3', tokensUsed: 0, logicalModelId: 'model-b' }));

    const report = buildRoutingReport(agg);

    expect(report.coldReplicaIds).toContain('r1');
    expect(report.hotReplicaIds).toContain('r3');
    expect(report.coldReplicaIds).not.toContain('r2');
    expect(report.hotReplicaIds).not.toContain('r2');
  });

  it('sorts entries by headroom ascending', () => {
    const agg = new UsageAggregator();
    agg.addBudget({ replicaId: 'a', logicalModelId: 'm', providerId: 'p', maxTokensMinute: 100 });
    agg.addBudget({ replicaId: 'b', logicalModelId: 'm', providerId: 'p', maxTokensMinute: 100 });
    agg.addBudget({ replicaId: 'c', logicalModelId: 'm', providerId: 'p', maxTokensMinute: 100 });

    agg.recordUsage(testUsage({ replicaId: 'a', tokensUsed: 80, logicalModelId: 'm' }));
    agg.recordUsage(testUsage({ replicaId: 'b', tokensUsed: 10, logicalModelId: 'm' }));
    agg.recordUsage(testUsage({ replicaId: 'c', tokensUsed: 50, logicalModelId: 'm' }));

    const report = buildRoutingReport(agg);

    expect(report.entries.map(e => e.replicaId)).toEqual(['a', 'c', 'b']);
  });
});
