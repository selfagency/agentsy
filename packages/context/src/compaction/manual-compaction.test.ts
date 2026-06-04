import { describe, expect, it } from 'vitest';

import { createManualCompaction } from './manual-compaction.js';

describe('manual compaction', () => {
  it('produces a focus-aware summary schema', () => {
    const result = createManualCompaction({
      focus: 'architecture',
      maxTokens: 20,
      messages: ['diff --git a/a b/a', 'plain prose'],
      sessionId: 'sess-1'
    });

    expect(result.summary.focus).toBe('architecture');
    expect(result.summary.sessionId).toBe('sess-1');
    expect(result.summary.nextSteps[0]).toBe('rehydrate:architecture');
  });
});
