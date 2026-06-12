import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultReplicaSelector, type ReplicaSelectionContext } from '../replica-selector.js';
import type { ModelReplica } from '../types.js';

vi.mock('@agentsy/guardrails', () => ({
  evaluateConstraints: vi.fn()
}));

import { evaluateConstraints } from '@agentsy/guardrails';

const mockedEvaluateConstraints = vi.mocked(evaluateConstraints);

function makeReplica(overrides: Partial<ModelReplica> = {}): ModelReplica {
  return {
    id: 'test-replica',
    logicalModelId: 'gpt-4o-mini',
    providerId: 'test-provider',
    upstreamModelName: 'gpt-4o-mini',
    isLocal: false,
    cost: { inputPer1MTokens: 0.15, outputPer1MTokens: 0.6 },
    ...overrides
  };
}

function makeContext(overrides: Partial<ReplicaSelectionContext> = {}): ReplicaSelectionContext {
  return {
    errorRates: new Map(),
    latencies: new Map(),
    localPreference: 'preferred',
    tier: 'small',
    ...overrides
  };
}

describe('DefaultReplicaSelector', () => {
  let selector: DefaultReplicaSelector;

  beforeEach(() => {
    selector = new DefaultReplicaSelector();
    vi.clearAllMocks();
  });

  describe('localPreference: required', () => {
    it('filters to local replicas only', () => {
      const replicas: ModelReplica[] = [
        makeReplica({ id: 'local-1', isLocal: true }),
        makeReplica({ id: 'remote-1', isLocal: false })
      ];

      const result = selector.selectReplica(replicas, makeContext({ localPreference: 'required' }));

      expect(result).toBeDefined();
      expect(result?.id).toBe('local-1');
    });

    it('returns undefined when no local replicas exist', () => {
      const replicas: ModelReplica[] = [
        makeReplica({ id: 'remote-1', isLocal: false }),
        makeReplica({ id: 'remote-2', isLocal: false })
      ];

      const result = selector.selectReplica(replicas, makeContext({ localPreference: 'required' }));

      expect(result).toBeUndefined();
    });
  });

  describe('localPreference: disabled', () => {
    it('filters out local replicas', () => {
      const replicas: ModelReplica[] = [
        makeReplica({ id: 'local-1', isLocal: true }),
        makeReplica({ id: 'remote-1', isLocal: false })
      ];

      const result = selector.selectReplica(replicas, makeContext({ localPreference: 'disabled' }));

      expect(result).toBeDefined();
      expect(result?.id).toBe('remote-1');
    });

    it('returns undefined when all replicas are local', () => {
      const replicas: ModelReplica[] = [
        makeReplica({ id: 'local-1', isLocal: true }),
        makeReplica({ id: 'local-2', isLocal: true })
      ];

      const result = selector.selectReplica(replicas, makeContext({ localPreference: 'disabled' }));

      expect(result).toBeUndefined();
    });
  });

  describe('routingConstraints', () => {
    it('passes replicas that meet constraints, excludes violating ones, populates denials', () => {
      mockedEvaluateConstraints.mockReturnValueOnce({ pass: true, violations: [] }).mockReturnValueOnce({
        pass: false,
        violations: [
          {
            code: 'provider-excluded',
            constraint: { localOnly: true } as import('@agentsy/guardrails').RoutingConstraint,
            details: 'Provider excluded by constraint'
          }
        ]
      });

      const replicas: ModelReplica[] = [
        makeReplica({ id: 'good-replica', providerId: 'allowed-provider' }),
        makeReplica({ id: 'bad-replica', providerId: 'blocked-provider' })
      ];
      const denials: Array<{ code: string; details: string }> = [];

      const result = selector.selectReplica(
        replicas,
        makeContext({
          routingConstraints: { localOnly: true } as import('@agentsy/guardrails').RoutingConstraint,
          modelCapabilities: {
            jsonMode: true,
            reasoning: false,
            tools: true,
            vision: false
          },
          routingConstraintDenials: denials
        })
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe('good-replica');
      expect(denials).toHaveLength(1);
      expect(denials[0]).toStrictEqual({
        code: 'provider-excluded',
        details: 'Provider excluded by constraint'
      });
    });

    it('returns undefined when all replicas are filtered by routing constraints', () => {
      mockedEvaluateConstraints.mockReturnValue({
        pass: false,
        violations: [
          {
            code: 'provider-excluded',
            constraint: { localOnly: true } as import('@agentsy/guardrails').RoutingConstraint,
            details: 'All providers blocked'
          }
        ]
      });

      const replicas: ModelReplica[] = [
        makeReplica({ id: 'r1', providerId: 'p1' }),
        makeReplica({ id: 'r2', providerId: 'p2' })
      ];
      const denials: Array<{ code: string; details: string }> = [];

      const result = selector.selectReplica(
        replicas,
        makeContext({
          routingConstraints: { localOnly: true } as import('@agentsy/guardrails').RoutingConstraint,
          modelCapabilities: {
            jsonMode: true,
            reasoning: false,
            tools: true,
            vision: false
          },
          routingConstraintDenials: denials
        })
      );

      expect(result).toBeUndefined();
      expect(denials).toHaveLength(2);
    });

    it('does not filter when routingConstraints is undefined', () => {
      const replicas: ModelReplica[] = [
        makeReplica({ id: 'r1', providerId: 'p1' }),
        makeReplica({ id: 'r2', providerId: 'p2' })
      ];

      const result = selector.selectReplica(replicas, makeContext({ routingConstraints: undefined } as any));

      expect(result).toBeDefined();
      expect(mockedEvaluateConstraints).not.toHaveBeenCalled();
    });

    it('does not filter when modelCapabilities is undefined', () => {
      mockedEvaluateConstraints.mockReturnValue({
        pass: false,
        violations: [
          {
            code: 'provider-excluded',
            constraint: { localOnly: true } as import('@agentsy/guardrails').RoutingConstraint,
            details: 'should not be reached'
          }
        ]
      });

      const replicas: ModelReplica[] = [makeReplica({ id: 'r1', providerId: 'p1' })];

      const result = selector.selectReplica(
        replicas,
        makeContext({
          routingConstraints: { localOnly: true } as import('@agentsy/guardrails').RoutingConstraint,
          modelCapabilities: undefined
        } as any)
      );

      expect(result).toBeDefined();
      expect(mockedEvaluateConstraints).not.toHaveBeenCalled();
    });
  });

  describe('headroomPercentages', () => {
    it('selects replica with higher headroom when other factors are equal', () => {
      const replicas: ModelReplica[] = [makeReplica({ id: 'low-headroom' }), makeReplica({ id: 'high-headroom' })];
      const headroomPercentages = new Map<string, number>([
        ['low-headroom', 30],
        ['high-headroom', 90]
      ]);

      const result = selector.selectReplica(
        replicas,
        makeContext({
          localPreference: 'disabled',
          headroomPercentages
        })
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe('high-headroom');
    });
  });

  describe('no suitable replica after scoring', () => {
    it('returns undefined when local filter eliminates all candidates', () => {
      const replicas: ModelReplica[] = [makeReplica({ id: 'only-local', isLocal: true })];

      const result = selector.selectReplica(replicas, makeContext({ localPreference: 'disabled' }));

      expect(result).toBeUndefined();
    });
  });
});
