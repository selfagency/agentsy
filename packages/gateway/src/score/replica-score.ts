/**
 * Tunable replica scoring formula. Used by `ReplicaSelector` to
 * rank candidate `ModelReplica` entries.
 *
 * Score components (all optional weights default to 1.0):
 *   localBonus(tier)  — per-tier local preference (strongest for micro)
 *   - latencyPenalty   — linear penalty per ms of measured latency
 *   - errorPenalty     — fixed penalty when errorRate > threshold
 *   - costPenalty      — linear per-input-token-cost penalty
 *
 * Components are summed; higher score = better candidate.
 */

import type { ModelTier } from '../types.js';

export interface ReplicaScoreWeights {
  costWeight?: number;
  errorWeight?: number;
  latencyWeight?: number;
  localWeight?: number;
}

const DEFAULT_WEIGHTS: Required<ReplicaScoreWeights> = {
  costWeight: 1,
  errorWeight: 5,
  latencyWeight: 0.01,
  localWeight: 1
};

/**
 * Local preference by tier. These are the default values; callers
 * can override via `ReplicaScoreWeights` or by supplying a custom
 * `localBonusForTier` function.
 */
export const DEFAULT_LOCAL_BONUS: Record<ModelTier, number> = {
  micro: 100,
  small: 80,
  mid: 20,
  frontier: 0
};

export interface ReplicaScoreInput {
  /** Whether to apply local bonus. Default true. */
  applyLocalBonus?: boolean;
  /** Input token cost for the model. */
  costInputPer1MTokens: number;
  /** Error rate (0.0–1.0, 0 if unknown). */
  errorRate: number;
  /** Whether this replica is local. */
  isLocal: boolean;
  /** Measured latency in ms (0 if unknown). */
  latencyMs: number;
  /** Tier of the logical model being scored. */
  tier: ModelTier;
}

export function computeReplicaScore(input: ReplicaScoreInput, weights?: ReplicaScoreWeights): number {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  let score = 0;

  // Local bonus — tier is a typed enum parameter, not user input
  if (input.applyLocalBonus !== false && input.isLocal) {
    score += DEFAULT_LOCAL_BONUS[input.tier] * w.localWeight;
  }

  // Latency penalty (1ms = 0.01 * weight)
  score -= input.latencyMs * w.latencyWeight;

  // Error penalty (error rate > 0 counts)
  score -= input.errorRate * w.errorWeight;

  // Cost penalty ($1/1M tokens = 1.0 * weight)
  score -= input.costInputPer1MTokens * w.costWeight;

  return score;
}
