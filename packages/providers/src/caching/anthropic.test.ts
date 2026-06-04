import { describe, expect, it } from 'vitest';

import { createCachePromptPlan } from '../cache-prompt.js';
import { applyAnthropicPromptCaching } from './anthropic.js';

describe('anthropic prompt caching', () => {
  it('wraps a prompt with cache metadata', () => {
    const plan = createCachePromptPlan({ prefix: 'ctx-v1', provider: 'anthropic' });
    const cached = applyAnthropicPromptCaching('prompt body', plan);

    expect(cached.cacheConfig.prefix).toBe('ctx-v1');
    expect(cached.cacheConfig.cacheControl).toBe('ephemeral');
  });
});
