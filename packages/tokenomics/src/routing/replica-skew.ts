/**
 * Saturation/skew signals for same-model replicas.
 *
 * Computes headroom distribution across replicas serving the same
 * logical model and flags replicas whose share deviates significantly
 * from the expected even distribution.
 */

import type { ReplicaHeadroomSnapshot } from '../quotas/headroom.js';

// =============================================================================
// Types
// =============================================================================

export interface ReplicaSkewSignal {
  /**
   * True when this replica's share falls below the expected even share
   * by more than 0.2 — disproportionately low remaining headroom.
   */
  isCold: boolean;
  /**
   * True when this replica's share exceeds the expected even share
   * by more than 0.2 — disproportionately high remaining headroom.
   */
  isHot: boolean;
  replicaId: string;
  /** Proportion (0-1) of total remaining headroom this replica holds. */
  share: number;
}

// =============================================================================
// Skew computation
// =============================================================================

/**
 * Compute per-replica skew signals from a set of headroom snapshots.
 *
 * Share is computed from `remainingTokensMinute` (falling back to
 * `remainingTokensHour`, then `remainingRequestsMinute`, then
 * `remainingCostMinute` when minute/hour token data is unavailable).
 *
 * Skew thresholds:
 * - Hot: share > 1/n + 0.2
 * - Cold: share < 1/n - 0.2
 *
 * Returns an empty array when snapshots is empty.
 */
export function computeReplicaSkew(snapshots: ReplicaHeadroomSnapshot[]): ReplicaSkewSignal[] {
  if (snapshots.length === 0) {
    return [];
  }

  const n = snapshots.length;
  const expectedShare = 1 / n;
  const hotThreshold = expectedShare + 0.2;
  const coldThreshold = expectedShare - 0.2;

  const totalRemaining = snapshots.reduce((sum, s) => sum + extractRemaining(s), 0);

  return snapshots.map(snapshot => {
    const remaining = extractRemaining(snapshot);
    const share = totalRemaining > 0 ? remaining / totalRemaining : expectedShare;
    const roundedShare = Math.round(share * 100) / 100;

    return {
      replicaId: snapshot.replicaId,
      share: roundedShare,
      isHot: roundedShare > hotThreshold,
      isCold: roundedShare < coldThreshold
    };
  });
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Extract the primary remaining value from a headroom snapshot.
 * Prefers tokens-minute, then tokens-hour, then requests-minute, then cost-minute.
 */
function extractRemaining(snapshot: ReplicaHeadroomSnapshot): number {
  return (
    snapshot.remainingTokensMinute ??
    snapshot.remainingTokensHour ??
    snapshot.remainingRequestsMinute ??
    snapshot.remainingCostMinute ??
    0
  );
}
