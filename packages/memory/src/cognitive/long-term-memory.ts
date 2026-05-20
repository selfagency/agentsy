import { createMemoryTier, type MemoryTierLike, type MemoryTierOptions } from './memory-tier.js';
import type { TierConfig, TierLevel, TierName } from './tier-types.js';

export type { MemoryTierLike, MemoryTierOptions, TierConfig };

const LONG_TERM_MEMORY_DEFAULTS: Omit<TierConfig, 'level' | 'name'> = {
  compressionTarget: 0,
  consolidationThreshold: 0,
  maxItems: Infinity,
  maxTokens: Infinity,
  ttlMs: Infinity
};

export interface LongTermMemoryOptions {
  config?: Partial<Omit<TierConfig, 'level' | 'name'>> | undefined;
  now?: (() => number) | undefined;
}

export function createLongTermMemory(options: LongTermMemoryOptions = {}): MemoryTierLike {
  const config: TierConfig = {
    ...LONG_TERM_MEMORY_DEFAULTS,
    ...options.config,
    level: 5 as TierLevel,
    name: 'long_term_memory' as TierName
  };

  return createMemoryTier({ config, now: options.now });
}
