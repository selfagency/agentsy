import { describe, expect, it } from 'vitest';

import { QuotaTracker, QuotaTrackerRegistry } from './tracker.js';

describe('QuotaTracker', () => {
  it('starts permissive when no headers have been ingested', () => {
    const tracker = new QuotaTracker('openai');

    expect(tracker.canMakeRequest(1000)).toBe(true);
    expect(tracker.getUsageSnapshot()).toStrictEqual({
      rpmLimit: 0,
      rpmRemaining: 0,
      tpmLimit: 0,
      tpmRemaining: 0
    });
  });

  it('parses OpenAI rate-limit headers and updates quota', () => {
    const tracker = new QuotaTracker('openai');
    tracker.parseFromResponse({
      'x-ratelimit-limit-requests': '5000',
      'x-ratelimit-remaining-requests': '4500',
      'x-ratelimit-limit-tokens': '125000',
      'x-ratelimit-remaining-tokens': '100000'
    });

    const snapshot = tracker.getUsageSnapshot();
    expect(snapshot.rpmLimit).toBe(5000);
    expect(snapshot.rpmRemaining).toBe(4500);
    expect(snapshot.tpmLimit).toBe(125_000);
    expect(snapshot.tpmRemaining).toBe(100_000);
  });

  it('supports -rpm / -tpm suffixes (generic providers)', () => {
    const tracker = new QuotaTracker('deepinfra');
    tracker.parseFromResponse({
      'x-ratelimit-limit-rpm': '10000',
      'x-ratelimit-remaining-rpm': '8000',
      'x-ratelimit-limit-tpm': '500000',
      'x-ratelimit-remaining-tpm': '400000'
    });

    const snapshot = tracker.getUsageSnapshot();
    expect(snapshot.rpmLimit).toBe(10_000);
    expect(snapshot.rpmRemaining).toBe(8000);
    expect(snapshot.tpmLimit).toBe(500_000);
    expect(snapshot.tpmRemaining).toBe(400_000);
  });

  it('blocks requests when TPM quota is exhausted', () => {
    const tracker = new QuotaTracker('anthropic');
    tracker.parseFromResponse({
      'x-ratelimit-limit-tokens': '1000',
      'x-ratelimit-remaining-tokens': '100'
    });

    expect(tracker.canMakeRequest(50)).toBe(true);
    expect(tracker.canMakeRequest(500)).toBe(false);
  });
});

describe('QuotaTrackerRegistry', () => {
  it('returns the same tracker for the same provider', () => {
    const registry = new QuotaTrackerRegistry();
    const a = registry.for('openai');
    const b = registry.for('openai');

    expect(a).toBe(b);
  });

  it('returns different trackers for different providers', () => {
    const registry = new QuotaTrackerRegistry();
    const a = registry.for('openai');
    const b = registry.for('anthropic');

    expect(a).not.toBe(b);
    expect(registry.list()).toHaveLength(2);
  });
});
