import { describe, expect, it, vi } from 'vitest';

import { retry } from './index.js';

describe('retry', () => {
  it('returns the operation result when it succeeds on the first attempt', async () => {
    await expect(retry(async () => 'ok')).resolves.toBe('ok');
  });

  it('retries after a failure and eventually resolves', async () => {
    vi.useFakeTimers();
    try {
      const fn = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('temporary'))
        .mockResolvedValueOnce('ok');
      const operation = retry(fn, { maxAttempts: 3, initialDelay: 10, maxDelay: 10, backoffFactor: 2 });
      const resolution = expect(operation).resolves.toBe('ok');

      await vi.advanceTimersByTimeAsync(10);
      await resolution;
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects after max attempts are exhausted', async () => {
    vi.useFakeTimers();
    try {
      const error = new Error('failed');
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue(error);
      const operation = retry(fn, { maxAttempts: 2, initialDelay: 5, maxDelay: 5, backoffFactor: 2 });
      const rejection = expect(operation).rejects.toBe(error);

      await vi.advanceTimersByTimeAsync(5);
      await rejection;
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
