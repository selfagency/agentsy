import { ProviderErrorCode } from '../types/errors.js';
import { errorToProviderCode } from './error-mapper.js';

/**
 * Options for retryable operations.
 */
export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;

  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;

  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;

  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;

  /** Optional signal to abort retries */
  signal?: AbortSignal;
}

/**
 * Error codes that are retryable.
 */
const RETRYABLE_CODES = new Set<ProviderErrorCode>([
  ProviderErrorCode.RateLimited,
  ProviderErrorCode.Timeout,
  ProviderErrorCode.ConnectionError,
  ProviderErrorCode.InternalError
]);

/**
 * Checks if an error is retryable based on its provider error code.
 */
export function isRetryableError(error: unknown): boolean {
  const code = errorToProviderCode(error);
  return RETRYABLE_CODES.has(code);
}

/**
 * Calculates the delay for a given retry attempt using exponential backoff.
 */
export function calculateRetryDelay(
  attempt: number,
  options: Required<Pick<RetryOptions, 'initialDelayMs' | 'backoffMultiplier' | 'maxDelayMs'>>
): number {
  const delay = options.initialDelayMs * options.backoffMultiplier ** attempt;
  return Math.min(delay, options.maxDelayMs);
}

/**
 * Executes an operation with automatic retry on retryable errors.
 */
export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, initialDelayMs = 1000, backoffMultiplier = 2, maxDelayMs = 30_000, signal } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const isLast = attempt === maxAttempts - 1;
      if (isLast || !isRetryableError(error)) {
        throw error;
      }

      const delay = calculateRetryDelay(attempt, {
        backoffMultiplier,
        initialDelayMs,
        maxDelayMs
      });
      await sleep(delay, signal);
    }
  }

  throw lastError;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (!signal) {
      return;
    }

    const abortHandler = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abortHandler);
      reject(new Error('Operation aborted'));
    };
    signal.addEventListener('abort', abortHandler, { once: true });
  });
}
