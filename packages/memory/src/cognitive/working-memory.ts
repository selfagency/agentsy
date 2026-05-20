import { createMemoryTier, type MemoryTierLike, type MemoryTierOptions } from './memory-tier.js';
import type { TierConfig, TierLevel, TierName } from './tier-types.js';

export type { MemoryTierLike, MemoryTierOptions, TierConfig };

const WORKING_MEMORY_DEFAULTS: Omit<TierConfig, 'level' | 'name'> = {
  compressionTarget: 0.5,
  consolidationThreshold: 0.4,
  maxItems: 7,
  maxTokens: 1_000,
  ttlMs: 30_000
};

export interface WorkingMemoryOptions {
  config?: Partial<Omit<TierConfig, 'level' | 'name'>> | undefined;
  now?: (() => number) | undefined;
}

export function createWorkingMemory(options: WorkingMemoryOptions = {}): MemoryTierLike {
  const config: TierConfig = {
    ...WORKING_MEMORY_DEFAULTS,
    ...options.config,
    level: 3 as TierLevel,
    name: 'working_memory' as TierName
  };

  return createMemoryTier({ config, now: options.now });
}
