import { parseRateLimitHeaders, type RateLimitInfo } from './header-parser.js';

export interface UsageSnapshot {
  rpmLimit: number;
  rpmRemaining: number;
  tpmLimit: number;
  tpmRemaining: number;
}

/**
 * Tracks per-provider rate-limit usage. Updated from response headers; can
 * be used as a pre-flight check via `canMakeRequest`.
 */
export class UsageTracker {
  readonly #providerId: string;
  #state: RateLimitInfo = {
    rpmLimit: 0,
    rpmRemaining: 0,
    rpmResetSeconds: 0,
    tpmLimit: 0,
    tpmRemaining: 0,
    tpmResetSeconds: 0
  };

  constructor(providerId: string) {
    this.#providerId = providerId;
  }

  /**
   * Update the tracker from response headers.
   */
  parseFromResponse(headers: Headers | Record<string, string>): void {
    this.#state = parseRateLimitHeaders(headers);
  }

  /**
   * Pre-flight check: do we have enough token quota to send `inputTokens`?
   * Unknown limits (0) are treated as permissive.
   */
  canMakeRequest(inputTokens: number): boolean {
    if (this.#state.tpmLimit === 0) {
      return true;
    }
    return this.#state.tpmRemaining >= inputTokens;
  }

  /**
   * Pre-flight check: do we have any remaining RPM quota?
   */
  canMakeRequestByRPM(): boolean {
    if (this.#state.rpmLimit === 0) {
      return true;
    }
    return this.#state.rpmRemaining > 0;
  }

  getSnapshot(): UsageSnapshot {
    return {
      rpmLimit: this.#state.rpmLimit,
      rpmRemaining: this.#state.rpmRemaining,
      tpmLimit: this.#state.tpmLimit,
      tpmRemaining: this.#state.tpmRemaining
    };
  }

  get providerId(): string {
    return this.#providerId;
  }
}

/**
 * Registry of UsageTrackers, indexed by providerId.
 */
export class UsageTrackerRegistry {
  readonly #trackers = new Map<string, UsageTracker>();

  for(providerId: string): UsageTracker {
    let tracker = this.#trackers.get(providerId);
    if (tracker === undefined) {
      tracker = new UsageTracker(providerId);
      this.#trackers.set(providerId, tracker);
    }
    return tracker;
  }

  list(): UsageTracker[] {
    return [...this.#trackers.values()];
  }
}
