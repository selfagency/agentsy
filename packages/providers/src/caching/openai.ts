import type { CachePromptPlan } from '../cache-prompt.js';

export interface OpenAIPromptCaching {
  cache_control?: { type: 'ephemeral' | 'persistent' };
  prompt: string;
  prompt_cache_key: string;
}

export function applyOpenAIPromptCaching(prompt: string, plan: CachePromptPlan): OpenAIPromptCaching {
  return {
    cache_control: { type: 'ephemeral' },
    prompt,
    prompt_cache_key: plan.cacheKey
  };
}
