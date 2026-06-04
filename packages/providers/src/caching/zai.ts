import type { CachePromptPlan } from '../cache-prompt.js';

export interface ZaiPromptCaching {
  cache: {
    key: string;
    mode: 'ephemeral' | 'persistent';
  };
  prompt: string;
}

export function applyZaiPromptCaching(prompt: string, plan: CachePromptPlan): ZaiPromptCaching {
  return {
    cache: {
      key: plan.cacheKey,
      mode: 'ephemeral'
    },
    prompt
  };
}
