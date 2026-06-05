/**
 * ReplicaSelector — selects the best `ModelReplica` for a logical
 * model by scoring candidates and filtering by health/capability.
 *
 * The selector integrates with:
 *   - `ReplicaRegistry`   — look up replicas for a logical model
 *   - `computeReplicaScore` — rank candidates
 *   - `ModelAvailabilityTracker` — filter by health
 *   - `ReplicaHeadroomProvider` — (optional) filter by quota headroom
 */

import type { ReplicaScoreWeights } from './score/replica-score.js';
import { computeReplicaScore } from './score/replica-score.js';
import type { ModelReplica } from './types.js';

export interface ReplicaSelectionContext {
  /** Error rate per replica id, 0 if unknown. */
  errorRates: ReadonlyMap<string, number>;
  /** Measured latency per replica id, 0 if unknown. */
  latencies: ReadonlyMap<string, number>;
  /** True when local models should be preferred. */
  localPreference: 'preferred' | 'required' | 'disabled';
  /** Tier of the logical model. */
  tier: 'micro' | 'small' | 'mid' | 'frontier';
  /** Optional score weights override. */
  weights?: ReplicaScoreWeights;
}

export interface ReplicaSelector {
  /**
   * Score all replicas for a logical model and return the
   * best candidate, or `undefined` if none meet the constraints.
   */
  selectReplica(replicas: ModelReplica[], context: ReplicaSelectionContext): ModelReplica | undefined;
}

export class DefaultReplicaSelector implements ReplicaSelector {
  selectReplica(replicas: ModelReplica[], context: ReplicaSelectionContext): ModelReplica | undefined {
    let candidates = replicas;

    // Apply local preference
    if (context.localPreference === 'required') {
      const local = candidates.filter(r => r.isLocal);
      if (local.length === 0) {
        return;
      }
      candidates = local;
    } else if (context.localPreference === 'disabled') {
      candidates = candidates.filter(r => !r.isLocal);
      if (candidates.length === 0) {
        return;
      }
    }

    // Score remaining candidates
    const scored = candidates.map(replica => ({
      replica,
      score: computeReplicaScore(
        {
          costInputPer1MTokens: replica.cost.inputPer1MTokens,
          latencyMs: context.latencies.get(replica.id) ?? 0,
          errorRate: context.errorRates.get(replica.id) ?? 0,
          isLocal: replica.isLocal,
          tier: context.tier,
          applyLocalBonus: context.localPreference === 'preferred'
        },
        context.weights
      )
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.replica;
  }
}
