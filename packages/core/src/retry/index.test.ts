import { describe, expect, it, vi } from 'vitest';

import { retry } from './index.js';

describe('retry', () => {
  it('returns the operation result when it succeeds on the first attempt', async () => {
    await expect(retry(async () => 'ok')).resolves.toBe('ok');
  });

  it('retries after a failure and eventually resolves', async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce('ok');
    const operation = retry(fn, { maxAttempts: 3, initialDelay: 0, maxDelay: 0, backoffFactor: 2 });

    await expect(operation).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rejects after max attempts are exhausted', async () => {
    const error = new Error('failed');
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(error);
    const operation = retry(fn, { maxAttempts: 2, initialDelay: 0, maxDelay: 0, backoffFactor: 2 });

    await expect(operation).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rejects with a standard AbortError when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(retry(async () => 'ok', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Retry aborted'
    });
  });

  it('stops waiting immediately when aborted during the retry delay', async () => {
    vi.useFakeTimers();

    try {
      const controller = new AbortController();
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('temporary'));
      const operation = retry(fn, {
        maxAttempts: 3,
        initialDelay: 1_000,
        maxDelay: 1_000,
        backoffFactor: 2,
        signal: controller.signal
      });

      await Promise.resolve();
      expect(fn).toHaveBeenCalledTimes(1);

      controller.abort();

      await expect(operation).rejects.toMatchObject({
        name: 'AbortError',
        message: 'Retry aborted'
      });

      vi.advanceTimersByTime(1_000);
      expect(fn).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('caps exponential backoff at maxDelay', async () => {
    vi.useFakeTimers();

    try {
      const fn = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('temporary-1'))
        .mockRejectedValueOnce(new Error('temporary-2'))
        .mockResolvedValueOnce('ok');

      const operation = retry(fn, {
        maxAttempts: 4,
        initialDelay: 100,
        maxDelay: 150,
        backoffFactor: 3
      });

      await Promise.resolve();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(fn).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(149);
      await Promise.resolve();
      expect(fn).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(1);
      await expect(operation).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
