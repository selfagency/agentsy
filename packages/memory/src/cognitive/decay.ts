import type { MemoryItem, TierName } from './tier-types.js';

export interface DecayConfig {
  sensoryBufferHalfLife: number;
  sensoryRegisterHalfLife: number;
  workingMemoryHalfLife: number;
  shortTermHalfLife: number;
  longTermHalfLife: number;
  minimumImportance: number;
}

export const DEFAULT_DECAY_CONFIG: DecayConfig = {
  sensoryBufferHalfLife: 2_500,
  sensoryRegisterHalfLife: 1_000,
  workingMemoryHalfLife: 15_000,
  shortTermHalfLife: 1_800_000,
  longTermHalfLife: Infinity,
  minimumImportance: 0.05
};

export interface DecayedItem {
  item: MemoryItem;
  newImportance: number;
  tier: TierName;
  action: 'keep' | 'promote' | 'demote' | 'discard';
}

const TIER_HALF_LIVES: Record<TierName, keyof DecayConfig> = {
  long_term_memory: 'longTermHalfLife',
  sensory_buffer: 'sensoryBufferHalfLife',
  sensory_register: 'sensoryRegisterHalfLife',
  short_term_memory: 'shortTermHalfLife',
  working_memory: 'workingMemoryHalfLife'
};

function getHalfLife(tier: TierName, config: DecayConfig): number {
  const key = TIER_HALF_LIVES[tier];
  return config[key] ?? Infinity;
}

export function applyDecay(
  items: readonly MemoryItem[],
  tier: TierName,
  now: number,
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): DecayedItem[] {
  const halfLife = getHalfLife(tier, config);

  return items.map(item => {
    if (halfLife === Infinity) {
      return {
        item,
        newImportance: item.importance,
        tier,
        action: 'keep' as const
      };
    }

    const age = Math.max(0, now - item.createdAt);
    const decayedImportance = item.importance * 0.5 ** (age / halfLife);
    const newImportance = Math.max(0, decayedImportance);

    let action: DecayedItem['action'];
    if (newImportance < config.minimumImportance) {
      action = 'discard';
    } else if (newImportance < item.importance * 0.5) {
      action = 'demote';
    } else {
      action = 'keep';
    }

    return { item, newImportance, tier, action };
  });
}

export function applyDecayToAllTiers(
  itemsByTier: ReadonlyMap<TierName, readonly MemoryItem[]>,
  now: number,
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): DecayedItem[] {
  const results: DecayedItem[] = [];

  for (const [tier, items] of itemsByTier) {
    const decayed = applyDecay(items, tier, now, config);
    results.push(...decayed);
  }

  return results;
}
