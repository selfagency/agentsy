import { describe, expect, it, vi } from 'vitest';

import type { RecoveryPolicy, RecoveryResult } from './policy.js';
import { RecoveryExecutor } from './policy.js';

function basePolicy(overrides: Partial<RecoveryPolicy> = {}): RecoveryPolicy {
  return {
    retryConfig: {
      maxAttempts: overrides.retryConfig?.maxAttempts ?? 3,
      backoffStrategy: overrides.retryConfig?.backoffStrategy ?? 'linear',
      baseDelayMs: overrides.retryConfig?.baseDelayMs ?? 100,
      maxDelayMs: overrides.retryConfig?.maxDelayMs ?? 5000,
      jitterFraction: overrides.retryConfig?.jitterFraction ?? 0
    },
    fallbacks: overrides.fallbacks ?? [],
    escalationAction: overrides.escalationAction ?? 'fail',
    checkpointRequired: overrides.checkpointRequired ?? false,
    checkpointFrequencyMs: overrides.checkpointFrequencyMs ?? 5000
  };
}

describe('RecoveryExecutor', () => {
  describe('execute - retry loop', () => {
    it('should succeed on the nth attempt when retries eventually succeed', async () => {
      const executor = new RecoveryExecutor(
        basePolicy({
          retryConfig: {
            maxAttempts: 3,
            backoffStrategy: 'fixed',
            baseDelayMs: 5,
            maxDelayMs: 1000,
            jitterFraction: 0
          }
        })
      );

      let callCount = 0;
      const taskFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error(`Attempt ${callCount} failed`));
        }
        return Promise.resolve('success');
      });

      const result = await executor.execute(taskFn, {});
      expect(result.recovered).toBe(true);
      expect(result.attempts).toBe(3);
      expect(callCount).toBe(3);
    });

    it('should fall through to escalation after max retries', async () => {
      const executor = new RecoveryExecutor(
        basePolicy({
          retryConfig: {
            maxAttempts: 2,
            backoffStrategy: 'fixed',
            baseDelayMs: 5,
            maxDelayMs: 1000,
            jitterFraction: 0
          },
          escalationAction: 'escalate'
        })
      );

      const taskFn = vi.fn().mockRejectedValue(new Error('persistent failure'));
      const result = await executor.execute(taskFn, {});

      expect(result.recovered).toBe(false);
      expect(result.attempts).toBe(2);
      expect(result.finalError).toBeDefined();
      expect(result.finalError!.message).toBe('persistent failure');
    });
  });

  describe('calculateBackoff - linear', () => {
    it('should use linear formula: baseDelayMs * (attempt + 1)', () => {
      const executor = new RecoveryExecutor(
        basePolicy({
          retryConfig: {
            maxAttempts: 5,
            backoffStrategy: 'linear',
            baseDelayMs: 100,
            maxDelayMs: 5000,
            jitterFraction: 0
          }
        })
      );

      expect(executor.calculateBackoff(0)).toBe(100); // 100 * 1
      expect(executor.calculateBackoff(1)).toBe(200); // 100 * 2
      expect(executor.calculateBackoff(2)).toBe(300); // 100 * 3
    });
  });

  describe('calculateBackoff - exponential', () => {
    it('should use exponential formula: baseDelayMs * 2^attempt', () => {
      const executor = new RecoveryExecutor(
        basePolicy({
          retryConfig: {
            maxAttempts: 5,
            backoffStrategy: 'exponential',
            baseDelayMs: 100,
            maxDelayMs: 5000,
            jitterFraction: 0
          }
        })
      );

      expect(executor.calculateBackoff(0)).toBe(100); // 100 * 1
      expect(executor.calculateBackoff(1)).toBe(200); // 100 * 2
      expect(executor.calculateBackoff(2)).toBe(400); // 100 * 4
      expect(executor.calculateBackoff(3)).toBe(800); // 100 * 8
    });
  });

  describe('calculateBackoff - fixed', () => {
    it('should return baseDelayMs regardless of attempt number', () => {
      const executor = new RecoveryExecutor(
        basePolicy({
          retryConfig: {
            maxAttempts: 5,
            backoffStrategy: 'fixed',
            baseDelayMs: 250,
            maxDelayMs: 5000,
            jitterFraction: 0
          }
        })
      );

      expect(executor.calculateBackoff(0)).toBe(250);
      expect(executor.calculateBackoff(5)).toBe(250);
      expect(executor.calculateBackoff(100)).toBe(250);
    });
  });

  describe('calculateBackoff - capped at maxDelayMs', () => {
    it('should not exceed maxDelayMs', () => {
      const executor = new RecoveryExecutor(
        basePolicy({
          retryConfig: {
            maxAttempts: 10,
            backoffStrategy: 'exponential',
            baseDelayMs: 1000,
            maxDelayMs: 3000,
            jitterFraction: 0
          }
        })
      );

      // attempt 2: 1000 * 4 = 4000, capped to 3000
      expect(executor.calculateBackoff(2)).toBe(3000);
    });
  });

  describe('calculateBackoff - jitter', () => {
    it('should add variation when jitterFraction > 0', () => {
      // Mock Math.random to produce deterministic jitter
      const origRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.0);

      const executor = new RecoveryExecutor(
        basePolicy({
          retryConfig: {
            maxAttempts: 3,
            backoffStrategy: 'fixed',
            baseDelayMs: 200,
            maxDelayMs: 5000,
            jitterFraction: 0.2
          }
        })
      );

      // When random() returns 0.0: jitter = 200 * 0.2 * (-0.5) = -20
      const withMinJitter = executor.calculateBackoff(0);
      expect(withMinJitter).toBe(180); // 200 - 20

      // When random() returns 1.0: jitter = 200 * 0.2 * 0.5 = 20
      Math.random = vi.fn().mockReturnValue(1.0);
      const withMaxJitter = executor.calculateBackoff(0);
      expect(withMaxJitter).toBe(220); // 200 + 20

      Math.random = origRandom;
    });
  });

  describe('execute - fail escalation', () => {
    it('should throw when escalationAction is "fail"', async () => {
      const executor = new RecoveryExecutor(
        basePolicy({
          retryConfig: {
            maxAttempts: 1,
            backoffStrategy: 'fixed',
            baseDelayMs: 5,
            maxDelayMs: 100,
            jitterFraction: 0
          },
          escalationAction: 'fail'
        })
      );

      const taskFn = vi.fn().mockRejectedValue(new Error('fatal'));
      await expect(executor.execute(taskFn, {})).rejects.toThrow('fatal');
    });
  });

  describe('execute - default escalation', () => {
    it('should return recovered=true when escalationAction is "default"', async () => {
      const executor = new RecoveryExecutor(
        basePolicy({
          retryConfig: {
            maxAttempts: 1,
            backoffStrategy: 'fixed',
            baseDelayMs: 5,
            maxDelayMs: 100,
            jitterFraction: 0
          },
          escalationAction: 'default'
        })
      );

      const result = await executor.execute(vi.fn().mockRejectedValue(new Error('fail')), {});
      expect(result.recovered).toBe(true);
    });
  });
});
