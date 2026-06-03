import { describe, expect, it } from 'vitest';

import { createCachePromptPlan } from '../cache-prompt.js';
import { applyZaiPromptCaching } from './zai.js';

describe('zai prompt caching', () => {
  it('adapts cache plans to zai payloads', () => {
    const plan = createCachePromptPlan({ prefix: 'ctx-v2', provider: 'zai' });
    const cached = applyZaiPromptCaching('prompt body', plan);

    expect(cached.cache.key).toBe('zai:ctx-v2');
    expect(cached.cache.mode).toBe('ephemeral');
  });
});
