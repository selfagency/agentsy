import { describe, expect, it } from 'vitest';

import { CostEstimator } from './cost-estimator.js';
import { TIER_ORDER, TierRouter } from './tier-router.js';

describe('TIER_ORDER', () => {
  it('should order tiers from highest capability to lowest', () => {
    expect(TIER_ORDER).toEqual(['frontier', 'mid', 'small', 'micro']);
  });
});

describe('TierRouter', () => {
  describe('suggestEscalation', () => {
    it('should downgrade to cheaper tier when cost exceeds budget', () => {
      // mid tier with 1000 tokens ≈ $0.39
      const estimator = new CostEstimator();
      const router = new TierRouter(estimator, 0.3);

      const result = router.suggestEscalation({
        tier: 'mid',
        estimatedTokens: 1000
      });

      expect(result).not.toBeNull();
      expect(result!.newTier).toBe('small');
      expect(result!.reason).toBe('cost_exceeds_budget');
    });

    it('should return null when no cheaper tier fits within budget', () => {
      const estimator = new CostEstimator();
      // Even micro tier costs ~$0.225 with 1000 tokens
      const router = new TierRouter(estimator, 0.1);

      const result = router.suggestEscalation({
        tier: 'micro',
        estimatedTokens: 1000
      });

      // micro is the cheapest, and its cost exceeds budget
      expect(result).toBeNull();
    });

    it('should return null when cost is already within budget', () => {
      const estimator = new CostEstimator();
      // mid tier with 100 tokens ≈ $0.039, budget is $1
      const router = new TierRouter(estimator, 1.0);

      const result = router.suggestEscalation({
        tier: 'mid',
        estimatedTokens: 100
      });

      expect(result).toBeNull();
    });

    it('should return null for unknown tier', () => {
      const estimator = new CostEstimator();
      const router = new TierRouter(estimator, 0.1);

      const result = router.suggestEscalation({
        tier: 'unknown_tier',
        estimatedTokens: 1000
      });

      expect(result).toBeNull();
    });
  });

  describe('suggestUpgrade', () => {
    it('should upgrade when cost is under 30% of budget', () => {
      const estimator = new CostEstimator();
      // small tier with 1000 tokens ≈ $0.26
      // budget $1.00 → 30% = $0.30, $0.26 < $0.30 → upgrade
      const router = new TierRouter(estimator, 1.0);

      const result = router.suggestUpgrade({
        tier: 'small',
        estimatedTokens: 1000
      });

      expect(result).not.toBeNull();
      expect(result!.newTier).toBe('mid');
      expect(result!.reason).toBe('budget_available_for_upgrade');
    });

    it('should return null at the highest tier', () => {
      const estimator = new CostEstimator();
      const router = new TierRouter(estimator, 100.0);

      const result = router.suggestUpgrade({
        tier: 'frontier',
        estimatedTokens: 1000
      });

      expect(result).toBeNull();
    });

    it('should return null when budget headroom is insufficient', () => {
      const estimator = new CostEstimator();
      // small tier with 1000 tokens ≈ $0.26
      // budget $0.50 → 30% = $0.15, $0.26 > $0.15 → no upgrade
      const router = new TierRouter(estimator, 0.5);

      const result = router.suggestUpgrade({
        tier: 'small',
        estimatedTokens: 1000
      });

      expect(result).toBeNull();
    });
  });

  describe('checkAllFailures', () => {
    it('should fall back to micro tier', () => {
      const estimator = new CostEstimator();
      const router = new TierRouter(estimator, 0);

      const result = router.checkAllFailures();
      expect(result).toEqual({
        newTier: 'micro',
        reason: 'all_higher_tiers_failed'
      });
    });
  });
});
