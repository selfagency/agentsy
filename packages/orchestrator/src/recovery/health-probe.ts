/**
 * Cache-backed replica health probe for orchestrator-level failover.
 *
 * Rather than performing outbound HTTP calls, this probe relies on the
 * orchestrator's call outcomes — `markAlive` / `markDead` record the
 * result of actual model-invocation attempts. The probe tracks TTL-based
 * staleness so the failover chain can skip unhealthy or stale replicas.
 *
 * Architecture decision (2026-06-06, Plan 34):
 *   - Health state is per-replica, stored in-memory with configurable TTL
 *   - No actual HTTP probing in this version — driven entirely by call outcomes
 *   - `start()` provides the hook for future periodic HTTP health checks
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Cached result of the last health determination for a single replica.
 *
 * @property available - Whether the replica is believed to be reachable.
 * @property latencyMs - Optional round-trip time from the last successful call.
 * @property lastChecked - ISO-8601 timestamp of when this result was recorded.
 */
export interface HealthProbeResult {
  available: boolean;
  lastChecked: string;
  latencyMs?: number;
}

/**
 * Configuration for the {@link ReplicaHealthProbe}.
 *
 * All fields have sensible defaults for orchestrator-level use.
 *
 * @property ttlMs - How long a cached probe result is considered fresh (default 30s).
 * @property timeoutMs - Max time to wait for a probe response (reserved, default 5s).
 * @property probeIntervalMs - Interval between periodic probe rounds (default 60s).
 */
export interface ReplicaHealthProbeConfig {
  probeIntervalMs: number;
  timeoutMs: number;
  ttlMs: number;
}

// =============================================================================
// Defaults
// =============================================================================

const DEFAULT_CONFIG: ReplicaHealthProbeConfig = {
  ttlMs: 30_000,
  timeoutMs: 5000,
  probeIntervalMs: 60_000
};

// =============================================================================
// ReplicaHealthProbe
// =============================================================================

/**
 * Cache-based replica health tracker.
 *
 * Callers record health outcomes via `markAlive` / `markDead` after each
 * model-invocation attempt. The probe surfaces stale entries via
 * `getUnhealthyReplicaIds` so the failover chain can skip replicas whose
 * cached state is expired or negative.
 */
export class ReplicaHealthProbe {
  readonly #config: ReplicaHealthProbeConfig;
  readonly #cache = new Map<string, HealthProbeResult>();
  #intervalHandle: ReturnType<typeof setInterval> | undefined;

  constructor(config?: Partial<ReplicaHealthProbeConfig>) {
    this.#config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Return the cached probe result for a replica, or `undefined` if it has
   * never been probed.
   */
  getProbeResult(replicaId: string): HealthProbeResult | undefined {
    return this.#cache.get(replicaId);
  }

  /**
   * Record a replica as healthy, optionally capturing the call latency.
   * Intended for local replicas or after a successful invocation.
   */
  markAlive(replicaId: string, latencyMs?: number): void {
    const result: HealthProbeResult = {
      available: true,
      lastChecked: new Date().toISOString()
    };

    if (latencyMs !== undefined) {
      result.latencyMs = latencyMs;
    }

    this.#cache.set(replicaId, result);
  }

  /**
   * Record a replica as unreachable. The cached result will be surfaced
   * by `getUnhealthyReplicaIds` until the entry is replaced or expires.
   */
  markDead(replicaId: string): void {
    this.#cache.set(replicaId, {
      available: false,
      lastChecked: new Date().toISOString()
    });
  }

  /**
   * Start periodic probe rounds.
   *
   * **Current version**: purely cache-based — no actual HTTP probes are fired.
   * This method exists as a hook so that a future implementation can attach
   * periodic health-check logic without changing the public API.
   *
   * Calling `start()` on an already-started probe is a no-op (single interval).
   */
  start(): void {
    if (this.#intervalHandle !== undefined) {
      return;
    }

    this.#intervalHandle = setInterval(() => {
      // Placeholder: future periodic health-check HTTP calls go here.
    }, this.#config.probeIntervalMs);
  }

  /**
   * Stop periodic probe rounds and release the interval handle.
   *
   * Calling `stop()` when the probe is not running is a safe no-op.
   */
  stop(): void {
    if (this.#intervalHandle === undefined) {
      return;
    }

    clearInterval(this.#intervalHandle);
    this.#intervalHandle = undefined;
  }

  /**
   * Return the IDs of every tracked replica that is currently considered
   * unhealthy. A replica is unhealthy when:
   *
   * 1. Its last recorded result shows `available: false`, **or**
   * 2. Its cached result has expired — the time since `lastChecked` exceeds
   *    the configured `ttlMs`, making the data stale.
   *
   * Replicas that have never been probed are not included (their health is
   * unknown rather than unhealthy).
   */
  getUnhealthyReplicaIds(): string[] {
    const now = Date.now();
    const unhealthy: string[] = [];

    for (const [replicaId, result] of this.#cache) {
      const age = now - new Date(result.lastChecked).getTime();

      if (!result.available || age > this.#config.ttlMs) {
        unhealthy.push(replicaId);
      }
    }

    return unhealthy;
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new `ReplicaHealthProbe` instance.
 *
 * @param config - Optional partial configuration (unspecified fields use defaults).
 */
export function createReplicaHealthProbe(config?: Partial<ReplicaHealthProbeConfig>): ReplicaHealthProbe {
  return new ReplicaHealthProbe(config);
}
