export interface CachePromptPlan {
  cacheKey: string;
  prefix: string;
  provider: 'anthropic' | 'openai' | 'zai' | 'generic';
}

export interface CachePromptInput {
  prefix: string;
  provider?: CachePromptPlan['provider'];
}

function normalizePrefix(prefix: string): string {
  return prefix.trim().replaceAll(/\s+/gu, ' ');
}

export function createCachePromptPlan(input: CachePromptInput): CachePromptPlan {
  const prefix = normalizePrefix(input.prefix);

  return {
    cacheKey: `${input.provider ?? 'generic'}:${prefix}`,
    prefix,
    provider: input.provider ?? 'generic'
  };
}
