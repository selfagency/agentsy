import { describe, expect, it } from 'vitest';

import { createPrecompressionPlan } from './precompression.js';

describe('precompression plan', () => {
  it('creates a compaction plan for PreCompact events', () => {
    const plan = createPrecompressionPlan({
      contextSize: 12,
      sessionId: 'sess_123',
      type: 'PreCompact'
    });

    expect(plan?.context.sessionId).toBe('sess_123');
    expect(plan?.markers[0]?.type).toBe('rehydrate');
  });
});
