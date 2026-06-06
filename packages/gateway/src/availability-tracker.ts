/**
 * Tracks model availability via periodic health checks.
 * Results are cached with a configurable TTL so the selector
 * doesn't hammer endpoints on every call.
 *
 * Local models are checked by probing their provider endpoint;
 * cloud models are assumed available unless a check fails.
 */

import type { ModelEntry } from './types.js';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerEntry {
  consecutiveFailures: number;
  state: CircuitState;
  openedAt?: number;
  halfOpenStartedAt?: number;
}

export interface ModelAvailability {
  error?: string;
  isAvailable: boolean;
  lastChecked: Date;
  latencyMs?: number;
  modelId: string;
  providerId: string;
}

export interface AvailabilityTrackerOptions {
  /** Timeout per health-check request in ms (default: 2_000). */
  timeoutMs?: number;
  /** TTL for cached availability results in ms (default: 30_000). */
  ttlMs?: number;
  /** Consecutive failures before circuit opens (default: 5). */
  circuitFailureThreshold?: number;
  /** Duration in ms for circuit to stay open before half-open probe (default: 30_000). */
  circuitResetAfterMs?: number;
}

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_CIRCUIT_FAILURE_THRESHOLD = 5;
const DEFAULT_CIRCUIT_RESET_MS = 30_000;

export class ModelAvailabilityTracker {
  readonly #cache = new Map<string, ModelAvailability>();
  readonly #circuitBreakers = new Map<string, CircuitBreakerEntry>();
  readonly #ttlMs: number;
  readonly #timeoutMs: number;
  readonly #circuitFailureThreshold: number;
  readonly #circuitResetAfterMs: number;

  constructor(options: AvailabilityTrackerOptions = {}) {
    this.#ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#circuitFailureThreshold = options.circuitFailureThreshold ?? DEFAULT_CIRCUIT_FAILURE_THRESHOLD;
    this.#circuitResetAfterMs = options.circuitResetAfterMs ?? DEFAULT_CIRCUIT_RESET_MS;
  }

