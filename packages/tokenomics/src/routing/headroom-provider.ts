/**
 * Gateway-facing headroom provider. Abstracts the tokenomics
 * internals behind a simple API that the gateway's
 * replica selector calls during routing decisions.
 */

import type { ReplicaHeadroomSnapshot } from '../quotas/headroom.js';
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
  if (snapshot === undefined) {
    return 0;
  }
  const budget = aggregator.getBudget(replicaId);
  if (budget === undefined) {
    return 0;
  }

  return (
    tryComputeHeadroom(snapshot.remainingTokensMinute, budget.maxTokensMinute) ??
    tryComputeHeadroom(snapshot.remainingRequestsMinute, budget.maxRequestsMinute) ??
    tryComputeHeadroom(snapshot.remainingCostMinute, budget.maxCostMinute) ??
    tryComputeHeadroom(snapshot.remainingTokensHour, budget.maxTokensHour) ??
    tryComputeHeadroom(snapshot.remainingTokensWeek, budget.maxTokensWeek) ??
    tryComputeHeadroom(snapshot.remainingTokensMonth, budget.maxTokensMonth) ??
    tryComputeHeadroom(snapshot.remainingCostHour, budget.maxCostHour) ??
    tryComputeHeadroom(snapshot.remainingCostWeek, budget.maxCostWeek) ??
    tryComputeHeadroom(snapshot.remainingCostMonth, budget.maxCostMonth) ??
    0
  );
}

/**
 * Compute headroom percentage when both remaining and max are defined,
 * otherwise return undefined to continue the fallback chain.
 */
function tryComputeHeadroom(remaining: number | undefined, max: number | undefined): number | undefined {
  if (remaining !== undefined && max !== undefined) {
    return computeHeadroomPercentage(remaining, max);
  }
}
