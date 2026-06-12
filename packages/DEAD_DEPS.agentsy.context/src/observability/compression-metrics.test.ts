import { describe, expect, it } from 'vitest';

import { createCompressionMetrics } from './compression-metrics.js';

describe('compression metrics', () => {
  it('summarizes records by strategy and content kind', () => {
    const metrics = createCompressionMetrics();

    metrics.record({
      contentKind: 'prose',
      inputTokens: 100,
      outputTokens: 50,
      qualityScore: 0.8,
      strategy: 'naive-dropping'
    });

    metrics.record({
      contentKind: 'code',
      inputTokens: 200,
      outputTokens: 120,
      qualityScore: 0.9,
      strategy: 'anchored-iterative'
    });

    const summary = metrics.summarize();

    expect(summary.totalRecords).toBe(2);
    expect(summary.byContentKind.prose.count).toBe(1);
    expect(summary.byStrategy['anchored-iterative']?.count).toBe(1);
  });
});
