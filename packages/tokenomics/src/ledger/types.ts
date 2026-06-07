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
  totalTokens: number;
  totalCost: number;
  requestCount: number;
}

export interface ArtifactRecord {
  generated: number;
  cached: number;
}

export interface QualityRecord {
  score: number;
  feedbackCount: number;
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
  /** Unique ledger entry identifier. */
  id: string;
  /** The agent session this entry covers. */
  sessionId: string;
  /** Agent that ran the session. */
  agentId: string;
  /** Model deployed for the session (e.g. "claude-sonnet-4-20250514"). */
  modelId: string;
  /** Provider that served the session (e.g. "anthropic"). */
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
  // Replica-aware routing fields (optional, for failover/headroom tracking)
  // ---------------------------------------------------------------------------

  /** Logical model identifier for replica-aware routing. */
  logicalModelId?: string;
  /** Specific replica that handled this session. */
  replicaId?: string;
  /** Provider identifier from the replica budget context. */
  providerId?: string;
  /** Ordered list of replica IDs attempted before the session landed. */
  failoverChain?: string[];
}
