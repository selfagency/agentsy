import type { TierName } from './tier-types.js';

export interface TierBudget {
  allocated: number;
  max: number;
  tier: TierName;
  used: number;
}

export interface TokenBudgetAllocation {
  granted: boolean;
  reason?: string;
  tier: TierName;
  tokens: number;
}

export interface TokenBudgetSnapshot {
  tiers: Record<TierName, TierBudget>;
  totalAllocated: number;
  totalMax: number;
  totalUsed: number;
  utilizationRatio: number;
}

export interface TokenBudgetOptions {
  budgets: Partial<Record<TierName, number>>;
  now?: (() => number) | undefined;
  overprovisionFactor?: number;
}

const DEFAULT_TIER_BUDGETS: Record<TierName, number> = {
  sensory_buffer: 200,
  sensory_register: 400,
  working_memory: 1000,
  short_term_memory: 2000,
  long_term_memory: 10_000
};

export interface TokenBudget {
  allocate(tier: TierName, tokens: number): TokenBudgetAllocation;
  available(tier: TierName): number;
  max(tier: TierName): number;
  release(tier: TierName, tokens: number): void;
  reset(): void;
  setMax(tier: TierName, newMax: number): void;
  snapshot(): TokenBudgetSnapshot;
  used(tier: TierName): number;
}

export function createTokenBudget(options: TokenBudgetOptions): TokenBudget {
  const overprovision = options.overprovisionFactor ?? 1;
  const maxByTier = new Map<TierName, number>();
  const usedByTier = new Map<TierName, number>();

  for (const [name, budget] of Object.entries(DEFAULT_TIER_BUDGETS) as [TierName, number][]) {
    const override = options.budgets[name];
    maxByTier.set(name, (override ?? budget) * overprovision);
    usedByTier.set(name, 0);
  }

  function getMax(tier: TierName): number {
    return maxByTier.get(tier) ?? 0;
  }

  function getUsed(tier: TierName): number {
    return usedByTier.get(tier) ?? 0;
  }

  return {
    allocate(tier: TierName, tokens: number): TokenBudgetAllocation {
      const currentUsed = getUsed(tier);
      const tierMax = getMax(tier);
      const availableTokens = tierMax - currentUsed;

      if (tokens <= availableTokens) {
        usedByTier.set(tier, currentUsed + tokens);
        return { tier, tokens, granted: true };
      }

      return {
        tier,
        tokens: 0,
        granted: false,
        reason: `Insufficient budget: need ${tokens}, available ${availableTokens} (max ${tierMax}, used ${currentUsed})`
      };
    },

    release(tier: TierName, tokens: number): void {
      const currentUsed = getUsed(tier);
      usedByTier.set(tier, Math.max(0, currentUsed - tokens));
    },

    available(tier: TierName): number {
      return getMax(tier) - getUsed(tier);
    },

    used(tier: TierName): number {
      return getUsed(tier);
    },

    max(tier: TierName): number {
      return getMax(tier);
    },

    snapshot(): TokenBudgetSnapshot {
      const tiers = {} as Record<TierName, TierBudget>;
      let totalAllocated = 0;
      let totalUsed = 0;
      let totalMax = 0;

      for (const name of Object.keys(DEFAULT_TIER_BUDGETS) as TierName[]) {
        const tierMax = getMax(name);
        const tierUsed = getUsed(name);
        tiers[name] = {
          tier: name,
          allocated: tierMax,
          used: tierUsed,
          max: tierMax
        };
        totalAllocated += tierMax;
        totalUsed += tierUsed;
        totalMax += tierMax;
      }

      const utilizationRatio = totalMax === 0 ? 0 : totalUsed / totalMax;

      return { tiers, totalAllocated, totalUsed, totalMax, utilizationRatio };
    },

    setMax(tier: TierName, newMax: number): void {
      maxByTier.set(tier, newMax);
      // If used exceeds new max, clamp used to new max
      const currentUsed = getUsed(tier);
      if (currentUsed > newMax) {
        usedByTier.set(tier, newMax);
      }
    },

    reset(): void {
      for (const name of Object.keys(DEFAULT_TIER_BUDGETS) as TierName[]) {
        usedByTier.set(name, 0);
      }
    }
  };
}
