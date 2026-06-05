/**
 * Usage aggregator — sums token/cost usage per replica across
 * time windows (hour, week, month).
 *
 * Consumes `ReplicaAwareUsage` records and produces
 * `ReplicaHeadroomSnapshot` values by comparing recorded
 * usage against configured budgets.
 */

import type { ReplicaAwareUsage, ReplicaBudget, ReplicaHeadroomSnapshot } from './headroom.js';
import { HOUR_MS, MONTH_MS, WEEK_MS } from './headroom.js';

export class UsageAggregator {
  readonly #usages: ReplicaAwareUsage[] = [];
  readonly #budgets = new Map<string, ReplicaBudget>();

  addBudget(budget: ReplicaBudget): void {
    this.#budgets.set(budget.replicaId, budget);
  }

  recordUsage(usage: ReplicaAwareUsage): void {
    this.#usages.push(usage);
  }

  getHeadroomSnapshot(replicaId: string): ReplicaHeadroomSnapshot | undefined {
    const budget = this.#budgets.get(replicaId);
    if (budget === undefined) {
      return;
    }

    const now = Date.now();
    const recent = this.#usages.filter(u => u.replicaId === replicaId);

    const snapshot: ReplicaHeadroomSnapshot = {
      replicaId,
      logicalModelId: budget.logicalModelId,
      providerId: budget.providerId,
      lastUpdatedAt: new Date().toISOString(),
      confidence: 'tokenomics-derived'
    };

    if (budget.maxTokensHour !== undefined) {
      const used = this.#sumTokens(recent, now - HOUR_MS);
      snapshot.remainingTokensHour = Math.max(0, budget.maxTokensHour - used);
    }
    if (budget.maxTokensWeek !== undefined) {
      const used = this.#sumTokens(recent, now - WEEK_MS);
      snapshot.remainingTokensWeek = Math.max(0, budget.maxTokensWeek - used);
    }
    if (budget.maxTokensMonth !== undefined) {
      const used = this.#sumTokens(recent, now - MONTH_MS);
      snapshot.remainingTokensMonth = Math.max(0, budget.maxTokensMonth - used);
    }
    if (budget.maxCostHour !== undefined) {
      const used = this.#sumCost(recent, now - HOUR_MS);
      snapshot.remainingCostHour = Math.max(0, budget.maxCostHour - used);
    }
    if (budget.maxCostWeek !== undefined) {
      const used = this.#sumCost(recent, now - WEEK_MS);
      snapshot.remainingCostWeek = Math.max(0, budget.maxCostWeek - used);
    }
    if (budget.maxCostMonth !== undefined) {
      const used = this.#sumCost(recent, now - MONTH_MS);
      snapshot.remainingCostMonth = Math.max(0, budget.maxCostMonth - used);
    }

    return snapshot;
  }

  #sumTokens(records: ReplicaAwareUsage[], since: number): number {
    return records.filter(u => u.timestamp.getTime() >= since).reduce((total, u) => total + u.tokensUsed, 0);
  }

  #sumCost(records: ReplicaAwareUsage[], since: number): number {
    return records.filter(u => u.timestamp.getTime() >= since).reduce((total, u) => total + u.cost, 0);
  }
}
