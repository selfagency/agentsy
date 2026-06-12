import { describe, expect, it } from 'vitest';

import { compressOutputV2, createCompressionMetrics } from './index.js';

describe('compression metrics fixtures', () => {
  it('collects per-content-class records from v2 output', () => {
    const metrics = createCompressionMetrics();

    const samples = [
      'diff --git a/src/a.ts b/src/a.ts\n@@ -1 +1 @@\n-old\n+new',
      '{"items":[{"id":1}]}',
      'plain prose with no strong structure'
    ];

    for (const sample of samples) {
      const result = compressOutputV2(sample, { level: 'full' });
      metrics.record({
        contentKind: result.contentKind,
        inputTokens: result.originalTokens,
        outputTokens: result.compressedTokens,
        qualityScore: result.route.confidence,
        strategy: result.route.strategy
      });
    }

    const summary = metrics.summarize();

    expect(summary.totalRecords).toBe(3);
    expect(summary.byContentKind.diff.count).toBe(1);
    expect(summary.byContentKind.json.count).toBe(1);
    expect(summary.byContentKind.prose.count).toBe(1);
  });
});
