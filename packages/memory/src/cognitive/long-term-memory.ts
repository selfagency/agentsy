import { createMemoryTier, type MemoryTierLike } from './memory-tier.js';
import type { TierConfig } from './tier-types.js';

export type { MemoryTierLike, MemoryTierOptions } from './memory-tier.js';
export type { TierConfig } from './tier-types.js';

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
    level: 5,
    name: 'long_term_memory'
  };

  return createMemoryTier({ config, now: options.now });
}
