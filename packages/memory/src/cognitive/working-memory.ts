import { createMemoryTier, type MemoryTierLike, type MemoryTierOptions } from './memory-tier.js';
import type { TierConfig } from './tier-types.js';

export type { MemoryTierLike, MemoryTierOptions } from './memory-tier.js';
export type { TierConfig } from './tier-types.js';

const WORKING_MEMORY_DEFAULTS: Omit<TierConfig, 'level' | 'name'> = {
  compressionTarget: 0.5,
  consolidationThreshold: 0.4,
  maxItems: 7,
  maxTokens: 1_000,
  ttlMs: 30_000
};

export interface WorkingMemoryOptions extends Pick<MemoryTierOptions, 'now' | 'db' | 'useAgentFs'> {
  config?: Partial<Omit<TierConfig, 'level' | 'name'>> | undefined;
}

export function createWorkingMemory(options: WorkingMemoryOptions = {}): MemoryTierLike {
  const config: TierConfig = {
    ...WORKING_MEMORY_DEFAULTS,
    ...options.config,
    level: 3,
    name: 'working_memory'
  };

  return createMemoryTier({ config, now: options.now, db: options.db, useAgentFs: options.useAgentFs });
}
