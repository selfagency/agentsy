import type { CachePromptPlan } from '../cache-prompt.js';

export interface AnthropicCacheConfig {
  cacheControl?: 'ephemeral' | 'persistent';
  prefix?: string;
}

export interface AnthropicCachePrompt {
  cacheConfig: AnthropicCacheConfig;
  prompt: string;
}

export function applyAnthropicPromptCaching(prompt: string, plan: CachePromptPlan): AnthropicCachePrompt {
  return {
    cacheConfig: {
      cacheControl: 'ephemeral',
      prefix: plan.prefix
    },
    prompt
  };
}
