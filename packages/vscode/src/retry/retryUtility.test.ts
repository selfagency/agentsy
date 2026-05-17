import { describe, expect, it, vi } from 'vitest';

import { createMockCancellationToken } from '../test-utils.js';
import { createRetryUtility, RetryUtility } from './retryUtility.js';

describe('Retry Utility', () => {
  const mockCancellationToken = createMockCancellationToken();

  describe(RetryUtility, () => {
    it('should create retry utility instance', () => {
      const utility = new RetryUtility(3, 100, mockCancellationToken);
      expect(utility).toBeInstanceOf(RetryUtility);
      expect(utility.getMaxRetries()).toBe(3);
      expect(utility.getDelayMs()).toBe(100);
      expect(utility.getCancellationToken()).toBe(mockCancellationToken);
    });

    it('should execute successful operation without retry', async () => {
      const utility = new RetryUtility(3, 100, mockCancellationToken);
      const operation = vi.fn().mockResolvedValue('success');

      const result = await utility.executeWithRetry(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should retry failed operation and succeed', async () => {
      const utility = new RetryUtility(3, 10, mockCancellationToken);
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('first failure'))
        .mockRejectedValueOnce(new Error('second failure'))
        .mockResolvedValue('success');

      const result = await utility.executeWithRetry(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw error when max retries exceeded', async () => {
      const utility = new RetryUtility(2, 1, mockCancellationToken);
      const operation = vi.fn().mockRejectedValue(new Error('always fails'));

      await expect(utility.executeWithRetry(operation)).rejects.toThrow('always fails');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback', async () => {
      const utility = new RetryUtility(2, 1, mockCancellationToken);
      const operation = vi.fn().mockRejectedValueOnce(new Error('first failure')).mockResolvedValue('success');

      const onRetry = vi.fn();

      await utility.executeWithRetry(operation, onRetry);

      expect(onRetry).toHaveBeenCalledOnce();
      expect(onRetry.mock.calls[0]?.[0]).toBe(1);
      expect(onRetry.mock.calls[0]?.[1]).toBeInstanceOf(Error);
    });

it('should throw error when cancelled', async () => {
      const cancellingToken = createMockCancellationToken(true);

      const utility = new RetryUtility(3, 100, cancellingToken);
      const operation = vi.fn().mockResolvedValue('success');

      await expect(utility.executeWithRetry(operation)).rejects.toThrow('Operation cancelled');
      expect(operation).not.toHaveBeenCalled();
    });

    it('should stop the delay early when cancellation is requested during backoff', async () => {
      vi.useFakeTimers();

      try {
        const cancellingToken = createMockCancellationToken();
        const utility = new RetryUtility(3, 1000, cancellingToken, 2);
        const operation = vi.fn().mockRejectedValue(new Error('first failure'));

        const result = utility.executeWithRetry(operation);
        await Promise.resolve();
        expect(operation).toHaveBeenCalledOnce();

        cancellingToken.cancel();

        await expect(result).rejects.toThrow('Operation cancelled');
        vi.advanceTimersByTime(1000);
        expect(operation).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe(createRetryUtility, () => {
    it('should create retry utility via factory', () => {
      const utility = createRetryUtility(3, 100, mockCancellationToken);
      expect(utility).toBeInstanceOf(RetryUtility);
      expect(utility.getMaxRetries()).toBe(3);
      expect(utility.getDelayMs()).toBe(100);
      expect(utility.getCancellationToken()).toBe(mockCancellationToken);
    });
  });
});
