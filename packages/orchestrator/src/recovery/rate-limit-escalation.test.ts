import type { ModelReplica, ReplicaQuotaSnapshot } from '@agentsy/gateway';
import { describe, expect, it } from 'vitest';

import {
  allReplicasRateLimited,
  buildRateLimitMap,
  getUnlimitedReplicas,
  RateLimitExceededError
} from './rate-limit-escalation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseReplica(overrides: Partial<ModelReplica> = {}): ModelReplica {
  return {
    cost: { inputPer1MTokens: 1, outputPer1MTokens: 2 },
    id: overrides.id ?? 'replica-1',
    isLocal: false,
    logicalModelId: overrides.logicalModelId ?? 'model-1',
    providerId: overrides.providerId ?? 'provider-1',
    upstreamModelName: overrides.upstreamModelName ?? 'test-model',
    ...overrides
  };
}

function quotaSnapshot(replicaId: string, overrides: Partial<ReplicaQuotaSnapshot> = {}): ReplicaQuotaSnapshot {
  return {
    confidence: 'header-derived',
    lastUpdatedAt: new Date().toISOString(),
    replicaId,
    remainingTokensMinute: 100,
    remainingRequestsMinute: 50,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// RateLimitExceededError
// ---------------------------------------------------------------------------

describe('RateLimitExceededError', () => {
  it('should create an error with replicaId and message', () => {
    const error = new RateLimitExceededError('replica-1');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Rate limit exceeded for replica "replica-1"');
    expect(error.name).toBe('RateLimitExceededError');
    expect(error.replicaId).toBe('replica-1');
  });

  it('should include retryAfterMs when provided', () => {
    const error = new RateLimitExceededError('replica-1', 5000);
    expect(error.retryAfterMs).toBe(5000);
  });

  it('should omit retryAfterMs when not provided', () => {
    const error = new RateLimitExceededError('replica-1');
    expect(error.retryAfterMs).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildRateLimitMap
// ---------------------------------------------------------------------------

describe('buildRateLimitMap', () => {
  it('should treat replicas with no snapshot as not rate-limited', () => {
    const replicas = [baseReplica({ id: 'r1' }), baseReplica({ id: 'r2' })];
    const map = buildRateLimitMap(replicas, new Map());

    expect(map.get('r1')).toEqual({ isRateLimited: false });
    expect(map.get('r2')).toEqual({ isRateLimited: false });
  });

  it('should mark a replica as rate-limited when tokens are exhausted', () => {
    const replicas = [baseReplica({ id: 'r1' })];
    const snapshots = new Map<string, ReplicaQuotaSnapshot>([
      ['r1', quotaSnapshot('r1', { remainingTokensMinute: 0 })]
    ]);

    const map = buildRateLimitMap(replicas, snapshots);

    expect(map.get('r1')?.isRateLimited).toBe(true);
  });

  it('should mark a replica as rate-limited when requests are exhausted', () => {
    const replicas = [baseReplica({ id: 'r1' })];
    const snapshots = new Map<string, ReplicaQuotaSnapshot>([
      ['r1', quotaSnapshot('r1', { remainingRequestsMinute: 0 })]
    ]);

    const map = buildRateLimitMap(replicas, snapshots);

    expect(map.get('r1')?.isRateLimited).toBe(true);
  });

  it('should not mark a replica as rate-limited when both budgets have headroom', () => {
    const replicas = [baseReplica({ id: 'r1' })];
    const snapshots = new Map<string, ReplicaQuotaSnapshot>([
      ['r1', quotaSnapshot('r1', { remainingTokensMinute: 50, remainingRequestsMinute: 30 })]
    ]);

    const map = buildRateLimitMap(replicas, snapshots);

    expect(map.get('r1')?.isRateLimited).toBe(false);
  });

  it('should include the most granular remaining quota value', () => {
    const replicas = [baseReplica({ id: 'r1' })];
    const snapshots = new Map<string, ReplicaQuotaSnapshot>([
      ['r1', quotaSnapshot('r1', { remainingTokensMinute: 75, remainingRequestsMinute: 40 })]
    ]);

    const map = buildRateLimitMap(replicas, snapshots);

    // remainingTokensMinute (75) is the most granular — numeric comparison wins
    expect(map.get('r1')?.remainingQuota).toBe(75);
  });

  it('should fall back to hourly remaining when minute-level is undefined', () => {
    const replicas = [baseReplica({ id: 'r1' })];
    // Omit minute-level fields entirely to simulate no minute-level data
    const {
      remainingTokensMinute: _tm,
      remainingRequestsMinute: _rm,
      ...snapshotRest
    } = quotaSnapshot('r1', {
      remainingTokensHour: 500
    });
    const snapshots = new Map<string, ReplicaQuotaSnapshot>([['r1', snapshotRest as ReplicaQuotaSnapshot]]);

    const map = buildRateLimitMap(replicas, snapshots);

    expect(map.get('r1')?.remainingQuota).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// getUnlimitedReplicas
// ---------------------------------------------------------------------------

describe('getUnlimitedReplicas', () => {
  it('should return all ids when no replicas are rate-limited', () => {
    const map = new Map<string, { isRateLimited: boolean }>([
      ['r1', { isRateLimited: false }],
      ['r2', { isRateLimited: false }]
    ]);

    const result = getUnlimitedReplicas(map, ['r1', 'r2']);

    expect(result).toEqual(['r1', 'r2']);
  });

  it('should filter out rate-limited replicas', () => {
    const map = new Map<string, { isRateLimited: boolean }>([
      ['r1', { isRateLimited: true }],
      ['r2', { isRateLimited: false }],
      ['r3', { isRateLimited: true }]
    ]);

    const result = getUnlimitedReplicas(map, ['r1', 'r2', 'r3']);

    expect(result).toEqual(['r2']);
  });

  it('should treat missing map entries as unlimited', () => {
    const map = new Map<string, { isRateLimited: boolean }>([['r1', { isRateLimited: true }]]);

    const result = getUnlimitedReplicas(map, ['r1', 'r2']);

    expect(result).toEqual(['r2']);
  });

  it('should return empty array when all replicas are rate-limited', () => {
    const map = new Map<string, { isRateLimited: boolean }>([
      ['r1', { isRateLimited: true }],
      ['r2', { isRateLimited: true }]
    ]);

    const result = getUnlimitedReplicas(map, ['r1', 'r2']);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// allReplicasRateLimited
// ---------------------------------------------------------------------------

describe('allReplicasRateLimited', () => {
  it('should return true when every replica is rate-limited', () => {
    const map = new Map<string, { isRateLimited: boolean }>([
      ['r1', { isRateLimited: true }],
      ['r2', { isRateLimited: true }]
    ]);

    expect(allReplicasRateLimited(map, ['r1', 'r2'])).toBe(true);
  });

  it('should return false when some replicas are not rate-limited', () => {
    const map = new Map<string, { isRateLimited: boolean }>([
      ['r1', { isRateLimited: true }],
      ['r2', { isRateLimited: false }]
    ]);

    expect(allReplicasRateLimited(map, ['r1', 'r2'])).toBe(false);
  });

  it('should return false when the replica set is empty', () => {
    const map = new Map<string, { isRateLimited: boolean }>();

    expect(allReplicasRateLimited(map, [])).toBe(false);
  });

  it('should treat missing map entries as not rate-limited', () => {
    const map = new Map<string, { isRateLimited: boolean }>([['r1', { isRateLimited: true }]]);

    expect(allReplicasRateLimited(map, ['r1', 'r2'])).toBe(false);
  });
});
