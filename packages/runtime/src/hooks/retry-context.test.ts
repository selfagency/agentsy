import { describe, expect, it } from 'vitest';

import { createRetryContext, incrementEscalation, markAttempt, shouldEscalate, shouldRetry } from './retry-context.js';

describe('createRetryContext', () => {
  it('returns default values when called with no arguments', () => {
    const ctx = createRetryContext();

    expect(ctx.maxRetries).toBe(3);
    expect(ctx.retryDelayMs).toBe(1000);
    expect(ctx.attemptedReplicas).toEqual([]);
    expect(ctx.escalationLevel).toBe(0);
  });

  it('returns default values when called with undefined', () => {
    const ctx = createRetryContext();

    expect(ctx.maxRetries).toBe(3);
    expect(ctx.retryDelayMs).toBe(1000);
    expect(ctx.attemptedReplicas).toEqual([]);
    expect(ctx.escalationLevel).toBe(0);
  });

  it('returns default values when called with empty options', () => {
    const ctx = createRetryContext({});

    expect(ctx.maxRetries).toBe(3);
    expect(ctx.retryDelayMs).toBe(1000);
    expect(ctx.attemptedReplicas).toEqual([]);
    expect(ctx.escalationLevel).toBe(0);
  });

  it('overrides maxRetries when provided', () => {
    const ctx = createRetryContext({ maxRetries: 5 });

    expect(ctx.maxRetries).toBe(5);
    expect(ctx.retryDelayMs).toBe(1000);
    expect(ctx.attemptedReplicas).toEqual([]);
    expect(ctx.escalationLevel).toBe(0);
  });

  it('overrides retryDelayMs when provided', () => {
    const ctx = createRetryContext({ retryDelayMs: 200 });

    expect(ctx.maxRetries).toBe(3);
    expect(ctx.retryDelayMs).toBe(200);
    expect(ctx.attemptedReplicas).toEqual([]);
    expect(ctx.escalationLevel).toBe(0);
  });

  it('overrides attemptedReplicas when provided', () => {
    const ctx = createRetryContext({ attemptedReplicas: ['a', 'b'] });

    expect(ctx.maxRetries).toBe(3);
    expect(ctx.retryDelayMs).toBe(1000);
    expect(ctx.attemptedReplicas).toEqual(['a', 'b']);
    expect(ctx.escalationLevel).toBe(0);
  });

  it('overrides escalationLevel when provided', () => {
    const ctx = createRetryContext({ escalationLevel: 2 });

    expect(ctx.maxRetries).toBe(3);
    expect(ctx.retryDelayMs).toBe(1000);
    expect(ctx.attemptedReplicas).toEqual([]);
    expect(ctx.escalationLevel).toBe(2);
  });

  it('overrides multiple options simultaneously', () => {
    const ctx = createRetryContext({
      maxRetries: 1,
      retryDelayMs: 500,
      attemptedReplicas: ['x'],
      escalationLevel: 3
    });

    expect(ctx.maxRetries).toBe(1);
    expect(ctx.retryDelayMs).toBe(500);
    expect(ctx.attemptedReplicas).toEqual(['x']);
    expect(ctx.escalationLevel).toBe(3);
  });
});

describe('shouldRetry', () => {
  it('returns true when attempts are below both limits', () => {
    const ctx = createRetryContext({ maxRetries: 3 });

    expect(shouldRetry(ctx, 5)).toBe(true);
  });

  it('returns true when some attempts made but under both limits', () => {
    const ctx = markAttempt(createRetryContext({ maxRetries: 3 }), 'rep-1');

    expect(shouldRetry(ctx, 5)).toBe(true);
  });

  it('returns false when attemptedReplicas length equals maxRetries', () => {
    const ctx = createRetryContext({ maxRetries: 2, attemptedReplicas: ['a', 'b'] });

    expect(shouldRetry(ctx, 5)).toBe(false);
  });

  it('returns false when attemptedReplicas length exceeds maxRetries', () => {
    const ctx = createRetryContext({ maxRetries: 2, attemptedReplicas: ['a', 'b', 'c'] });

    expect(shouldRetry(ctx, 5)).toBe(false);
  });

  it('returns false when attemptedReplicas length equals replicaCount', () => {
    const ctx = createRetryContext({ attemptedReplicas: ['a', 'b', 'c'] });

    expect(shouldRetry(ctx, 3)).toBe(false);
  });

  it('returns false when attemptedReplicas length exceeds replicaCount', () => {
    const ctx = createRetryContext({ attemptedReplicas: ['a', 'b', 'c', 'd'] });

    expect(shouldRetry(ctx, 3)).toBe(false);
  });

  it('returns false when maxRetries is the binding limit (lower than replicaCount)', () => {
    const ctx = createRetryContext({ maxRetries: 1, attemptedReplicas: ['a'] });

    expect(shouldRetry(ctx, 10)).toBe(false);
  });

  it('returns false when replicaCount is the binding limit (lower than maxRetries)', () => {
    const ctx = createRetryContext({ maxRetries: 10, attemptedReplicas: ['a', 'b'] });

    expect(shouldRetry(ctx, 2)).toBe(false);
  });
});

