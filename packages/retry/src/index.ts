export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  signal?: AbortSignal;
  statusCodes?: number[];
}

/**
 * Type predicate to check if an error has a retryable status code.
 * Errors without a status code are considered retryable (for non-HTTP errors).
 */
export function hasRetryableStatusCode(error: unknown, statusCodes: number[]): boolean {
  if (!error || typeof error !== 'object') return true; // Non-object errors are retryable
  const statusCode =
    (error as { response?: { statusCode?: number }; statusCode?: number }).response?.statusCode ??
    (error as { statusCode?: number }).statusCode;
  // If no status code, it's a generic error and we should retry it
  if (statusCode === undefined) return true;
  // If it has a status code, check if it's in our retryable list
  return statusCodes.includes(statusCode);
}

/**
 * Calculates the retry delay using exponential backoff.
 */
export function calculateRetryDelay(
  attemptCount: number,
  options: {
    initialDelayMs: number;
    backoffMultiplier: number;
    maxDelayMs: number;
  },
): number {
  let delay = options.initialDelayMs * options.backoffMultiplier ** attemptCount;
  if (delay > options.maxDelayMs) delay = options.maxDelayMs;
  return delay;
}

/**
 * Creates a promise that waits for a specified duration or abort signal.
 * Respects CancellationToken/AbortSignal for immediate interruption.
 */
function createDelayPromise(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already aborted immediately
    if (signal?.aborted) {
      reject(new Error('Operation cancelled by signal'));
      return;
    }

    const timer = setTimeout(resolve, delayMs);

    const abortHandler = () => {
      clearTimeout(timer);
      reject(new Error('Operation cancelled by signal'));
    };

    signal?.addEventListener('abort', abortHandler, { once: true });
  });
}

/**
 * Executes a function with retry logic and exponential backoff.
 * Primary export name for the retry utility.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions & { maxAttempts: number }): Promise<T> {
  const maxAttempts = options.maxAttempts;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 60000;
  const backoffMultiplier = options.backoffMultiplier ?? 2;
  const statusCodes = options.statusCodes ?? [429, 500, 502, 503, 504];
  const signal = options.signal;

  let attempt = 0;

  while (true) {
    if (signal?.aborted) {
      throw new Error('Operation cancelled by signal');
    }
    try {
      return await fn();
    } catch (error: unknown) {
      attempt++;
      if (attempt >= maxAttempts) {
        throw error;
      }

      if (signal?.aborted) {
        throw new Error('Operation cancelled by signal');
      }

      // Check for retryable status codes
      if (!hasRetryableStatusCode(error, statusCodes)) {
        throw error;
      }

      const delay = calculateRetryDelay(attempt - 1, {
        initialDelayMs,
        backoffMultiplier,
        maxDelayMs,
      });

      await createDelayPromise(delay, signal);
    }
  }
}

/**
 * Retry utility with backoff support.
 * Alias of withRetry for API compatibility with existing documentation.
 */
export const retryWithBackoff = withRetry;
