import { describe, expect, it } from 'vitest';

import { createCachePromptPlan } from './cache-prompt.js';

describe('cache prompt plan', () => {
  it('normalizes prefixes into stable cache keys', () => {
    const plan = createCachePromptPlan({
      prefix: '  ctx   v1  ',
      provider: 'openai'
    });

    expect(plan.prefix).toBe('ctx v1');
    expect(plan.cacheKey).toBe('openai:ctx v1');
  });
});