  /** Record a successful call — resets circuit breaker for this replica. */
  recordSuccess(replicaId: string): void {
    this.#circuitBreakers.set(replicaId, {
      consecutiveFailures: 0,
      state: 'closed'
    });
  }

  /** Record a failed call — increments failure counter and may open the circuit. */
  recordFailure(replicaId: string): void {
    const entry = this.#circuitBreakers.get(replicaId) ?? {
      consecutiveFailures: 0,
      state: 'closed' as CircuitState
    };

    entry.consecutiveFailures++;

    if (entry.state === 'half-open') {
      // Half-open + failure → reopen
      entry.state = 'open';
      entry.openedAt = Date.now();
      delete entry.halfOpenStartedAt;
    } else if (entry.consecutiveFailures >= this.#circuitFailureThreshold && entry.state !== 'open') {
      entry.state = 'open';
      entry.openedAt = Date.now();
    }

    this.#circuitBreakers.set(replicaId, entry);
  }

  /** Get the current circuit state for a replica. Performs half-open transitions. */
  getCircuitState(replicaId: string): CircuitState {
    const entry = this.#circuitBreakers.get(replicaId);
    if (entry === undefined) {
      return 'closed';
    }

    if (entry.state === 'open' && entry.openedAt !== undefined) {
      const elapsed = Date.now() - entry.openedAt;
      if (elapsed >= this.#circuitResetAfterMs) {
        // Transition to half-open
        entry.state = 'half-open';
        entry.halfOpenStartedAt = Date.now();
        this.#circuitBreakers.set(replicaId, entry);
        return 'half-open';
      }
    }

    return entry.state;
  }

  /** Get all circuit breaker states for diagnostics. */
  getCircuitBreakerSnapshot(): Array<{ replicaId: string } & CircuitBreakerEntry> {
    return [...this.#circuitBreakers.entries()].map(([replicaId, entry]) => ({
      replicaId,
      ...entry
    }));
  }

  /**
   * Check availability for a set of models. Cloud models (non-local)
   * are assumed available unless a previous check failed and the TTL
   * hasn't expired. Local models are probed via their provider URL.
   *
   * @param models - Full list of registered models.
   * @param providerUrls - Map of providerId → base URL for health checks.
   */
  async checkAvailability(models: ModelEntry[], providerUrls: ReadonlyMap<string, string>): Promise<void> {
    const toProbe = this.#collectProbes(models, providerUrls);
    if (toProbe.size === 0) {
      return;
    }
    const outcomes = await this.#fireProbes(toProbe);
    this.#applyProbeResults(models, outcomes);
  }

  #collectProbes(models: ModelEntry[], providerUrls: ReadonlyMap<string, string>): Set<string> {
    const now = Date.now();
    const toProbe = new Set<string>();

    for (const model of models) {
      const cached = this.#cache.get(model.id);
      const age = cached === undefined ? Number.POSITIVE_INFINITY : now - cached.lastChecked.getTime();

      if (age < this.#ttlMs && cached !== undefined) {
        if (!cached.isAvailable) {
          const url = providerUrls.get(model.providerId);
          if (url !== undefined) {
            toProbe.add(`${model.providerId}::${url}`);
          }
        }
        continue;
      }

      const url = providerUrls.get(model.providerId);
      if (url !== undefined) {
        toProbe.add(`${model.providerId}::${url}`);
      }
    }

    return toProbe;
  }

  #fireProbes(toProbe: Set<string>): Promise<
    PromiseSettledResult<{
      available: boolean;
      providerId: string;
      error?: string;
      latencyMs?: number;
    }>[]
  > {
    const now = Date.now();
    return Promise.allSettled(
      [...toProbe].map(async key => {
        const [providerId, baseUrl] = key.split('::', 2) as [string, string];
        const startedAt = now;
        try {
          const response = await fetch(baseUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(this.#timeoutMs)
          });
          return { available: response.ok, latencyMs: Date.now() - startedAt, providerId };
        } catch (error) {
          return {
            available: false,
            error: error instanceof Error ? error.message : String(error),
            providerId
          };
        }
      })
    );
  }

  #applyProbeResults(
    models: ModelEntry[],
    outcomes: PromiseSettledResult<{
      available: boolean;
      providerId: string;
      error?: string;
      latencyMs?: number;
    }>[]
  ): void {
    for (const outcome of outcomes) {
      if (outcome.status !== 'fulfilled') {
        continue;
      }
      const result = outcome.value;
      for (const model of models) {
        if (model.providerId !== result.providerId) {
          continue;
        }
        const entry: ModelAvailability = {
          isAvailable: result.available,
          lastChecked: new Date(),
          modelId: model.id,
          providerId: model.providerId
        };
        if (result.error !== undefined) {
          entry.error = result.error;
        }
        if (result.latencyMs !== undefined) {
          entry.latencyMs = result.latencyMs;
        }
        this.#cache.set(model.id, entry);
      }
    }
  }

  /**
   * Return all models currently marked as available.
   * Excludes models whose replica has an open circuit breaker.
   */
  getAvailableModels(models: ModelEntry[]): ModelEntry[] {
    return models.filter(m => {
      // Skip models with open circuit breakers
      const circuitState = this.getCircuitState(m.id);
      if (circuitState === 'open') {
        return false;
      }

      const entry = this.#cache.get(m.id);
      return entry === undefined || entry.isAvailable;
    });
  }

  /**
   * Return the cached latency for a model, if available.
   */
  getLatency(modelId: string): number | undefined {
    return this.#cache.get(modelId)?.latencyMs;
  }

  /**
   * Return the full availability snapshot for diagnostics.
   */
  getSnapshot(): ModelAvailability[] {
    return [...this.#cache.values()];
  }
}
