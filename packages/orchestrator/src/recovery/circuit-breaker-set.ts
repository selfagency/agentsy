/**
 * Per-replica circuit-breaker state tracking.
 *
 * Tracks consecutive failures per replica and opens the circuit
 * when the failure threshold is reached. After the cooldown period
 * the circuit auto-transitions to half-open on the next `isOpen`
 * check. Callers can use `halfOpenMaxRequests` to limit probe traffic.
 *
 * Architecture decision (2026-06-06, Plan 34):
 *   - Lives in the orchestrator (not gateway) so failover logic
 *     and circuit state are colocated.
 *   - Unlike the gateway's `ModelAvailabilityTracker`, this set
 *     is dedicated to per-replica circuit state without health-check
 *     polling or availability caching.
 */

// =============================================================================
// Types
// =============================================================================

export interface CircuitBreakerConfig {
  /** Consecutive failures before the circuit opens. Default: 5. */
  failureThreshold: number;
  /** Milliseconds before an open circuit transitions to half-open. Default: 30_000. */
  cooldownMs: number;
  /** Max requests permitted in half-open state. Default: 1. */
  halfOpenMaxRequests: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerEntry {
  /** The replica identifier this entry tracks. */
  replicaId: string;
  /** Current circuit state. */
  state: CircuitState;
  /** Consecutive failure count (resets on success). */
  consecutiveFailures: number;
  /** ISO-8601 timestamp of the most recent failure, if any. */
  lastFailureAt?: string;
  /** ISO-8601 timestamp when the circuit was opened, if currently open. */
  openedAt?: string;
}

// =============================================================================
// Defaults
// =============================================================================

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 30_000;
const DEFAULT_HALF_OPEN_MAX_REQUESTS = 1;

// =============================================================================
// CircuitBreakerSet
// =============================================================================

export class CircuitBreakerSet {
  readonly #entries = new Map<string, CircuitBreakerEntry>();
  readonly #config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.#config = {
      failureThreshold: config?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD,
      cooldownMs: config?.cooldownMs ?? DEFAULT_COOLDOWN_MS,
      halfOpenMaxRequests: config?.halfOpenMaxRequests ?? DEFAULT_HALF_OPEN_MAX_REQUESTS
    };
  }

  /**
   * Record a failed call for the given replica.
   * Increments the consecutive-failure counter. When the threshold
   * is reached the circuit transitions to `open`.
   */
  recordFailure(replicaId: string): void {
    const existing = this.#entries.get(replicaId);
    const entry: CircuitBreakerEntry = existing ?? {
      replicaId,
      state: 'closed',
      consecutiveFailures: 0
    };

    entry.consecutiveFailures++;
    entry.lastFailureAt = new Date().toISOString();

    if (entry.state === 'half-open') {
      // Half-open + failure → back to open
      entry.state = 'open';
      entry.openedAt = new Date().toISOString();
    } else if (entry.consecutiveFailures >= this.#config.failureThreshold && entry.state !== 'open') {
      entry.state = 'open';
      entry.openedAt = new Date().toISOString();
    }

    this.#entries.set(replicaId, entry);
  }

  /**
   * Record a successful call for the given replica.
   * Resets the failure counter and closes the circuit.
   */
  recordSuccess(replicaId: string): void {
    this.#entries.set(replicaId, {
      replicaId,
      state: 'closed',
      consecutiveFailures: 0
    });
  }

  /**
   * Check whether the circuit is open for the given replica.
   *
   * Returns `false` for unknown replicas. If the circuit is open
   * and the cooldown period has elapsed, it auto-transitions to
   * half-open and returns `false`.
   */
  isOpen(replicaId: string): boolean {
    const entry = this.#entries.get(replicaId);
    if (entry === undefined) {
      return false;
    }

    this.#maybeTransition(entry);
    return entry.state === 'open';
  }

  /**
   * Return the current circuit state for a replica.
   * Unknown replicas return `'closed'`.
   */
  getState(replicaId: string): CircuitState {
    const entry = this.#entries.get(replicaId);
    if (entry === undefined) {
      return 'closed';
    }

    this.#maybeTransition(entry);
    return entry.state;
  }

  /**
   * Return the IDs of all replicas whose circuit is currently open.
   */
  getOpenReplicaIds(): string[] {
    const open: string[] = [];

    for (const [replicaId, entry] of this.#entries) {
      this.#maybeTransition(entry);
      if (entry.state === 'open') {
        open.push(replicaId);
      }
    }

    return open;
  }

  /**
   * Reset the circuit for a replica back to closed.
   * Removes any tracked state for that replica.
   */
  reset(replicaId: string): void {
    this.#entries.delete(replicaId);
  }

  /**
   * If the circuit is open and the cooldown has elapsed, transition
   * to half-open.
   */
  #maybeTransition(entry: CircuitBreakerEntry): void {
    if (entry.state !== 'open' || entry.openedAt === undefined) {
      return;
    }

    const elapsed = Date.now() - new Date(entry.openedAt).getTime();
    if (elapsed >= this.#config.cooldownMs) {
      entry.state = 'half-open';
      delete entry.openedAt;
    }
  }
}

/**
 * Create a new `CircuitBreakerSet` with the given configuration.
 */
export function createCircuitBreakerSet(config?: Partial<CircuitBreakerConfig>): CircuitBreakerSet {
  return new CircuitBreakerSet(config);
}
