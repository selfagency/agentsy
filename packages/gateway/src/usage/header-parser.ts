import { genericHeaderParser } from '../profiles/generic-header-parser.js';

export interface RateLimitInfo {
  rpmLimit: number;
  rpmRemaining: number;
  rpmResetSeconds: number;
  tpmLimit: number;
  tpmRemaining: number;
  tpmResetSeconds: number;
}

const ZERO: RateLimitInfo = {
  rpmLimit: 0,
  rpmRemaining: 0,
  rpmResetSeconds: 0,
  tpmLimit: 0,
  tpmRemaining: 0,
  tpmResetSeconds: 0
};

/**
 * Parses rate-limit headers from major LLM providers. Supports OpenAI,
 * Anthropic, and generic patterns.
 */
export function parseRateLimitHeaders(headers: Headers | Record<string, string>): RateLimitInfo {
  const normalized = genericHeaderParser(headers);

  const intOrZero = (value: string | undefined): number => {
    if (value === undefined || value === '') {
      return 0;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // OpenAI: x-ratelimit-limit-requests, x-ratelimit-remaining-requests, x-ratelimit-reset-requests
  // Anthropic / Meta: similar prefix, sometimes includes -tokens
  const result: RateLimitInfo = {
    rpmLimit: intOrZero(normalized['x-ratelimit-limit-requests'] ?? normalized['x-ratelimit-limit-rpm']),
    rpmRemaining: intOrZero(normalized['x-ratelimit-remaining-requests'] ?? normalized['x-ratelimit-remaining-rpm']),
    rpmResetSeconds: intOrZero(normalized['x-ratelimit-reset-requests'] ?? normalized['x-ratelimit-reset-rpm']),
    tpmLimit: intOrZero(normalized['x-ratelimit-limit-tokens'] ?? normalized['x-ratelimit-limit-tpm']),
    tpmRemaining: intOrZero(normalized['x-ratelimit-remaining-tokens'] ?? normalized['x-ratelimit-remaining-tpm']),
    tpmResetSeconds: intOrZero(normalized['x-ratelimit-reset-tokens'] ?? normalized['x-ratelimit-reset-tpm'])
  };

  if (result.rpmLimit === 0 && result.rpmRemaining === 0 && result.tpmLimit === 0 && result.tpmRemaining === 0) {
    return ZERO;
  }
  return result;
}
