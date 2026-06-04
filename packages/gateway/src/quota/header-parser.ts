import { genericHeaderParser } from '@agentsy/providers/profiles';

/**
 * Parses rate-limit headers from major LLM providers into a flat record.
 * Supports OpenAI (`x-ratelimit-limit-requests` / `-tokens`), Anthropic
 * (uses the same prefix), and a generic `-rpm` / `-tpm` fallback.
 */
export interface RateLimitHeaderSnapshot {
  rpmLimit: number;
  rpmRemaining: number;
  rpmResetSeconds: number;
  tpmLimit: number;
  tpmRemaining: number;
  tpmResetSeconds: number;
}

const EMPTY: RateLimitHeaderSnapshot = {
  rpmLimit: 0,
  rpmRemaining: 0,
  rpmResetSeconds: 0,
  tpmLimit: 0,
  tpmRemaining: 0,
  tpmResetSeconds: 0
};

/**
 * Parse rate-limit headers from a fetch Response or plain record.
 * Returns the EMPTY snapshot if no relevant headers are present.
 */
export function parseRateLimitHeaders(headers: Headers | Record<string, string>): RateLimitHeaderSnapshot {
  const normalized = genericHeaderParser(headers);

  const intOrZero = (value: string | undefined): number => {
    if (value === undefined || value === '') {
      return 0;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const result: RateLimitHeaderSnapshot = {
    rpmLimit: intOrZero(normalized['x-ratelimit-limit-requests'] ?? normalized['x-ratelimit-limit-rpm']),
    rpmRemaining: intOrZero(normalized['x-ratelimit-remaining-requests'] ?? normalized['x-ratelimit-remaining-rpm']),
    rpmResetSeconds: intOrZero(normalized['x-ratelimit-reset-requests'] ?? normalized['x-ratelimit-reset-rpm']),
    tpmLimit: intOrZero(normalized['x-ratelimit-limit-tokens'] ?? normalized['x-ratelimit-limit-tpm']),
    tpmRemaining: intOrZero(normalized['x-ratelimit-remaining-tokens'] ?? normalized['x-ratelimit-remaining-tpm']),
    tpmResetSeconds: intOrZero(normalized['x-ratelimit-reset-tokens'] ?? normalized['x-ratelimit-reset-tpm'])
  };

  if (result.rpmLimit === 0 && result.rpmRemaining === 0 && result.tpmLimit === 0 && result.tpmRemaining === 0) {
    return EMPTY;
  }
  return result;
}
