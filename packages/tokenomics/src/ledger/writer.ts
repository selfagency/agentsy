/**
 * Session ledger writer — factory functions for creating
 * `SessionLedgerEntry` values with optional replica-aware routing fields.
 *
 * The factory accepts `ReplicaUsageFields` (from the quotas/headroom module)
 * and selectively maps `logicalModelId` and `replicaId` onto the entry.
 * `providerId` and `failoverChain` are separate optional fields since they
 * are not part of the `ReplicaUsageFields` interface.
 *
 * All replica fields are optional — existing code paths that do not use
 * replica routing are unaffected.
 */

import type { ReplicaUsageFields } from '../quotas/headroom.js';
import type { ArtifactRecord, FrustrationRecord, QualityRecord, SessionLedgerEntry, SpendRecord } from './types.js';

// =============================================================================
// Input options — everything needed to build a SessionLedgerEntry
// =============================================================================

/**
 * Input for `createSessionLedgerEntry`.
 *
 * Splits replica-aware routing metadata into two buckets:
 * - `replicaFields` — shares fields with `ReplicaUsageFields` (logicalModelId, replicaId)
 * - `providerId` / `failoverChain` — standalone fields not covered by `ReplicaUsageFields`
 */
export interface CreateSessionLedgerEntryOptions {
  /** Unique ledger entry identifier. */
  id: string;
  /** The agent session this entry covers. */
  sessionId: string;
  /** Agent that ran the session. */
  agentId: string;
  /** Model deployed for the session. */
  modelId: string;
  /** Provider that served the session. */
  provider: string;
  /** Wall-clock session start. */
  startedAt: Date;
  /** Wall-clock session end. */
  endedAt: Date;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Token & cost summary. */
  spend: SpendRecord;
  /** Artifact generation stats. */
  artifacts: ArtifactRecord;
  /** Quality score & feedback. */
  quality: QualityRecord;
  /** Frustration signals detected during session. */
  frustration: FrustrationRecord;
  /** Survival rate at 30 days (null if not yet calculable). */
  survivalRate30d: number | null;
  /** Arbitrary session tags. */
  tags: string[];

  // ---------------------------------------------------------------------------
  // Replica routing (optional — omit for non-replica sessions)
  // ---------------------------------------------------------------------------

  /**
   * Fields from the replica/headroom context.
   * `logicalModelId` and `replicaId` are picked from this object
   * when present; `accountId` is intentionally not mapped to the
   * ledger entry (it lives in the headroom/budget domain).
   */
  replicaFields?: ReplicaUsageFields;

  /** Provider identifier from the replica budget context. */
  providerId?: string;

  /** Ordered list of replica IDs attempted before the session landed. */
  failoverChain?: string[];
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a `SessionLedgerEntry` from structured input.
 *
 * Replica-aware fields (`logicalModelId`, `replicaId`, `providerId`,
 * `failoverChain`) are set only when explicitly provided.
 *
 * @example
 * ```typescript
 * const entry = createSessionLedgerEntry({
 *   id: 'ledger_abc123',
 *   sessionId: 'session_xyz',
 *   agentId: 'agent-1',
 *   modelId: 'claude-sonnet-4-20250514',
 *   provider: 'anthropic',
 *   startedAt: new Date('2026-06-06T00:00:00Z'),
 *   endedAt: new Date('2026-06-06T00:05:00Z'),
 *   durationMs: 300_000,
 *   spend: { totalTokens: 1500, totalCost: 0.03, requestCount: 5 },
 *   artifacts: { generated: 3, cached: 1 },
 *   quality: { score: 0.92, feedbackCount: 2 },
 *   frustration: { count: 0, reasons: [] },
 *   survivalRate30d: null,
 *   tags: ['production'],
 *   replicaFields: { logicalModelId: 'claude-sonnet', replicaId: 'rep-01' },
 *   providerId: 'anthropic-us-east-1',
 *   failoverChain: ['rep-02', 'rep-03']
 * });
 * ```
 */
export function createSessionLedgerEntry(options: CreateSessionLedgerEntryOptions): SessionLedgerEntry {
  const { replicaFields, failoverChain, providerId, ...base } = options;

  const entry: SessionLedgerEntry = {
    ...base,
    ...(replicaFields?.logicalModelId !== undefined ? { logicalModelId: replicaFields.logicalModelId } : {}),
    ...(replicaFields?.replicaId !== undefined ? { replicaId: replicaFields.replicaId } : {}),
    ...(providerId !== undefined ? { providerId } : {}),
    ...(failoverChain !== undefined ? { failoverChain } : {})
  };

  return entry;
}
