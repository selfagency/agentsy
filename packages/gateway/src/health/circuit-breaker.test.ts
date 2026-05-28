import { describe, expect, it, vi } from 'vitest';
import { CircuitBreaker, type CircuitBreakerConfig } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const breaker = new CircuitBreaker();
      expect(breaker.state).toBe('closed');
    });

    it('should use custom config when provided', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        resetAfterMs: 10_000
      };
      const breaker = new CircuitBreaker(config);
      expect(breaker.state).toBe('closed');
    });
  });

  describe('state getter', () => {
    it('should return initial closed state', () => {
      const breaker = new CircuitBreaker();
      expect(breaker.state).toBe('closed');
    });

    it('should return open state after threshold failures', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe('open');
    });

    it('should return half-open state after reset timeout', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 100 });
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe('open');

      // Wait for reset timeout
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);
      breaker.canRequest();
      expect(breaker.state).toBe('half-open');
      vi.useRealTimers();
    });
  });

  describe('recordSuccess', () => {
    it('should reset to closed state', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe('open');

      breaker.recordSuccess();
      expect(breaker.state).toBe('closed');
    });

    it('should reset failure count', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 5 });
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      breaker.recordSuccess();
      breaker.recordFailure();
      expect(breaker.state).toBe('closed');
    });

    it('should reset openedAt timestamp', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const now = Date.now();
      breaker.recordFailure(now);
      breaker.recordFailure(now);
      expect(breaker.state).toBe('open');

      breaker.recordSuccess();
      expect(breaker.state).toBe('closed');
    });
  });

  describe('recordFailure', () => {
    it('should increment failure count', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 5 });
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // State should still be closed under threshold
      expect(breaker.state).toBe('closed');
    });

    it('should open circuit after threshold failures', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe('closed');

      breaker.recordFailure();
      expect(breaker.state).toBe('open');
    });

    it('should use default threshold of 5', () => {
      const breaker = new CircuitBreaker();
      for (let i = 0; i < 4; i++) {
        breaker.recordFailure();
      }
      expect(breaker.state).toBe('closed');

      breaker.recordFailure();
      expect(breaker.state).toBe('open');
    });

    it('should record openedAt timestamp when opening', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const now = Date.now();
      breaker.recordFailure(now);
      breaker.recordFailure(now);
      expect(breaker.state).toBe('open');
    });

    it('should use current time when now not provided', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe('open');
    });
  });

  describe('canRequest', () => {
    it('should allow requests when closed', () => {
      const breaker = new CircuitBreaker();
      expect(breaker.canRequest()).toBe(true);
    });

    it('should allow requests when half-open', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 100 });
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe('open');

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);
      expect(breaker.canRequest()).toBe(true);
      expect(breaker.state).toBe('half-open');
      vi.useRealTimers();
    });

    it('should deny requests when open and timeout not elapsed', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 1000 });
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe('open');

      expect(breaker.canRequest()).toBe(false);
    });

    it('should allow requests when open and timeout elapsed', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 100 });
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe('open');

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);
      expect(breaker.canRequest()).toBe(true);
      expect(breaker.state).toBe('half-open');
      vi.useRealTimers();
    });

    it('should use default reset timeout of 30 seconds', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const now = Date.now();
      breaker.recordFailure(now);
      breaker.recordFailure(now);
      expect(breaker.state).toBe('open');

      expect(breaker.canRequest(now + 29_999)).toBe(false);
      expect(breaker.canRequest(now + 30_000)).toBe(true);
    });

    it('should use custom reset timeout', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 50 });
      const now = Date.now();
      breaker.recordFailure(now);
      breaker.recordFailure(now);
      expect(breaker.state).toBe('open');

      expect(breaker.canRequest(now + 49)).toBe(false);
      expect(breaker.canRequest(now + 50)).toBe(true);
    });

    it('should use provided now parameter', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 100 });
      const now = Date.now();
      breaker.recordFailure(now);
      breaker.recordFailure(now);
      expect(breaker.state).toBe('open');

      // Before timeout
      expect(breaker.canRequest(now + 50)).toBe(false);

      // After timeout
      expect(breaker.canRequest(now + 100)).toBe(true);
    });
    it('should transition to half-open on first allowed request after timeout', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 100 });
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe('open');

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);
      breaker.canRequest();
      expect(breaker.state).toBe('half-open');
      vi.useRealTimers();
    });
  });

  describe('integration scenarios', () => {
    it('should handle success after half-open', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 100 });

      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe('open');

      // Wait for timeout
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      // First request after timeout (half-open)
      expect(breaker.canRequest()).toBe(true);
      expect(breaker.state).toBe('half-open');

      // Success should close circuit
      breaker.recordSuccess();
      expect(breaker.state).toBe('closed');
      expect(breaker.canRequest()).toBe(true);

      vi.useRealTimers();
    });

    it('should handle failure after half-open', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 100 });

      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe('open');

      // Wait for timeout
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      // First request after timeout (half-open)
      expect(breaker.canRequest()).toBe(true);
      expect(breaker.state).toBe('half-open');

      // Failure should open circuit again
      breaker.recordFailure();
      expect(breaker.state).toBe('open');

      vi.useRealTimers();
    });

    it('should handle multiple cycles', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetAfterMs: 50 });

      // First cycle
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe('open');

      vi.useFakeTimers();
      vi.advanceTimersByTime(50);
      breaker.canRequest();
      breaker.recordSuccess();
      expect(breaker.state).toBe('closed');

      // Second cycle
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe('open');

      vi.useRealTimers();
    });
  });
});
