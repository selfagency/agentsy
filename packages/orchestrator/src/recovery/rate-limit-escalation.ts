/**
 * Rate-limit detection and escalation for model replica failover.
 *
 * Examines per-replica quota snapshots to determine rate-limit status,
 * then filters replicas so the failover chain skips exhausted replicas.
 * When all replicas for a logical model are rate-limited, the model is
 * skipped and the chain advances to the next candidate.
 */

import type { ModelReplica, ReplicaQuotaSnapshot } from '@agentsy/gateway';

// =============================================================================
// Error
// =============================================================================

/**
 * Emitted when a specific replica has been rate-limited.
 * The `retryAfterMs` hint (when available) tells the caller how long
 * to wait before retrying this replica.
 */
export class RateLimitExceededError extends Error {
  readonly replicaId: string;
  readonly retryAfterMs?: number;

  constructor(replicaId: string, retryAfterMs?: number) {
    super(`Rate limit exceeded for replica "${replicaId}"`);
    this.name = 'RateLimitExceededError';
    this.replicaId = replicaId;
    // exactOptionalPropertyTypes: only assign when defined
    if (retryAfterMs !== undefined) {
      this.retryAfterMs = retryAfterMs;
    }
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Per-replica rate-limit status derived from quota headroom data.
 */
export interface RateLimitStatus {
  /** Whether this replica has exhausted its rate-limit budget. */
  isRateLimited: boolean;
  /** Remaining quota headroom (when available). */
  remainingQuota?: number;
  /** Recommended wait before retrying this replica (when known). */
  retryAfterMs?: number;
}

// =============================================================================
// Rate-limit map construction
// =============================================================================

/**
 * Build a per-replica rate-limit map by comparing each replica's quota
 * snapshot against its window limit.
 *
 * A replica is considered rate-limited when its remaining per-minute
 * token or request quota is fully exhausted (zero). When no snapshot
 * exists for a replica it is treated as *not* rate-limited — absence
 * of data is not grounds to skip.
 *
 * @param replicas - All replicas to evaluate.
 * @param quotaSnapshots - Keyed by replica id. May be sparse.
 * @returns A map keyed by replica id with rate-limit status.
 */
export function buildRateLimitMap(
  replicas: ModelReplica[],
  quotaSnapshots: Map<string, ReplicaQuotaSnapshot>
): Map<string, RateLimitStatus> {
  const result = new Map<string, RateLimitStatus>();

  for (const replica of replicas) {
    const snapshot = quotaSnapshots.get(replica.id);

    if (snapshot === undefined) {
      // No quota data — assume not rate-limited
      result.set(replica.id, { isRateLimited: false });
      continue;
    }

    // Per-minute token and request budgets are the most granular
    // indicators of active rate-limiting. If either is zero the
    // replica is currently rate-limited.
    const tokensExhausted = snapshot.remainingTokensMinute === 0;
    const requestsExhausted = snapshot.remainingRequestsMinute === 0;
    const isRateLimited = tokensExhausted || requestsExhausted;

    // Pick the most granular numeric remaining value for diagnostics
    const remaining =
      snapshot.remainingTokensMinute ?? snapshot.remainingRequestsMinute ?? snapshot.remainingTokensHour;

    if (remaining === undefined) {
      result.set(replica.id, { isRateLimited });
    } else {
      result.set(replica.id, { isRateLimited, remainingQuota: remaining });
    }
  }

  return result;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Return replica ids that are NOT rate-limited (the "unlimited" subset).
 *
 * Replicas with no entry in the map are treated as unlimited (safe default).
 *
 * @param rateLimitMap - Rate-limit status per replica id.
 * @param replicaIds - Candidate replica ids to filter.
 * @returns Replica ids that are safe to use.
 */
export function getUnlimitedReplicas(rateLimitMap: Map<string, RateLimitStatus>, replicaIds: string[]): string[] {
  return replicaIds.filter(id => {
    const status = rateLimitMap.get(id);
    return status?.isRateLimited !== true;
  });
}

/**
 * Returns `true` when *every* replica in the given set is rate-limited.
 *
 * An empty set returns `false` (no replicas = not all rate-limited).
 *
 * @param rateLimitMap - Rate-limit status per replica id.
 * @param replicaIds - Replica ids to check.
 * @returns Whether all candidate replicas are rate-limited.
 */
export function allReplicasRateLimited(rateLimitMap: Map<string, RateLimitStatus>, replicaIds: string[]): boolean {
  if (replicaIds.length === 0) {
    return false;
  }

  return replicaIds.every(id => rateLimitMap.get(id)?.isRateLimited === true);
}
