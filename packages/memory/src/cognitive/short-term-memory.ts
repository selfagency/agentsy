import { createMemoryTier, type MemoryTierLike } from './memory-tier.js';
import type { TierConfig } from './tier-types.js';

export type { MemoryTierLike, MemoryTierOptions } from './memory-tier.js';
export type { TierConfig } from './tier-types.js';

const SHORT_TERM_MEMORY_DEFAULTS: Omit<TierConfig, 'level' | 'name'> = {
  compressionTarget: 0.6,
  consolidationThreshold: 0.3,
  maxItems: 12,
  maxTokens: 2_000,
  ttlMs: 3_600_000
};

export interface ShortTermMemoryOptions {
  config?: Partial<Omit<TierConfig, 'level' | 'name'>> | undefined;
  now?: (() => number) | undefined;
}

export function createShortTermMemory(options: ShortTermMemoryOptions = {}): MemoryTierLike {
  const config: TierConfig = {
    ...SHORT_TERM_MEMORY_DEFAULTS,
    ...options.config,
    level: 4,
    name: 'short_term_memory'
  };

  return createMemoryTier({ config, now: options.now });
}
