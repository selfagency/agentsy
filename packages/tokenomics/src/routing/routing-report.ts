/**
 * Replica routing diagnostics report.
 *
 * Aggregates per-replica headroom, budget identity, and skew signals
 * into a single snapshot for observability, monitoring dashboards,
 * and post-hoc analysis of routing decisions.
 *
 * This is the canonical "hot-replica diagnostics" output for the
 * tokenomics package — every replica with a budget is represented
 * in the report alongside its headroom percentage, confidence label,
 * and skew status (hot / cold / balanced).
 */

import type { ReplicaBudget, ReplicaHeadroomSnapshot } from '../quotas/headroom.js';
import type { UsageAggregator } from '../quotas/usage-aggregator.js';
import { firstMatchingHeadroom } from './headroom-provider.js';
import type { ReplicaSkewSignal } from './replica-skew.js';
import { computeReplicaSkew } from './replica-skew.js';

// =============================================================================
// Types
// =============================================================================

/**
 * One row in the routing diagnostics report — combines budget identity,
 * headroom snapshot, and skew classification for a single replica.
 */
export interface ReplicaDiagnosticEntry {
  /** How the headroom value was derived. */
  confidence: ReplicaHeadroomSnapshot['confidence'];

  /** 0-100 headroom percentage. */
  headroomPercentage: number;

  /** ISO date of the last headroom update. */
  lastUpdatedAt: string;
  logicalModelId: string;
  providerId: string;
  replicaId: string;

  /** Skew classification (hot / cold / balanced). */
  skew: 'hot' | 'cold' | 'balanced';
}

/**
 * Top-level routing diagnostics report.
 *
 * Covers all replicas tracked by the given budget set, with an
 * overall health summary for at-a-glance monitoring.
 */
export interface RoutingDiagnosticsReport {
  /** Replicas flagged as cold (disproportionately low headroom). */
  coldReplicaIds: string[];

  /** Per-replica diagnostics, sorted by headroom ascending. */
  entries: ReplicaDiagnosticEntry[];

  /** Timestamp the report was generated. */
  generatedAt: string;

  /** Replicas flagged as hot (disproportionately high headroom). */
  hotReplicaIds: string[];
  /** Number of replicas in the report. */
  replicaCount: number;
}

// =============================================================================
// Report builder
// =============================================================================

/**
 * Build a routing diagnostics report for all replicas registered
 * with the given aggregator.
 *
 * When the aggregator has no budgets, returns a zero-entry report.
 */
export function buildRoutingReport(aggregator: UsageAggregator): RoutingDiagnosticsReport {
  const budgets = aggregator.getAllBudgets();
  const replicaIds = budgets.map(b => b.replicaId);

  if (replicaIds.length === 0) {
    return {
      replicaCount: 0,
      entries: [],
      coldReplicaIds: [],
      hotReplicaIds: [],
      generatedAt: new Date().toISOString()
    };
  }

  // Build entries from headroom snapshots + budgets
  const snapshots: ReplicaHeadroomSnapshot[] = [];

  for (const replicaId of replicaIds) {
    const snapshot = aggregator.getHeadroomSnapshot(replicaId);
    if (snapshot !== undefined) {
      snapshots.push({
        ...snapshot,
        logicalModelId: snapshot.logicalModelId,
        providerId: snapshot.providerId,
        replicaId: snapshot.replicaId,
        confidence: snapshot.confidence,
        lastUpdatedAt: snapshot.lastUpdatedAt
      });
    }
  }

  // Compute skew signals from collected snapshots
  const skewSignals = computeReplicaSkew(snapshots);
  const skewByReplicaId = new Map<string, ReplicaSkewSignal>();
  for (const signal of skewSignals) {
    skewByReplicaId.set(signal.replicaId, signal);
  }

  // Build entries sorted by headroom ascending (worst-first)
  const entries: ReplicaDiagnosticEntry[] = budgets
    .map(budget => {
      const snapshot = snapshots.find(s => s.replicaId === budget.replicaId);
      const headroomPct = snapshot === undefined ? 0 : computeHeadroomPercentageFromBudget(snapshot, budget);
      const confidence = snapshot?.confidence ?? 'estimated';
      const lastUpdatedAt = snapshot?.lastUpdatedAt ?? '';
      const skew = skewByReplicaId.get(budget.replicaId);

      let skewLabel: ReplicaDiagnosticEntry['skew'] = 'balanced';
      if (skew !== undefined) {
        if (skew.isHot) {
          skewLabel = 'hot';
        }
        if (skew.isCold) {
          skewLabel = 'cold';
        }
      }

      return {
        logicalModelId: budget.logicalModelId,
        providerId: budget.providerId,
        replicaId: budget.replicaId,
        headroomPercentage: headroomPct,
        confidence,
        lastUpdatedAt,
        skew: skewLabel
      };
    })
    .sort((a, b) => a.headroomPercentage - b.headroomPercentage);

  const coldReplicaIds = entries.filter(e => e.skew === 'cold').map(e => e.replicaId);

  const hotReplicaIds = entries.filter(e => e.skew === 'hot').map(e => e.replicaId);

  return {
    replicaCount: entries.length,
    entries,
    coldReplicaIds,
    hotReplicaIds,
    generatedAt: new Date().toISOString()
  };
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Compute a single 0-100 headroom percentage from a snapshot and budget,
 * preferring the most granular available dimension (minute > hour > week > month).
 *
 * Cyclomatic complexity is kept at 1 by delegating the fallback chain to
 * `firstMatchingHeadroom` — keeps CRAP well under the 30.0 threshold.
 */
function computeHeadroomPercentageFromBudget(snapshot: ReplicaHeadroomSnapshot, budget: ReplicaBudget): number {
  return firstMatchingHeadroom(snapshot, budget) ?? 0;
}
