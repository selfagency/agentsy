/**
 * @internal
 * Internal retry/backoff utilities (scaffold).
 * Real implementation to be recovered soon.
 */

export interface RetryOptions {
  backoffFactor?: number;
  initialDelay?: number;
  maxAttempts?: number;
  maxDelay?: number;
  signal?: AbortSignal;
}

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Retry aborted', 'AbortError');
  }

  const error = new Error('Retry aborted');
  error.name = 'AbortError';
  return error;
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, initialDelay = 1000, maxDelay = 30_000, backoffFactor = 2, signal } = options;

  return new Promise((resolve, reject) => {
    let attempt = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let abortHandler: (() => void) | undefined;

    const cleanup = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }

      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
        abortHandler = undefined;
      }
    };

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback();
    };

    // Listen for abort signal
    if (signal) {
      if (signal.aborted) {
        settle(() => {
          reject(createAbortError());
        });
        return;
      }

      abortHandler = () => {
        settle(() => {
          reject(createAbortError());
        });
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    const attemptRetry = async () => {
      try {
        const result = await fn();
        settle(() => {
          resolve(result);
        });
      } catch (error) {
        if (settled) {
          return;
        }

        attempt++;
        if (attempt >= maxAttempts) {
          settle(() => {
            reject(error);
          });
        } else {
          const delay = Math.min(initialDelay * backoffFactor ** (attempt - 1), maxDelay);
          timeoutId = setTimeout(() => {
            attemptRetry().catch(() => {
              // Retry errors are handled internally
            });
          }, delay);
        }
      }
    };

    attemptRetry().catch(() => {
      // Initial retry errors are handled internally
    });
  });
}
