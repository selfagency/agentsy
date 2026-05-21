import { createMemoryTier, type MemoryTierLike, type MemoryTierOptions } from './memory-tier.js';
import type { TierConfig } from './tier-types.js';

export type { MemoryTierLike, MemoryTierOptions } from './memory-tier.js';
export type { TierConfig } from './tier-types.js';

const SENSORY_REGISTER_DEFAULTS: Omit<TierConfig, 'level' | 'name'> = {
  compressionTarget: 0.4,
  consolidationThreshold: 0.5,
  maxItems: 4,
  maxTokens: 400,
  ttlMs: 2_000
};

export interface SensoryRegisterOptions extends Pick<MemoryTierOptions, 'now' | 'db'> {
  config?: Partial<Omit<TierConfig, 'level' | 'name'>> | undefined;
}

export function createSensoryRegister(options: SensoryRegisterOptions = {}): MemoryTierLike {
  const config: TierConfig = {
    ...SENSORY_REGISTER_DEFAULTS,
    ...options.config,
    level: 2,
    name: 'sensory_register'
  };

  return createMemoryTier({ config, now: options.now, db: options.db });
}
