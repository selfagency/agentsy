/**
 * Session ledger types for the tokenomics system.
 *
 * Every completed agent session produces a `SessionLedgerEntry`
 * that captures spend, artifacts, quality, frustration signals,
 * and optional replica-aware routing metadata for failover tracking.
 */

// =============================================================================
// Sub-records within a session ledger entry
// =============================================================================

export interface SpendRecord {
  requestCount: number;
  totalCost: number;
  totalTokens: number;
}

export interface ArtifactRecord {
  cached: number;
  generated: number;
}

export interface QualityRecord {
  feedbackCount: number;
  score: number;
}

export interface FrustrationRecord {
  count: number;
  reasons: string[];
}

// =============================================================================
// Session ledger entry — one per completed agent session
// =============================================================================

/**
 * Immutable record of a completed agent session.
 *
 * Replica-aware fields (`logicalModelId`, `replicaId`, `providerId`,
 * `failoverChain`) are optional for backward compatibility — sessions
 * that do not use replica routing omit them entirely.
 */
export interface SessionLedgerEntry {
  /** Agent that ran the session. */
  agentId: string;
  /** Artifact generation stats. */
  artifacts: ArtifactRecord;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Wall-clock session end. */
  endedAt: Date;
  /** Ordered list of replica IDs attempted before the session landed. */
  failoverChain?: string[];
  /** Frustration signals detected during session. */
  frustration: FrustrationRecord;
  /** Unique ledger entry identifier. */
  id: string;

  // ---------------------------------------------------------------------------
  // Replica-aware routing fields (optional, for failover/headroom tracking)
  // ---------------------------------------------------------------------------

  /** Logical model identifier for replica-aware routing. */
  logicalModelId?: string;
  /** Model deployed for the session (e.g. "claude-sonnet-4-20250514"). */
  modelId: string;
  /** Provider that served the session (e.g. "anthropic"). */
  provider: string;
  /** Provider identifier from the replica budget context. */
  providerId?: string;
  /** Quality score & feedback. */
  quality: QualityRecord;
  /** Specific replica that handled this session. */
  replicaId?: string;
  /** The agent session this entry covers. */
  sessionId: string;
  /** Token & cost summary. */
  spend: SpendRecord;
  /** Wall-clock session start. */
  startedAt: Date;
  /** Survival rate at 30 days (null if not yet calculable). */
  survivalRate30d: number | null;
  /** Arbitrary session tags. */
  tags: string[];
}
