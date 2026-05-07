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
  const { maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier, statusCodes, signal } = options;
  const defaults = {
    maxDelayMs: maxDelayMs ?? 60000,
    backoffMultiplier: backoffMultiplier ?? 2,
    statusCodes: statusCodes ?? [429, 500, 502, 503, 504],
  };

  let attempt = 0;

  while (true) {
    checkIfCancelled(signal);

    try {
      return await fn();
    } catch (error: unknown) {
      attempt++;

      checkIfCancelled(signal);

      if (!isRetryableError(error, maxAttempts, attempt, defaults.statusCodes)) {
        throw error;
      }

      const delay = calculateRetryDelay(attempt, {
        initialDelayMs: initialDelayMs ?? 1000,
        backoffMultiplier: defaults.backoffMultiplier,
        maxDelayMs: defaults.maxDelayMs,
      });

      await createDelayPromise(delay, signal);
    }
  }
}

function checkIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Operation cancelled by signal');
  }
}

function isRetryableError(error: unknown, maxAttempts: number, attempt: number, statusCodes: number[]): boolean {
  return attempt < maxAttempts && hasRetryableStatusCode(error, statusCodes);
}

/**
 * Retry utility with backoff support.
 * Alias of withRetry for API compatibility with existing documentation.
 */
export const retryWithBackoff = withRetry;