describe('markAttempt', () => {
  it('appends the replicaId to attemptedReplicas', () => {
    const ctx = createRetryContext();
    const next = markAttempt(ctx, 'rep-1');

    expect(next.attemptedReplicas).toEqual(['rep-1']);
  });

  it('appends to existing attemptedReplicas', () => {
    const ctx = createRetryContext({ attemptedReplicas: ['rep-1'] });
    const next = markAttempt(ctx, 'rep-2');

    expect(next.attemptedReplicas).toEqual(['rep-1', 'rep-2']);
  });

  it('preserves other context properties', () => {
    const ctx = createRetryContext({ maxRetries: 5, retryDelayMs: 3000, escalationLevel: 1 });
    const next = markAttempt(ctx, 'rep-a');

    expect(next.maxRetries).toBe(5);
    expect(next.retryDelayMs).toBe(3000);
    expect(next.escalationLevel).toBe(1);
  });

  it('does not mutate the original context', () => {
    const ctx = createRetryContext({ attemptedReplicas: ['rep-1'] });
    const snapshot = { ...ctx, attemptedReplicas: [...ctx.attemptedReplicas] };

    markAttempt(ctx, 'rep-2');

    expect(ctx.attemptedReplicas).toEqual(snapshot.attemptedReplicas);
    expect(ctx.maxRetries).toBe(snapshot.maxRetries);
    expect(ctx.retryDelayMs).toBe(snapshot.retryDelayMs);
    expect(ctx.escalationLevel).toBe(snapshot.escalationLevel);
  });

  it('returns a distinct object reference', () => {
    const ctx = createRetryContext();
    const next = markAttempt(ctx, 'rep-1');

    expect(next).not.toBe(ctx);
  });
});

describe('shouldEscalate', () => {
  it('returns true when attemptedReplicas length equals maxRetries', () => {
    const ctx = createRetryContext({ maxRetries: 2, attemptedReplicas: ['a', 'b'] });

    expect(shouldEscalate(ctx)).toBe(true);
  });

  it('returns true when attemptedReplicas length exceeds maxRetries', () => {
    const ctx = createRetryContext({ maxRetries: 2, attemptedReplicas: ['a', 'b', 'c'] });

    expect(shouldEscalate(ctx)).toBe(true);
  });

  it('returns false when attemptedReplicas length is less than maxRetries', () => {
    const ctx = createRetryContext({ maxRetries: 5, attemptedReplicas: ['a', 'b'] });

    expect(shouldEscalate(ctx)).toBe(false);
  });

  it('returns false when no attempts have been made', () => {
    const ctx = createRetryContext({ maxRetries: 3 });

    expect(shouldEscalate(ctx)).toBe(false);
  });
});

describe('incrementEscalation', () => {
  it('increases escalationLevel by 1 from zero', () => {
    const ctx = createRetryContext();
    const next = incrementEscalation(ctx);

    expect(next.escalationLevel).toBe(1);
  });

  it('increases escalationLevel by 1 from a non-zero level', () => {
    const ctx = createRetryContext({ escalationLevel: 3 });
    const next = incrementEscalation(ctx);

    expect(next.escalationLevel).toBe(4);
  });

  it('preserves other context properties', () => {
    const ctx = createRetryContext({
      maxRetries: 2,
      retryDelayMs: 500,
      attemptedReplicas: ['a', 'b']
    });
    const next = incrementEscalation(ctx);

    expect(next.maxRetries).toBe(2);
    expect(next.retryDelayMs).toBe(500);
    expect(next.attemptedReplicas).toEqual(['a', 'b']);
  });

  it('does not mutate the original context', () => {
    const ctx = createRetryContext({ escalationLevel: 2 });
    const snapshot = { ...ctx };

    incrementEscalation(ctx);

    expect(ctx.escalationLevel).toBe(snapshot.escalationLevel);
    expect(ctx.maxRetries).toBe(snapshot.maxRetries);
    expect(ctx.retryDelayMs).toBe(snapshot.retryDelayMs);
    expect(ctx.attemptedReplicas).toEqual(snapshot.attemptedReplicas);
  });

  it('returns a distinct object reference', () => {
    const ctx = createRetryContext();
    const next = incrementEscalation(ctx);

    expect(next).not.toBe(ctx);
  });
});
