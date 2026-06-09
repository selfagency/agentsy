import { describe, expect, it } from 'vitest';

import { BudgetEnforcer, BudgetExceededError, type TokenBudget } from './budget.js';

const defaultBudget: TokenBudget = {
  inputCap: 10_000,
  outputCap: 4000,
  contextCap: 16_000,
  perTurnCap: 12_000,
  perSessionCap: 100_000
};

describe('BudgetEnforcer', () => {
  describe('canAccommodate', () => {
    it('returns true when usage is below the cap', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      expect(enforcer.canAccommodate('input', 5000)).toBe(true);
    });

    it('returns true when usage exactly meets the cap', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('input', 5000);
      expect(enforcer.canAccommodate('input', 5000)).toBe(true);
    });

    it('returns false when usage exceeds the cap', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('input', 9000);
      expect(enforcer.canAccommodate('input', 2000)).toBe(false);
    });

    it('returns false for negative tokens', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      expect(enforcer.canAccommodate('input', -100)).toBe(false);
    });

    it('returns false for NaN tokens', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      expect(enforcer.canAccommodate('input', Number.NaN)).toBe(false);
    });

    it('returns true for uncapped categories (perTurnCap undefined)', () => {
      const budget: TokenBudget = { inputCap: 1000, outputCap: 1000, contextCap: 2000 };
      const enforcer = new BudgetEnforcer(budget);
      expect(enforcer.canAccommodate('turn', 999_999)).toBe(true);
    });

    it('returns true for uncapped session', () => {
      const budget: TokenBudget = { inputCap: 1000, outputCap: 1000, contextCap: 2000 };
      const enforcer = new BudgetEnforcer(budget);
      expect(enforcer.canAccommodate('session', 999_999)).toBe(true);
    });
  });

  describe('recordUsage', () => {
    it('records consumption and reduces remaining capacity', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('input', 3000);
      expect(enforcer.remaining('input')).toBe(7000);
    });

    it('throws BudgetExceededError when limit is surpassed', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      expect(() => enforcer.recordUsage('output', 5000)).toThrow(BudgetExceededError);
    });

    it('BudgetExceededError includes category and amounts', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('output', 3500);
      try {
        enforcer.recordUsage('output', 1000);
      } catch (error) {
        expect(error).toBeInstanceOf(BudgetExceededError);
        if (error instanceof BudgetExceededError) {
          expect(error.budgetCategory).toBe('output');
          expect(error.requested).toBe(1000);
          expect(error.available).toBe(500);
        }
      }
    });

    it('throws on negative token usage', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      expect(() => enforcer.recordUsage('input', -1)).toThrow('Cannot record negative token usage');
    });

    it('throws on NaN token usage', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      expect(() => enforcer.recordUsage('input', Number.NaN)).toThrow('Invalid token count');
    });

    it('allows uncapped categories to consume freely', () => {
      const budget: TokenBudget = { inputCap: 1000, outputCap: 1000, contextCap: 2000 };
      const enforcer = new BudgetEnforcer(budget);
      expect(() => enforcer.recordUsage('turn', 999_999)).not.toThrow();
    });

    it('accumulates across multiple recordUsage calls', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('context', 5000);
      enforcer.recordUsage('context', 5000);
      enforcer.recordUsage('context', 5000);
      expect(enforcer.remaining('context')).toBe(1000);
    });
  });

  describe('remaining', () => {
    it('returns the full cap when nothing has been consumed', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      expect(enforcer.remaining('input')).toBe(10_000);
    });

    it('returns Infinity for uncapped categories', () => {
      const budget: TokenBudget = { inputCap: 1000, outputCap: 1000, contextCap: 2000 };
      const enforcer = new BudgetEnforcer(budget);
      expect(enforcer.remaining('session')).toBe(Number.POSITIVE_INFINITY);
    });

    it('returns 0 when fully exhausted', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('input', 10_000);
      expect(enforcer.remaining('input')).toBe(0);
    });
  });

  describe('reset', () => {
    it('resets a specific category', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('input', 5000);
      enforcer.reset('input');
      expect(enforcer.remaining('input')).toBe(10_000);
    });

    it('resets all categories when called without argument', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('input', 3000);
      enforcer.recordUsage('output', 2000);
      enforcer.recordUsage('context', 5000);
      enforcer.reset();
      expect(enforcer.remaining('input')).toBe(10_000);
      expect(enforcer.remaining('output')).toBe(4000);
      expect(enforcer.remaining('context')).toBe(16_000);
    });

    it('clears accumulated warnings on full reset', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('output', 3500);
      expect(enforcer.warnings).toHaveLength(1);
      enforcer.reset();
      expect(enforcer.warnings).toHaveLength(0);
    });
  });

  describe('yellow warning at 80% output', () => {
    it('emits a warning when output crosses 80%', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('output', 3200);
      expect(enforcer.warnings).toHaveLength(1);
      expect(enforcer.warnings[0]?.category).toBe('output');
      expect(enforcer.warnings[0]?.percentage).toBeGreaterThanOrEqual(80);
    });

    it('does not emit a warning below 80%', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('output', 3000);
      expect(enforcer.warnings).toHaveLength(0);
    });

    it('emits warning exactly at 80%', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('output', 3200);
      expect(enforcer.warnings).toHaveLength(1);
    });

    it('does not emit warning for non-output categories', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('input', 9000);
      expect(enforcer.warnings).toHaveLength(0);
    });

    it('only triggers once per crossing (not on subsequent records above threshold)', () => {
      const enforcer = new BudgetEnforcer(defaultBudget);
      enforcer.recordUsage('output', 3200);
      enforcer.recordUsage('output', 500);
      expect(enforcer.warnings).toHaveLength(1);
    });
  });
});

describe('BudgetExceededError', () => {
  it('sets name correctly', () => {
    const error = new BudgetExceededError('output', 100, 50);
    expect(error.name).toBe('BudgetExceededError');
  });

  it('includes category, requested, and available', () => {
    const error = new BudgetExceededError('session', 200, 75);
    expect(error.budgetCategory).toBe('session');
    expect(error.requested).toBe(200);
    expect(error.available).toBe(75);
  });

  it('has a descriptive message', () => {
    const error = new BudgetExceededError('context', 300, 120);
    expect(error.message).toContain('context');
    expect(error.message).toContain('300');
    expect(error.message).toContain('120');
  });
});
