import { describe, expect, it } from 'vitest';

import type { TierName } from './tier-types.js';
import { createTokenBudget, type TokenBudget } from './token-budget.js';

function createDefaultBudget(): TokenBudget {
  return createTokenBudget({ budgets: {} });
}

describe('TokenBudget', () => {
  describe('allocate', () => {
    it('grants allocation when tokens fit within budget', () => {
      const budget = createDefaultBudget();
      const result = budget.allocate('sensory_buffer', 100);
      expect(result.granted).toBe(true);
      expect(result.tokens).toBe(100);
      expect(result.tier).toBe('sensory_buffer');
    });

    it('denies allocation when tokens exceed budget', () => {
      const budget = createDefaultBudget();
      const result = budget.allocate('sensory_buffer', 300);
      expect(result.granted).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('tracks cumulative usage', () => {
      const budget = createDefaultBudget();
      budget.allocate('sensory_buffer', 100);
      budget.allocate('sensory_buffer', 50);
      expect(budget.used('sensory_buffer')).toBe(150);
      expect(budget.available('sensory_buffer')).toBe(50);
    });

    it('denies allocation when cumulative usage would exceed max', () => {
      const budget = createDefaultBudget();
      budget.allocate('sensory_buffer', 150);
      const result = budget.allocate('sensory_buffer', 100);
      expect(result.granted).toBe(false);
    });
  });

  describe('release', () => {
    it('releases tokens and makes them available again', () => {
      const budget = createDefaultBudget();
      budget.allocate('sensory_buffer', 150);
      budget.release('sensory_buffer', 100);
      expect(budget.used('sensory_buffer')).toBe(50);
      expect(budget.available('sensory_buffer')).toBe(150);
    });

    it('does not go below zero on over-release', () => {
      const budget = createDefaultBudget();
      budget.allocate('sensory_buffer', 50);
      budget.release('sensory_buffer', 100);
      expect(budget.used('sensory_buffer')).toBe(0);
    });
  });

  describe('available', () => {
    it('returns full budget when nothing allocated', () => {
      const budget = createDefaultBudget();
      expect(budget.available('sensory_buffer')).toBe(200);
      expect(budget.available('long_term_memory')).toBe(10_000);
    });
  });

  describe('max', () => {
    it('returns default max for each tier', () => {
      const budget = createDefaultBudget();
      expect(budget.max('sensory_buffer')).toBe(200);
      expect(budget.max('sensory_register')).toBe(400);
      expect(budget.max('working_memory')).toBe(1000);
      expect(budget.max('short_term_memory')).toBe(2000);
      expect(budget.max('long_term_memory')).toBe(10_000);
    });

    it('respects custom budget overrides', () => {
      const budget = createTokenBudget({
        budgets: { sensory_buffer: 500, working_memory: 2000 }
      });
      expect(budget.max('sensory_buffer')).toBe(500);
      expect(budget.max('working_memory')).toBe(2000);
      expect(budget.max('sensory_register')).toBe(400);
    });
  });

  describe('overprovisionFactor', () => {
    it('multiplies budgets by the factor', () => {
      const budget = createTokenBudget({
        budgets: {},
        overprovisionFactor: 2
      });
      expect(budget.max('sensory_buffer')).toBe(400);
      expect(budget.max('long_term_memory')).toBe(20_000);
    });
  });

  describe('setMax', () => {
    it('updates the max for a tier', () => {
      const budget = createDefaultBudget();
      budget.setMax('sensory_buffer', 500);
      expect(budget.max('sensory_buffer')).toBe(500);
    });

    it('clamps used to new max if used exceeds it', () => {
      const budget = createDefaultBudget();
      budget.allocate('sensory_buffer', 150);
      budget.setMax('sensory_buffer', 100);
      expect(budget.used('sensory_buffer')).toBe(100);
    });
  });

  describe('snapshot', () => {
    it('returns snapshot with correct totals', () => {
      const budget = createDefaultBudget();
      budget.allocate('sensory_buffer', 100);
      const snap = budget.snapshot();
      expect(snap.totalMax).toBe(200 + 400 + 1000 + 2000 + 10_000);
      expect(snap.totalUsed).toBe(100);
      expect(snap.utilizationRatio).toBeGreaterThan(0);
    });

    it('reports zero utilization when nothing allocated', () => {
      const budget = createDefaultBudget();
      const snap = budget.snapshot();
      expect(snap.totalUsed).toBe(0);
      expect(snap.utilizationRatio).toBe(0);
    });

    it('includes all five tiers', () => {
      const budget = createDefaultBudget();
      const snap = budget.snapshot();
      const tierNames: TierName[] = [
        'sensory_buffer',
        'sensory_register',
        'working_memory',
        'short_term_memory',
        'long_term_memory'
      ];
      for (const name of tierNames) {
        expect(snap.tiers[name]).toBeDefined();
      }
    });
  });

  describe('reset', () => {
    it('resets all usage to zero', () => {
      const budget = createDefaultBudget();
      budget.allocate('sensory_buffer', 100);
      budget.allocate('working_memory', 500);
      budget.reset();
      expect(budget.used('sensory_buffer')).toBe(0);
      expect(budget.used('working_memory')).toBe(0);
    });
  });
});
