import { describe, expect, it } from 'vitest';

import { createCachePromptPlan } from '../cache-prompt.js';
import { applyOpenAIPromptCaching } from './openai.js';

describe('openai prompt caching', () => {
  it('adapts cache plans to openai payloads', () => {
    const plan = createCachePromptPlan({ prefix: 'ctx-v2', provider: 'openai' });
    const cached = applyOpenAIPromptCaching('prompt body', plan);

    expect(cached.prompt_cache_key).toBe('openai:ctx-v2');
    expect(cached.cache_control?.type).toBe('ephemeral');
  });
});
