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
};

export function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, initialDelay = 1000, maxDelay = 30000, backoffFactor = 2 } = options;

  return new Promise((resolve, reject) => {
    let attempt = 0;

    const attemptRetry = async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        attempt++;
        if (attempt >= maxAttempts) {
          reject(error);
        } else {
          const delay = Math.min(initialDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
          setTimeout(attemptRetry, delay);
        }
      }
    };

    attemptRetry();
  });
}
