import { describe, expect, it } from 'vitest';

import { CostEstimator, TIER_COST_MODELS, UnknownTierError } from './cost-estimator.js';

describe('TIER_COST_MODELS', () => {
  it('should have 4 entries: micro, small, mid, frontier', () => {
    expect(TIER_COST_MODELS).toHaveLength(4);
    const tiers = TIER_COST_MODELS.map(m => m.tier);
    expect(tiers).toContain('micro');
    expect(tiers).toContain('small');
    expect(tiers).toContain('mid');
    expect(tiers).toContain('frontier');
  });
});

describe('CostEstimator', () => {
  describe('estimateCost', () => {
    it('should return CostEstimateResult with correct tier mapping', () => {
      const estimator = new CostEstimator();
      const result = estimator.estimateCost({ tier: 'micro' });
      expect(result.tier).toBe('micro');
      expect(result.modelName).toBe('gemini-2.0-flash-lite');
      expect(result.estimatedCost).toBeGreaterThan(0);
    });

    it('should use default token estimates when not provided', () => {
      const estimator = new CostEstimator();
      const result = estimator.estimateCost({ tier: 'small' });
      // Default estimatedTokens = 1000
      expect(result.estimatedInputTokens).toBe(1000);
      expect(result.estimatedOutputTokens).toBeGreaterThan(0);
      expect(result.estimatedCost).toBeGreaterThan(0);
    });

    it('should use provided estimated tokens', () => {
      const estimator = new CostEstimator();
      const result = estimator.estimateCost({ tier: 'mid', estimatedTokens: 2000 });
      expect(result.estimatedInputTokens).toBe(2000);
    });

    it('should factor in complexity multiplier', () => {
      const estimator = new CostEstimator();
      const base = estimator.estimateCost({ tier: 'mid', estimatedTokens: 1000, complexity: 0 });
      const complex = estimator.estimateCost({ tier: 'mid', estimatedTokens: 1000, complexity: 1 });
      // More complex tasks should have higher output tokens and cost
      expect(complex.estimatedOutputTokens).toBeGreaterThan(base.estimatedOutputTokens);
      expect(complex.estimatedCost).toBeGreaterThan(base.estimatedCost);
    });

    it('should default tier to "micro" when not provided', () => {
      const estimator = new CostEstimator();
      const result = estimator.estimateCost();
      expect(result.tier).toBe('micro');
    });

    it('should throw UnknownTierError for unknown tier', () => {
      const estimator = new CostEstimator();
      expect(() => estimator.estimateCost({ tier: 'ultra' })).toThrow(UnknownTierError);
    });
  });
});
