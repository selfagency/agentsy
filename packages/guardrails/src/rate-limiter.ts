import type { GuardrailResult, GuardrailScanner } from './types.js';

/**
 * Time window configuration for rate limiting.
 *
 * @internal
 */
interface RateWindow {
  maxRequests: number;
  windowMs: number;
}

/**
 * Per-key rate limit entry.
 *
 * @internal
 */
interface RateEntry {
  count: number;
  resetAt: number;
}

/**
 * Scanner that enforces per-key rate limits.
 *
 * @remarks
 * Tracks request counts per key within a sliding window. Designed to
 * prevent runaway tool execution and abuse.
 *
 * OWASP: ASI-03 (Excessive Agency)
 */
export class RateLimiterScanner implements GuardrailScanner {
  readonly metadata = {
    id: 'hub://guardrails/rate-limiter',
    name: 'Rate Limiter Scanner',
    version: '1.0.0',
    description: 'Enforces per-key rate limits to prevent runaway tool execution',
    priority: 5,
    owaspCategories: ['asi-03'] as const,
    tags: ['rate-limiting', 'dos-prevention', 'resource-control']
  };

  readonly #entries = new Map<string, RateEntry>();
  readonly #config: RateWindow;

  constructor(config?: Partial<RateWindow>) {
    this.#config = {
      maxRequests: config?.maxRequests ?? 100,
      windowMs: config?.windowMs ?? 60_000
    };
  }

  /**
   * Set a specific rate limit cap for a key (overrides the default maxRequests).
   */
  setLimit(key: string, maxRequests: number): void {
    const existing = this.#entries.get(key);
    this.#entries.set(key, {
      count: existing?.count ?? 0,
      resetAt: existing?.resetAt ?? Date.now() + this.#config.windowMs
    });
    // Store the per-key limit alongside the config default
    this.#customLimits.set(key, maxRequests);
  }

  readonly #customLimits = new Map<string, number>();

  /**
   * Reset the rate counter for a key.
   */
  resetKey(key: string): void {
    this.#entries.delete(key);
    this.#customLimits.delete(key);
  }

  /**
   * Reset all rate counters (alias for resetAll).
   */
  reset(): void {
    this.#entries.clear();
    this.#customLimits.clear();
  }

  /**
   * Reset all rate counters.
   */
  resetAll(): void {
    this.#entries.clear();
    this.#customLimits.clear();
  }

  evaluate(_input: string, context?: Record<string, unknown>): Promise<GuardrailResult> {
    const key = (context?.rateLimitKey as string) ?? (context?.toolName as string) ?? 'default';
    const maxRequests = this.#customLimits.get(key) ?? (context?.rateLimitMax as number) ?? this.#config.maxRequests;
    const now = Date.now();

    let entry = this.#entries.get(key);

    // If no entry or window expired, start fresh
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + this.#config.windowMs };
      this.#entries.set(key, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const resetIn = Math.ceil((entry.resetAt - now) / 1000);
      return Promise.resolve({
        status: 'block',
        phase: 'tool-input',
        reason: `Rate limit exceeded for key "${key}": ${entry.count - maxRequests} over limit (resets in ${resetIn}s)`,
        detections: [
          {
            id: 'rate-limit-exceeded',
            description: `Rate limit exceeded for key "${key}": ${entry.count}/${maxRequests}`,
            severity: 'high'
          }
        ]
      });
    }

    return Promise.resolve({ status: 'pass', phase: 'tool-input' });
  }
}
