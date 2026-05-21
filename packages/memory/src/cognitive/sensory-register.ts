import { createMemoryTier, type MemoryTierLike } from './memory-tier.js';
import type { TierConfig, TierLevel, TierName } from './tier-types.js';

export type { MemoryTierLike, MemoryTierOptions } from './memory-tier.js';
export type { TierConfig } from './tier-types.js';

const SENSORY_REGISTER_DEFAULTS: Omit<TierConfig, 'level' | 'name'> = {
  compressionTarget: 0.4,
  consolidationThreshold: 0.5,
  maxItems: 4,
  maxTokens: 400,
  ttlMs: 2_000
};

export interface SensoryRegisterOptions {
  config?: Partial<Omit<TierConfig, 'level' | 'name'>> | undefined;
  now?: (() => number) | undefined;
}

export function createSensoryRegister(options: SensoryRegisterOptions = {}): MemoryTierLike {
  const config: TierConfig = {
    ...SENSORY_REGISTER_DEFAULTS,
    ...options.config,
    level: 2 as TierLevel,
    name: 'sensory_register' as TierName
  };

  return createMemoryTier({ config, now: options.now });
}
