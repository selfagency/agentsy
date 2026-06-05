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
    const checks: Promise<void>[] = [];

    for (const model of models) {
      const cached = this.#cache.get(model.id);
      const age = cached === undefined ? Number.POSITIVE_INFINITY : Date.now() - cached.lastChecked.getTime();

      if (age < this.#ttlMs && cached !== undefined) {
        // Fresh cache — only re-probe if currently marked unavailable
        if (!cached.isAvailable) {
          checks.push(this.#probe(model, providerUrls));
        }
        continue;
      }

      // Stale cache or no cache — always re-probe
      checks.push(this.#probe(model, providerUrls));
    }

    await Promise.allSettled(checks);
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

  async #probe(model: ModelEntry, providerUrls: ReadonlyMap<string, string>): Promise<void> {
    const baseUrl = providerUrls.get(model.providerId);
    if (baseUrl === undefined) {
      this.#cache.set(model.id, {
        isAvailable: false,
        lastChecked: new Date(),
        modelId: model.id,
        providerId: model.providerId,
        error: `No base URL for provider: ${model.providerId}`
      });
      return;
    }

    const startedAt = Date.now();
    try {
      const response = await fetch(baseUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(this.#timeoutMs)
      });
      const latencyMs = Date.now() - startedAt;
      this.#cache.set(model.id, {
        isAvailable: response.ok,
        lastChecked: new Date(),
        latencyMs,
        modelId: model.id,
        providerId: model.providerId
      });
    } catch (error) {
      this.#cache.set(model.id, {
        error: error instanceof Error ? error.message : String(error),
        isAvailable: false,
        lastChecked: new Date(),
        modelId: model.id,
        providerId: model.providerId
      });
    }
  }
}
