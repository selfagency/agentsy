import { describe, expect, it } from 'vitest';

import type { ReplicaHeadroomSnapshot } from '../quotas/headroom.js';
import { computeReplicaSkew } from './replica-skew.js';

function snapshot(overrides: Partial<ReplicaHeadroomSnapshot> & { replicaId: string }): ReplicaHeadroomSnapshot {
  return {
    logicalModelId: 'gpt-4o-mini',
    providerId: 'test',
    lastUpdatedAt: new Date().toISOString(),
    confidence: 'tokenomics-derived',
    ...overrides
  };
}

describe('computeReplicaSkew', () => {
  it('returns empty array for empty snapshots', () => {
    expect(computeReplicaSkew([])).toEqual([]);
  });

  it('returns even shares for a single replica', () => {
    const signals = computeReplicaSkew([snapshot({ replicaId: 'a', remainingTokensMinute: 500 })]);
    expect(signals).toHaveLength(1);
    expect(signals[0]!.share).toBe(1);
    expect(signals[0]!.isHot).toBe(false);
    expect(signals[0]!.isCold).toBe(false);
  });

  it('detects hot replica with disproportionate headroom', () => {
    const signals = computeReplicaSkew([
      snapshot({ replicaId: 'a', remainingTokensMinute: 900 }),
      snapshot({ replicaId: 'b', remainingTokensMinute: 100 })
    ]);

    const a = signals.find(s => s.replicaId === 'a')!;
    expect(a.share).toBeGreaterThan(0.7);
    expect(a.isHot).toBe(true);
    expect(a.isCold).toBe(false);

    const b = signals.find(s => s.replicaId === 'b')!;
    expect(b.share).toBeLessThan(0.3);
    expect(b.isCold).toBe(true);
  });

  it('treats even distribution as neutral', () => {
    const signals = computeReplicaSkew([
      snapshot({ replicaId: 'a', remainingTokensMinute: 500 }),
      snapshot({ replicaId: 'b', remainingTokensMinute: 500 })
    ]);

    for (const s of signals) {
      expect(s.share).toBe(0.5);
      expect(s.isHot).toBe(false);
      expect(s.isCold).toBe(false);
    }
  });

  it('falls back to tokens hour when minute is unavailable', () => {
    const signals = computeReplicaSkew([
      snapshot({ replicaId: 'a', remainingTokensHour: 800 }),
      snapshot({ replicaId: 'b', remainingTokensHour: 200 })
    ]);

    expect(signals[0]!.share).toBeCloseTo(0.8);
  });

  it('falls back to cost minute when no token data', () => {
    const signals = computeReplicaSkew([
      snapshot({ replicaId: 'a', remainingCostMinute: 3 }),
      snapshot({ replicaId: 'b', remainingCostMinute: 1 })
    ]);

    expect(signals[0]!.share).toBeCloseTo(0.75);
  });
});
