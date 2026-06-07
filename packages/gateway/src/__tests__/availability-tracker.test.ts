/**
 * Tests for ModelAvailabilityTracker — coverage of circuit breaker
 * operations and remaining uncovered code paths.
 */

import { describe, expect, it, vi } from 'vitest';
import { ModelAvailabilityTracker } from '../availability-tracker.js';
import type { ModelEntry } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createModel(id: string, overrides?: Partial<ModelEntry>): ModelEntry {
  return {
    id,
    providerId: 'test',
    modelName: id,
    tier: 'small',
    useCases: ['chat'],
    cost: { inputPer1MTokens: 0, outputPer1MTokens: 0 },
    capabilities: {
      tools: false,
      jsonMode: false,
      vision: false,
      audio: false,
      reasoning: false,
      embeddings: false
    },
    contextWindow: 1000,
    maxOutputTokens: 100,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// recordSuccess
// ---------------------------------------------------------------------------

describe('recordSuccess', () => {
  it('creates a clean circuit breaker entry for a replica', () => {
    const tracker = new ModelAvailabilityTracker();

    tracker.recordSuccess('replica-1');

    const snapshot = tracker.getCircuitBreakerSnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toEqual({
      replicaId: 'replica-1',
      consecutiveFailures: 0,
      state: 'closed'
    });
  });

  it('resets consecutive failures to 0 after previous failures', () => {
    const tracker = new ModelAvailabilityTracker();

    tracker.recordFailure('replica-1');
    tracker.recordFailure('replica-1');

    tracker.recordSuccess('replica-1');

    const snapshot = tracker.getCircuitBreakerSnapshot();
    expect(snapshot[0]?.consecutiveFailures).toBe(0);
    expect(snapshot[0]?.state).toBe('closed');
  });
});

// ---------------------------------------------------------------------------
// recordFailure
// ---------------------------------------------------------------------------

describe('recordFailure', () => {
  it('opens the circuit after the default failure threshold of 5', () => {
    const tracker = new ModelAvailabilityTracker();

    tracker.recordFailure('replica-1');
    tracker.recordFailure('replica-1');
    tracker.recordFailure('replica-1');
    tracker.recordFailure('replica-1');
    tracker.recordFailure('replica-1');

    expect(tracker.getCircuitState('replica-1')).toBe('open');
  });

  it('re-opens the circuit when a failure occurs in half-open state', () => {
    vi.useFakeTimers();
    try {
      const tracker = new ModelAvailabilityTracker({
        circuitFailureThreshold: 3,
        circuitResetAfterMs: 10_000
      });

      // Drive circuit to open
      tracker.recordFailure('replica-1');
      tracker.recordFailure('replica-1');
      tracker.recordFailure('replica-1');
      expect(tracker.getCircuitState('replica-1')).toBe('open');

      // Advance past reset timeout so getCircuitState transitions to half-open
      vi.advanceTimersByTime(10_000);
      expect(tracker.getCircuitState('replica-1')).toBe('half-open');

      // Failure in half-open → re-opens
      tracker.recordFailure('replica-1');
      expect(tracker.getCircuitState('replica-1')).toBe('open');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not open the circuit below the failure threshold', () => {
    const tracker = new ModelAvailabilityTracker();

    // threshold is 5, only record 3 failures
    tracker.recordFailure('replica-1');
    tracker.recordFailure('replica-1');
    tracker.recordFailure('replica-1');

    expect(tracker.getCircuitState('replica-1')).toBe('closed');
  });
});

// ---------------------------------------------------------------------------
// getCircuitState
// ---------------------------------------------------------------------------

describe('getCircuitState', () => {
  it('returns closed for an unknown replica', () => {
    const tracker = new ModelAvailabilityTracker();

    expect(tracker.getCircuitState('unknown')).toBe('closed');
  });

  it('transitions from open to half-open after the reset timeout', () => {
    vi.useFakeTimers();
    try {
      const tracker = new ModelAvailabilityTracker({
        circuitFailureThreshold: 1,
        circuitResetAfterMs: 10_000
      });

      // Open the circuit
      tracker.recordFailure('replica-1');
      expect(tracker.getCircuitState('replica-1')).toBe('open');

      // Before timeout — still open
      vi.advanceTimersByTime(9999);
      expect(tracker.getCircuitState('replica-1')).toBe('open');

      // After timeout — transitions to half-open
      vi.advanceTimersByTime(1);
      expect(tracker.getCircuitState('replica-1')).toBe('half-open');
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// getCircuitBreakerSnapshot
// ---------------------------------------------------------------------------

describe('getCircuitBreakerSnapshot', () => {
  it('returns all circuit breaker entries', () => {
    const tracker = new ModelAvailabilityTracker();

    tracker.recordSuccess('replica-a');
    tracker.recordSuccess('replica-b');
    tracker.recordFailure('replica-c');
    tracker.recordFailure('replica-c');

    const snapshot = tracker.getCircuitBreakerSnapshot();
    expect(snapshot).toHaveLength(3);

    const a = snapshot.find(s => s.replicaId === 'replica-a');
    expect(a).toBeDefined();
    expect(a?.state).toBe('closed');
    expect(a?.consecutiveFailures).toBe(0);

    const b = snapshot.find(s => s.replicaId === 'replica-b');
    expect(b).toBeDefined();
    expect(b?.state).toBe('closed');
    expect(b?.consecutiveFailures).toBe(0);

    const c = snapshot.find(s => s.replicaId === 'replica-c');
    expect(c).toBeDefined();
    expect(c?.state).toBe('closed'); // below threshold
    expect(c?.consecutiveFailures).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getAvailableModels
// ---------------------------------------------------------------------------

describe('getAvailableModels', () => {
  it('excludes models with an open circuit breaker', () => {
    const tracker = new ModelAvailabilityTracker({ circuitFailureThreshold: 1 });

    const modelA = createModel('model-a');
    const modelB = createModel('model-b');

    // Open the circuit for model-a
    tracker.recordFailure('model-a');

    const available = tracker.getAvailableModels([modelA, modelB]);
    expect(available).toHaveLength(1);
    expect(available[0]?.id).toBe('model-b');
  });
});

// ---------------------------------------------------------------------------
// getSnapshot
// ---------------------------------------------------------------------------

describe('getSnapshot', () => {
  it('returns the availability cache snapshot after a probe', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    try {
      const tracker = new ModelAvailabilityTracker();
      const model = createModel('test/model', { providerId: 'provider-x' });

      await tracker.checkAvailability([model], new Map([['provider-x', 'http://localhost:9999']]));

      const snapshot = tracker.getSnapshot();
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0]?.modelId).toBe('test/model');
      expect(snapshot[0]?.providerId).toBe('provider-x');
      expect(snapshot[0]?.isAvailable).toBe(true);
      expect(typeof snapshot[0]?.latencyMs).toBe('number');
      expect(snapshot[0]?.lastChecked).toBeInstanceOf(Date);
      expect(snapshot[0]?.error).toBeUndefined();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
