import { createMemoryTier, type MemoryTierLike, type MemoryTierOptions } from './memory-tier.js';
import type { TierConfig } from './tier-types.js';

export type { MemoryTierLike, MemoryTierOptions } from './memory-tier.js';
export type { TierConfig } from './tier-types.js';

const SENSORY_BUFFER_DEFAULTS: Omit<TierConfig, 'level' | 'name'> = {
  compressionTarget: 0.3,
  consolidationThreshold: 0.6,
  maxItems: 50,
  maxTokens: 200,
  ttlMs: 5_000
};

export interface SensoryBufferOptions extends Pick<MemoryTierOptions, 'now' | 'db'> {
  config?: Partial<Omit<TierConfig, 'level' | 'name'>> | undefined;
}

export function createSensoryBuffer(options: SensoryBufferOptions = {}): MemoryTierLike {
  const config: TierConfig = {
    ...SENSORY_BUFFER_DEFAULTS,
    ...options.config,
    level: 1,
    name: 'sensory_buffer'
  };

  return createMemoryTier({ config, now: options.now, db: options.db });
}
