/**
 * @internal
 * Internal retry/backoff utilities (scaffold).
 * Real implementation to be recovered soon.
 */

export type RetryOptions = {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  signal?: AbortSignal;
};

export function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, initialDelay = 1000, maxDelay = 30000, backoffFactor = 2, signal } = options;

  return new Promise((resolve, reject) => {
    let attempt = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };

    // Listen for abort signal
    if (signal) {
      if (signal.aborted) {
        reject(new Error('AbortError: Retry aborted'));
        return;
      }

      signal.addEventListener('abort', () => {
        cleanup();
        reject(new Error('AbortError: Retry aborted'));
      });
    }

    const attemptRetry = async () => {
      try {
        const result = await fn();
        cleanup();
        resolve(result);
      } catch (error) {
        attempt++;
        if (attempt >= maxAttempts) {
          cleanup();
          reject(error);
        } else {
          const delay = Math.min(initialDelay * backoffFactor ** (attempt - 1), maxDelay);
          timeoutId = setTimeout(attemptRetry, delay);
        }
      }
    };

    void attemptRetry();
  });
}
