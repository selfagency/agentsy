import { describe, expect, it } from 'vitest';
import { calculateRetryDelay, withRetry } from './index.js';

describe('@agentsy/retry', () => {
  it('calculateRetryDelay respects maxDelay', () => {
    const d1 = calculateRetryDelay(0, { initialDelayMs: 100, backoffMultiplier: 2, maxDelayMs: 500 });
    const d2 = calculateRetryDelay(3, { initialDelayMs: 100, backoffMultiplier: 2, maxDelayMs: 500 });
    expect(d1).toBe(100);
    expect(d2).toBe(500); // 100 * 2^3 = 800 -> capped to 500
  });

  it('withRetry retries then succeeds', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 2) throw new Error('fail once');
      return 'ok';
    };
    const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 2, backoffMultiplier: 2 });
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('withRetry stops after maxAttempts', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new Error('always');
    };
    await expect(
      withRetry(fn, { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 2, backoffMultiplier: 2 }),
    ).rejects.toThrow('always');
    expect(calls).toBe(2);
  });
});
