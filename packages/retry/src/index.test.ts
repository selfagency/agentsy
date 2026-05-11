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
});
