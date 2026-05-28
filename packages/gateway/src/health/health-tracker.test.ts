import { describe, expect, it, vi } from 'vitest';
import type { CircuitBreakerConfig } from './circuit-breaker.js';
import { HealthTracker } from './health-tracker.js';

describe('HealthTracker', () => {
  describe('constructor', () => {
    it('should initialize with default config', () => {
      const tracker = new HealthTracker();
      const snapshot = tracker.snapshot();

      expect(snapshot.circuitState).toBe('closed');
      expect(snapshot.errorCount).toBe(0);
      expect(snapshot.averageLatencyMs).toBeUndefined();
    });

    it('should use custom circuit breaker config', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        resetAfterMs: 5000
      };
      const tracker = new HealthTracker(config);

      expect(tracker.snapshot().circuitState).toBe('closed');
    });
  });

  describe('recordSuccess', () => {
    it('should reset circuit breaker on success', () => {
      const tracker = new HealthTracker({ failureThreshold: 2 });

      tracker.recordFailure();
      tracker.recordFailure();
      expect(tracker.snapshot().circuitState).toBe('open');

      tracker.recordSuccess();
      expect(tracker.snapshot().circuitState).toBe('closed');
    });

    it('should record latency when provided', () => {
      const tracker = new HealthTracker();

      tracker.recordSuccess(100);
      tracker.recordSuccess(200);
      tracker.recordSuccess(300);

      expect(tracker.snapshot().averageLatencyMs).toBe(200);
    });

    it('should not record latency when undefined', () => {
      const tracker = new HealthTracker();

      tracker.recordSuccess();
      tracker.recordSuccess();

      expect(tracker.snapshot().averageLatencyMs).toBeUndefined();
    });

    it('should handle latency tracking after circuit reset', () => {
      const tracker = new HealthTracker({ failureThreshold: 2 });

      tracker.recordFailure();
      tracker.recordFailure();
      expect(tracker.snapshot().circuitState).toBe('open');

      tracker.recordSuccess(100);
      expect(tracker.snapshot().circuitState).toBe('closed');
      expect(tracker.snapshot().averageLatencyMs).toBe(100);
    });
  });

  describe('recordFailure', () => {
    it('should increment error count', () => {
      const tracker = new HealthTracker();

      tracker.recordFailure();
      tracker.recordFailure();
      tracker.recordFailure();

      expect(tracker.snapshot().errorCount).toBe(3);
    });

    it('should trigger circuit breaker on failure', () => {
      const tracker = new HealthTracker({ failureThreshold: 2 });

      tracker.recordFailure();
      expect(tracker.snapshot().circuitState).toBe('closed');

      tracker.recordFailure();
      expect(tracker.snapshot().circuitState).toBe('open');
    });

    it('should use provided now parameter', () => {
      const tracker = new HealthTracker({ failureThreshold: 2, resetAfterMs: 100 });
      const now = Date.now();

      tracker.recordFailure(now);
      tracker.recordFailure(now);
      expect(tracker.snapshot().circuitState).toBe('open');

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);
      tracker.canRequest(now + 100);
      expect(tracker.snapshot().circuitState).toBe('half-open');
      vi.useRealTimers();
    });

    it('should not record latency on failure', () => {
      const tracker = new HealthTracker();

      tracker.recordSuccess(100);
      tracker.recordFailure();

      expect(tracker.snapshot().averageLatencyMs).toBe(100);
    });
  });

  describe('snapshot', () => {
    it('should return current health state', () => {
      const tracker = new HealthTracker();

      tracker.recordSuccess(100);
      tracker.recordFailure();
      tracker.recordSuccess(200);

      const snapshot = tracker.snapshot();

      expect(snapshot.averageLatencyMs).toBe(150);
      expect(snapshot.circuitState).toBe('closed');
      expect(snapshot.errorCount).toBe(1);
    });

    it('should return undefined latency when no successes', () => {
      const tracker = new HealthTracker();

      tracker.recordFailure();

      const snapshot = tracker.snapshot();

      expect(snapshot.averageLatencyMs).toBeUndefined();
      expect(snapshot.errorCount).toBe(1);
    });

    it('should reflect circuit breaker state', () => {
      const tracker = new HealthTracker({ failureThreshold: 2 });

      tracker.recordFailure();
      tracker.recordFailure();

      const snapshot = tracker.snapshot();
      expect(snapshot.circuitState).toBe('open');

      tracker.recordSuccess();
      const snapshot2 = tracker.snapshot();
      expect(snapshot2.circuitState).toBe('closed');
    });

    it('should track error count independently', () => {
      const tracker = new HealthTracker();

      for (let i = 0; i < 5; i++) {
        tracker.recordFailure();
      }

      expect(tracker.snapshot().errorCount).toBe(5);
    });
  });

  describe('canRequest', () => {
    it('should allow requests when circuit is closed', () => {
      const tracker = new HealthTracker();
      expect(tracker.canRequest()).toBe(true);
    });

    it('should deny requests when circuit is open', () => {
      const tracker = new HealthTracker({ failureThreshold: 2, resetAfterMs: 1000 });

      tracker.recordFailure();
      tracker.recordFailure();
      expect(tracker.canRequest()).toBe(false);
    });

    it('should allow requests when circuit is half-open', () => {
      const tracker = new HealthTracker({ failureThreshold: 2, resetAfterMs: 100 });

      tracker.recordFailure();
      tracker.recordFailure();
      expect(tracker.canRequest()).toBe(false);

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);
      expect(tracker.canRequest()).toBe(true);
      vi.useRealTimers();
    });

    it('should use provided now parameter', () => {
      const tracker = new HealthTracker({ failureThreshold: 2, resetAfterMs: 100 });
      const now = Date.now();

      tracker.recordFailure(now);
      tracker.recordFailure(now);

      expect(tracker.canRequest(now + 50)).toBe(false);
      expect(tracker.canRequest(now + 100)).toBe(true);
    });

    it('should allow requests after success resets circuit', () => {
      const tracker = new HealthTracker({ failureThreshold: 2 });

      tracker.recordFailure();
      tracker.recordFailure();
      expect(tracker.canRequest()).toBe(false);

      tracker.recordSuccess();
      expect(tracker.canRequest()).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should track health over time', () => {
      const tracker = new HealthTracker({ failureThreshold: 3 });

      // Initial state
      expect(tracker.snapshot().circuitState).toBe('closed');
      expect(tracker.snapshot().errorCount).toBe(0);

      // First success
      tracker.recordSuccess(100);
      expect(tracker.snapshot().averageLatencyMs).toBe(100);
      expect(tracker.snapshot().errorCount).toBe(0);

      // First failure
      tracker.recordFailure();
      expect(tracker.snapshot().errorCount).toBe(1);
      expect(tracker.snapshot().circuitState).toBe('closed');

      // Second failure
      tracker.recordFailure();
      expect(tracker.snapshot().errorCount).toBe(2);
      expect(tracker.snapshot().circuitState).toBe('closed');

      // Third failure - circuit opens
      tracker.recordFailure();
      expect(tracker.snapshot().errorCount).toBe(3);
      expect(tracker.snapshot().circuitState).toBe('open');
      expect(tracker.canRequest()).toBe(false);

      // Success closes circuit
      tracker.recordSuccess(150);
      expect(tracker.snapshot().circuitState).toBe('closed');
      expect(tracker.canRequest()).toBe(true);
    });

    it('should handle mixed success and failure', () => {
      const tracker = new HealthTracker({ failureThreshold: 5 });

      tracker.recordSuccess(100);
      tracker.recordFailure();
      tracker.recordSuccess(200);
      tracker.recordFailure();
      tracker.recordSuccess(300);

      expect(tracker.snapshot().averageLatencyMs).toBe(200);
      expect(tracker.snapshot().errorCount).toBe(2);
      expect(tracker.snapshot().circuitState).toBe('closed');
      expect(tracker.canRequest()).toBe(true);
    });

    it('should handle rapid failures', () => {
      const tracker = new HealthTracker({ failureThreshold: 3 });

      tracker.recordFailure();
      tracker.recordFailure();
      tracker.recordFailure();

      expect(tracker.snapshot().circuitState).toBe('open');
      expect(tracker.canRequest()).toBe(false);
      expect(tracker.snapshot().errorCount).toBe(3);
    });

    it('should maintain latency tracking through failures', () => {
      const tracker = new HealthTracker({ failureThreshold: 3 });

      tracker.recordSuccess(100);
      tracker.recordFailure();
      tracker.recordSuccess(200);
      tracker.recordFailure();
      tracker.recordSuccess(300);

      expect(tracker.snapshot().averageLatencyMs).toBe(200);
      expect(tracker.snapshot().errorCount).toBe(2);
    });

    it('should handle circuit breaker timeout', () => {
      const tracker = new HealthTracker({ failureThreshold: 2, resetAfterMs: 100 });

      // Open circuit
      tracker.recordFailure();
      tracker.recordFailure();
      expect(tracker.canRequest()).toBe(false);

      // Wait for timeout
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      // Should allow request in half-open state
      expect(tracker.canRequest()).toBe(true);
      expect(tracker.snapshot().circuitState).toBe('half-open');

      vi.useRealTimers();
    });

    it('should reset error count on success', () => {
      const tracker = new HealthTracker();

      tracker.recordFailure();
      tracker.recordFailure();
      tracker.recordFailure();
      expect(tracker.snapshot().errorCount).toBe(3);

      tracker.recordSuccess();
      expect(tracker.snapshot().errorCount).toBe(3);
    });
  });
});
