/**
 * Tracks model availability via periodic health checks.
 * Results are cached with a configurable TTL so the selector
 * doesn't hammer endpoints on every call.
 *
 * Local models are checked by probing their provider endpoint;
 * cloud models are assumed available unless a check fails.
 */

import type { ModelEntry } from './types.js';

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
}

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 2000;

export class ModelAvailabilityTracker {
  readonly #cache = new Map<string, ModelAvailability>();
  readonly #ttlMs: number;
  readonly #timeoutMs: number;

  constructor(options: AvailabilityTrackerOptions = {}) {
    this.#ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
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
   */
  getAvailableModels(models: ModelEntry[]): ModelEntry[] {
    return models.filter(m => {
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
