export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  signal?: AbortSignal;
  statusCodes?: number[];
}

export function calculateRetryDelay(
  attemptCount: number,
  options: {
    initialDelayMs: number;
    backoffMultiplier: number;
    maxDelayMs: number;
  },
): number {
  let delay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attemptCount);
  if (delay > options.maxDelayMs) delay = options.maxDelayMs;
  return delay;
}

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
    } catch (error: any) {
      attempt++;
      if (attempt > maxAttempts) {
        throw error;
      }

      if (signal?.aborted) {
        throw new Error('Operation cancelled by signal');
      }

      // Check for retryable status codes
      const statusCode = error?.response?.statusCode ?? error?.statusCode;
      if (statusCode !== undefined && !statusCodes.includes(statusCode)) {
        throw error;
      }

      const delay = calculateRetryDelay(attempt - 1, {
        initialDelayMs,
        backoffMultiplier,
        maxDelayMs,
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
