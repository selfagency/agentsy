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

function runRetryLoop<T>(
  fn: () => Promise<T>,
  signal: AbortSignal | undefined,
  maxAttempts: number,
  initialDelay: number,
  backoffFactor: number,
  maxDelay: number,
  resolve: (value: T | PromiseLike<T>) => void,
  reject: (reason: unknown) => void
): void {
  const attempt = 0;
  let settled = false;

  const settle = (callback: () => void) => {
    if (settled) {
      return;
    }
    settled = true;
    callback();
  };

  runAttempt(fn, signal, maxAttempts, initialDelay, backoffFactor, maxDelay, resolve, reject, settle, attempt, -1);
}

async function runAttempt<T>(
  fn: () => Promise<T>,
  signal: AbortSignal | undefined,
  maxAttempts: number,
  initialDelay: number,
  backoffFactor: number,
  maxDelay: number,
  resolve: (value: T | PromiseLike<T>) => void,
  reject: (reason: unknown) => void,
  settle: (callback: () => void) => void,
  attempt: number,
  _delayMs: number
): Promise<void> {
  try {
    const result = await fn();
    settle(() => resolve(result));
  } catch (error) {
    const nextAttempt = attempt + 1;
    if (nextAttempt >= maxAttempts) {
      settle(() => reject(error));
    } else {
      const delay = Math.min(initialDelay * backoffFactor ** nextAttempt, maxDelay);
      setTimeout(() => {
        runAttempt(
          fn,
          signal,
          maxAttempts,
          initialDelay,
          backoffFactor,
          maxDelay,
          resolve,
          reject,
          settle,
          nextAttempt,
          delay
        );
      }, delay);
    }
  }
}

export function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, initialDelay = 1000, maxDelay = 30_000, backoffFactor = 2, signal } = options;

  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  let abortHandler: (() => void) | undefined;
  let abortSignal: AbortSignal | undefined;

  return new Promise((resolve, reject) => {
    if (signal) {
      abortHandler = () => reject(createAbortError());
      abortSignal = signal;
      abortSignal.addEventListener('abort', abortHandler, { once: true });
    }

    runRetryLoop(fn, signal, maxAttempts, initialDelay, backoffFactor, maxDelay, resolve, reject);
  }).finally(() => {
    if (abortHandler && abortSignal) {
      abortSignal.removeEventListener('abort', abortHandler);
    }
  });
}
