/**
 * Gateway-facing headroom provider. Abstracts the tokenomics
 * internals behind a simple API that the gateway's
 * replica selector calls during routing decisions.
 */

import type { ReplicaBudget, ReplicaHeadroomSnapshot } from '../quotas/headroom.js';
import { computeHeadroomPercentage } from '../quotas/headroom.js';
import type { UsageAggregator } from '../quotas/usage-aggregator.js';

export interface ReplicaHeadroomProvider {
  /**
   * Returns a 0-100 headroom percentage for the given replica,
   * based on the most granular available budget dimension.
   */
  getHeadroomPercentage(replicaId: string): Promise<number>;
  getReplicaHeadroom(replicaId: string): Promise<ReplicaHeadroomSnapshot | undefined>;
}

export function createReplicaHeadroomProvider(aggregator: UsageAggregator): ReplicaHeadroomProvider {
  return {
    getReplicaHeadroom(replicaId) {
      return Promise.resolve(aggregator.getHeadroomSnapshot(replicaId));
    },

    getHeadroomPercentage(replicaId) {
      return Promise.resolve(computeHeadroomFromAggregator(aggregator, replicaId));
    }
  };
}

/**
 * Walk remaining/max pairs from most granular to least and return
 * the first computed headroom percentage, or 0 if none are configured.
 */
function computeHeadroomFromAggregator(aggregator: UsageAggregator, replicaId: string): number {
  const snapshot = aggregator.getHeadroomSnapshot(replicaId);
  const budget = aggregator.getBudget(replicaId);
  if (snapshot === undefined || budget === undefined) {
    return 0;
  }
  return firstMatchingHeadroom(snapshot, budget) ?? 0;
}

/**
 * Iterate granularity-ordered remaining/max pairs and return the first
 * headroom percentage where both values are defined.
 *
 * Extracted to keep cyclomatic complexity of callers under the CRAP
 * threshold (≤5) instead of inlining 9 `??` fallback operators.
 */
export function firstMatchingHeadroom(snapshot: ReplicaHeadroomSnapshot, budget: ReplicaBudget): number | undefined {
  const remaining: (number | undefined)[] = [
    snapshot.remainingTokensMinute,
    snapshot.remainingRequestsMinute,
    snapshot.remainingCostMinute,
    snapshot.remainingTokensHour,
    snapshot.remainingTokensWeek,
    snapshot.remainingTokensMonth,
    snapshot.remainingCostHour,
    snapshot.remainingCostWeek,
    snapshot.remainingCostMonth
  ];
  const max: (number | undefined)[] = [
    budget.maxTokensMinute,
    budget.maxRequestsMinute,
    budget.maxCostMinute,
    budget.maxTokensHour,
    budget.maxTokensWeek,
    budget.maxTokensMonth,
    budget.maxCostHour,
    budget.maxCostWeek,
    budget.maxCostMonth
  ];
  for (let i = 0; i < remaining.length; i++) {
    const r = remaining[i];
    const m = max[i];
    if (r !== undefined && m !== undefined) {
      return computeHeadroomPercentage(r, m);
    }
  }
}
