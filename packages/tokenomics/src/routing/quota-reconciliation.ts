/**
 * Provider-header + tokenomics-derived confidence reconciliation.
 *
 * Merges real-time rate-limit header snapshots (from provider responses)
 * with tokenomics-computed headroom (from usage aggregator) into a
 * unified view the replica selector can use for routing decisions.
 */

import type { HeadroomConfidence, ReplicaHeadroomSnapshot } from '../quotas/headroom.js';

// =============================================================================
// Header snapshot input — structurally compatible with
// packages/gateway/src/quota/header-parser.ts RateLimitHeaderSnapshot
// =============================================================================

export interface HeaderSnapshotInput {
  rpmLimit: number;
  rpmRemaining: number;
  rpmResetSeconds: number;
  tpmLimit: number;
  tpmRemaining: number;
  tpmResetSeconds: number;
}

// =============================================================================
// Unified result
// =============================================================================

export interface ReconciledQuotaSnapshot {
  /** Overall confidence derived from available data sources. */
  confidence: HeadroomConfidence;
  /**
   * Effective RPM remaining — the most conservative value
   * between header-derived and tokenomics-derived data.
   */
  effectiveRpmRemaining: number;
  /**
   * Effective TPM remaining — the most conservative value
   * between header-derived and tokenomics-derived data.
   */
  effectiveTpmRemaining: number;
  /** Raw header snapshot (null if no header data). */
  header: HeaderSnapshotInput | null;
  /** ISO-8601 timestamp when reconciliation was computed. */
  reconciledAt: string;
  /** RPM limit from provider header (0 if unavailable). */
  rpmLimit: number;
  /** Raw tokenomics snapshot (null if no aggregator data). */
  tokenomics: ReplicaHeadroomSnapshot | null;
  /** TPM limit from provider header (0 if unavailable). */
  tpmLimit: number;
}

// =============================================================================
// Reconciliation
// =============================================================================

/**
 * Merge a provider rate-limit header snapshot with tokenomics-computed
 * headroom into a unified `ReconciledQuotaSnapshot`.
 *
 * Confidence mapping:
 * - Both sources available → `'header-derived'` (header is authoritative)
 * - Only header → `'header-derived'`
 * - Only tokenomics → `'tokenomics-derived'`
 * - Neither → `'estimated'`
 */
export function reconcileQuotaConfidence(
  headerSnapshot: HeaderSnapshotInput | null,
  tokenomicsSnapshot: ReplicaHeadroomSnapshot | null
): ReconciledQuotaSnapshot {
  const confidence: HeadroomConfidence = deriveConfidence(headerSnapshot, tokenomicsSnapshot);

  const effectiveRpmRemaining = pickConservative([
    headerSnapshot?.rpmRemaining,
    tokenomicsSnapshot?.remainingRequestsMinute
  ]);

  const effectiveTpmRemaining = pickConservative([
    headerSnapshot?.tpmRemaining,
    tokenomicsSnapshot?.remainingTokensMinute
  ]);

  return {
    confidence,
    reconciledAt: new Date().toISOString(),
    effectiveRpmRemaining,
    effectiveTpmRemaining,
    rpmLimit: headerSnapshot?.rpmLimit ?? 0,
    tpmLimit: headerSnapshot?.tpmLimit ?? 0,
    header: headerSnapshot,
    tokenomics: tokenomicsSnapshot
  };
}

// =============================================================================
// Internal helpers
// =============================================================================

function deriveConfidence(
  header: HeaderSnapshotInput | null,
  tokenomics: ReplicaHeadroomSnapshot | null
): HeadroomConfidence {
  if (header !== null && tokenomics !== null) {
    return 'header-derived';
  }
  if (header !== null) {
    return 'header-derived';
  }
  if (tokenomics !== null) {
    return 'tokenomics-derived';
  }
  return 'estimated';
}

/**
 * Pick the minimum (most conservative) value from a list of optional numbers.
 * Returns 0 when every entry is undefined.
 */
function pickConservative(values: (number | undefined)[]): number {
  const defined = values.filter((v): v is number => v !== undefined);
  return defined.length > 0 ? Math.min(...defined) : 0;
}
