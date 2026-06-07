import { describe, expect, it } from 'vitest';

import { ReplicaRegistry } from '../replica-registry.js';

function makeReplica(
  overrides: Partial<{
    id: string;
    logicalModelId: string;
    providerId: string;
    upstreamModelName: string;
    isLocal: boolean;
    cost: { inputPer1MTokens: number; outputPer1MTokens: number };
  }> = {}
) {
  return {
    id: overrides.id ?? 'r1',
    logicalModelId: overrides.logicalModelId ?? 'lm-1',
    providerId: overrides.providerId ?? 'p-1',
    upstreamModelName: overrides.upstreamModelName ?? 'model-v1',
    isLocal: overrides.isLocal ?? false,
    cost: overrides.cost ?? { inputPer1MTokens: 1, outputPer1MTokens: 2 }
  };
}

describe('ReplicaRegistry', () => {
  it('register assigns active phase by default', () => {
    const registry = new ReplicaRegistry();
    const replica = makeReplica({ id: 'r1' });
    registry.register(replica);

    expect(registry.getPhase('r1')).toBe('active');
  });

  it('register accepts explicit phase', () => {
    const registry = new ReplicaRegistry();
    const replica = makeReplica({ id: 'r2' });
    registry.register(replica, 'draining');

    expect(registry.getPhase('r2')).toBe('draining');
  });

  it('getById returns registered replica', () => {
    const registry = new ReplicaRegistry();
    const replica = makeReplica({ id: 'r1' });
    registry.register(replica);

    expect(registry.getById('r1')).toStrictEqual(replica);
  });

  it('getById returns undefined for unknown', () => {
    const registry = new ReplicaRegistry();

    expect(registry.getById('nobody')).toBeUndefined();
  });

  it('getByLogicalModel returns replicas for a logical model', () => {
    const registry = new ReplicaRegistry();
    const a = makeReplica({ id: 'a', logicalModelId: 'lm-1' });
    const b = makeReplica({ id: 'b', logicalModelId: 'lm-1' });
    const c = makeReplica({ id: 'c', logicalModelId: 'lm-2' });
    registry.register(a);
    registry.register(b);
    registry.register(c);

    const result = registry.getByLogicalModel('lm-1');
    expect(result).toHaveLength(2);
    expect(result).toStrictEqual([a, b]);
  });

  it('getByProvider returns replicas for a provider', () => {
    const registry = new ReplicaRegistry();
    const a = makeReplica({ id: 'a', providerId: 'p-1' });
    const b = makeReplica({ id: 'b', providerId: 'p-1' });
    const c = makeReplica({ id: 'c', providerId: 'p-2' });
    registry.register(a);
    registry.register(b);
    registry.register(c);

    const result = registry.getByProvider('p-1');
    expect(result).toHaveLength(2);
    expect(result).toStrictEqual([a, b]);
  });

  it('getAll returns all registered replicas', () => {
    const registry = new ReplicaRegistry();
    const a = makeReplica({ id: 'a' });
    const b = makeReplica({ id: 'b' });
    registry.register(a);
    registry.register(b);

    expect(registry.getAll()).toHaveLength(2);
    expect(registry.getAll()).toStrictEqual([a, b]);
  });

  it('getByPhase returns active replicas', () => {
    const registry = new ReplicaRegistry();
    const a = makeReplica({ id: 'a' });
    const b = makeReplica({ id: 'b', logicalModelId: 'lm-2' });
    registry.register(a);
    registry.register(b, 'draining');

    const active = registry.getByPhase('active');
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe('a');
  });

  it('getByPhase returns draining replicas', () => {
    const registry = new ReplicaRegistry();
    const a = makeReplica({ id: 'a' });
    const b = makeReplica({ id: 'b', logicalModelId: 'lm-2' });
    registry.register(a, 'draining');
    registry.register(b);

    const draining = registry.getByPhase('draining');
    expect(draining).toHaveLength(1);
    expect(draining[0]?.id).toBe('a');
  });

  it('getPhase returns registered phase', () => {
    const registry = new ReplicaRegistry();
    const replica = makeReplica({ id: 'r1' });
    registry.register(replica, 'standby');

    expect(registry.getPhase('r1')).toBe('standby');
  });

  it('getPhase defaults to active for unknown', () => {
    const registry = new ReplicaRegistry();

    expect(registry.getPhase('nobody')).toBe('active');
  });

  it('setPhase changes phase for existing replica', () => {
    const registry = new ReplicaRegistry();
    const replica = makeReplica({ id: 'r1' });
    registry.register(replica);

    registry.setPhase('r1', 'draining');

    expect(registry.getPhase('r1')).toBe('draining');
  });

  it('setPhase is no-op for unknown id', () => {
    const registry = new ReplicaRegistry();
    registry.setPhase('nobody', 'draining');

    expect(registry.getPhase('nobody')).toBe('active');
  });

  it('getHealthyReplicasForModel excludes draining replicas', () => {
    const registry = new ReplicaRegistry();
    const a = makeReplica({ id: 'a', logicalModelId: 'lm-1' });
    const b = makeReplica({ id: 'b', logicalModelId: 'lm-1' });
    const c = makeReplica({ id: 'c', logicalModelId: 'lm-1' });
    registry.register(a, 'active');
    registry.register(b, 'draining');
    registry.register(c, 'standby');

    const healthy = registry.getHealthyReplicasForModel('lm-1');
    expect(healthy).toHaveLength(2);
    expect(healthy.map(r => r.id).sort((a, b) => a.localeCompare(b))).toStrictEqual(['a', 'c']);
  });

  it('remove deletes from all indexes', () => {
    const registry = new ReplicaRegistry();
    const replica = makeReplica({ id: 'r1', logicalModelId: 'lm-1', providerId: 'p-1' });
    registry.register(replica);

    registry.remove('r1');

    expect(registry.getById('r1')).toBeUndefined();
    expect(registry.getByLogicalModel('lm-1')).toHaveLength(0);
    expect(registry.getByProvider('p-1')).toHaveLength(0);
    expect(registry.getPhase('r1')).toBe('active');
  });

  it('remove is no-op for unknown id', () => {
    const registry = new ReplicaRegistry();
    const replica = makeReplica({ id: 'r1' });
    registry.register(replica);

    registry.remove('nobody');

    expect(registry.getAll()).toHaveLength(1);
    expect(registry.getById('r1')).toStrictEqual(replica);
  });

  it('clear empties everything', () => {
    const registry = new ReplicaRegistry();
    registry.register(makeReplica({ id: 'a', logicalModelId: 'lm-1', providerId: 'p-1' }));
    registry.register(makeReplica({ id: 'b', logicalModelId: 'lm-2', providerId: 'p-2' }));

    registry.clear();

    expect(registry.getAll()).toHaveLength(0);
    expect(registry.getByLogicalModel('lm-1')).toHaveLength(0);
    expect(registry.getByProvider('p-1')).toHaveLength(0);
    expect(registry.getPhase('a')).toBe('active');
  });
});
