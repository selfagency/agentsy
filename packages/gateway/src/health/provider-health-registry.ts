import { CircuitBreaker, type CircuitBreakerConfig, type CircuitBreakerState } from './circuit-breaker.js';
import { type HealthSnapshot, HealthTracker } from './health-tracker.js';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ProviderHealthEntry {
  averageLatencyMs: number | undefined;
  circuitState: CircuitBreakerState;
  errorCount: number;
  healthy: boolean;
  lastError: string | undefined;
  requestCount: number;
  status: HealthStatus;
  successCount: number;
  uptimeRatio: number;
}

export interface ProviderHealthRegistryConfig {
  breaker?: CircuitBreakerConfig;
}

/**
 * Tracks health per provider. Maintains uptime, error counts, and a circuit
 * breaker per provider so the gateway can route around persistent failures.
 */
export class ProviderHealthRegistry {
  readonly #config: ProviderHealthRegistryConfig;
  readonly #entries = new Map<string, HealthTrackerEntry>();
  readonly #lastError = new Map<string, string>();
  readonly #startedAt = new Map<string, number>();

  constructor(config: ProviderHealthRegistryConfig = {}) {
    this.#config = config;
  }

  recordSuccess(providerId: string, latencyMs?: number): void {
    const entry = this.#entryFor(providerId);
    entry.tracker.recordSuccess(latencyMs);
    this.#startedAt.set(providerId, Date.now());
  }

  recordFailure(providerId: string, error?: string): void {
    const entry = this.#entryFor(providerId);
    entry.tracker.recordFailure();
    entry.failures += 1;
    if (error !== undefined) {
      this.#lastError.set(providerId, error);
    }
  }

  canRequest(providerId: string, now = Date.now()): boolean {
    return this.#entryFor(providerId).tracker.canRequest(now);
  }

  resetCircuit(providerId: string): void {
    const entry = this.#entries.get(providerId);
    if (entry === undefined) {
      return;
    }
    entry.tracker.recordSuccess();
    entry.failures = 0;
  }

  getStatus(providerId: string): ProviderHealthEntry {
    const entry = this.#entryFor(providerId);
    const snapshot = entry.tracker.snapshot();
    const total = entry.successes + entry.failures;
    const uptimeRatio = total === 0 ? 1 : entry.successes / total;
    return {
      averageLatencyMs: snapshot.averageLatencyMs,
      circuitState: snapshot.circuitState,
      errorCount: snapshot.errorCount,
      healthy: snapshot.circuitState !== 'open',
      lastError: this.#lastError.get(providerId),
      requestCount: total,
      status: deriveStatus(snapshot.circuitState, uptimeRatio),
      successCount: entry.successes,
      uptimeRatio
    };
  }

  listProviderIds(): string[] {
    return [...this.#entries.keys()];
  }

  #entryFor(providerId: string): HealthTrackerEntry {
    let entry = this.#entries.get(providerId);
    if (entry === undefined) {
      entry = {
        failures: 0,
        successes: 0,
        tracker: new HealthTracker(this.#config.breaker)
      };
      this.#entries.set(providerId, entry);
    }
    return entry;
  }
}

interface HealthTrackerEntry {
  failures: number;
  successes: number;
  tracker: HealthTracker;
}

function deriveStatus(state: CircuitBreakerState, uptimeRatio: number): HealthStatus {
  if (state === 'open') {
    return 'unhealthy';
  }
  if (state === 'half-open' || uptimeRatio < 0.9) {
    return 'degraded';
  }
  return 'healthy';
}

export type { CircuitBreakerConfig, HealthSnapshot };
export { CircuitBreaker };
