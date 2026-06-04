import { describe, expect, it } from 'vitest';

import { routeCompressionStrategy } from './content-router.js';

describe('content router', () => {
  it('routes diff-heavy content to anchored iterative', () => {
    const route = routeCompressionStrategy([
      { content: 'diff --git a/src/a.ts b/src/a.ts\n@@ -1 +1 @@\n-old\n+new' },
      { content: '+++ b/src/a.ts' }
    ]);

    expect(route.kind).toBe('diff');
    expect(route.strategy).toBe('anchored-iterative');
  });

  it('routes JSON-heavy content to layered pruning', () => {
    const route = routeCompressionStrategy([
      { content: '{"items": [{"id": 1}]}' },
      { content: '{"items": [{"id": 2}]}' }
    ]);

    expect(route.kind).toBe('json');
    expect(route.strategy).toBe('layered-pruning');
  });

  it('falls back to naive dropping for prose', () => {
    const route = routeCompressionStrategy([{ content: 'plain conversation text without strong structure' }]);

    expect(route.kind).toBe('prose');
    expect(route.strategy).toBe('naive-dropping');
  });
});
