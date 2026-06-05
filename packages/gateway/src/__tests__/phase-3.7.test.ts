/**
 * Tests for Phase 3.7 new modules: ReplicaRegistry, replica scoring,
 * replica selector, spillover, logical models, and routing constraints.
 */

import { describe, expect, it } from 'vitest';

import { getAllLogicalModels, getLogicalModel, getLogicalModelsByTier } from '../logical-models.js';
import { ReplicaRegistry } from '../replica-registry.js';
import { DefaultReplicaSelector, type ReplicaSelectionContext } from '../replica-selector.js';
import { computeReplicaScore } from '../score/replica-score.js';
import { spillover, spilloverEscalate, spilloverSameReplica, spilloverSameTier } from '../spillover.js';
import type { ModelReplica } from '../types.js';

// =============================================================================
// Fixtures
// =============================================================================

const replicaA: ModelReplica = {
  id: 'openai-main/gpt-4o-mini',
  logicalModelId: 'gpt-4o-mini',
  providerId: 'openai-main',
  upstreamModelName: 'gpt-4o-mini',
  cost: { inputPer1MTokens: 0.15, outputPer1MTokens: 0.6 },
  isLocal: false
};

const replicaB: ModelReplica = {
  id: 'openai-secondary/gpt-4o-mini',
  logicalModelId: 'gpt-4o-mini',
  providerId: 'openai-secondary',
  upstreamModelName: 'gpt-4o-mini',
  cost: { inputPer1MTokens: 0.15, outputPer1MTokens: 0.6 },
  isLocal: false
};

const localReplica: ModelReplica = {
  id: 'ollama/llama3.2:1b',
  logicalModelId: 'llama3.2:1b',
  providerId: 'ollama',
  upstreamModelName: 'llama3.2:1b',
  cost: { inputPer1MTokens: 0, outputPer1MTokens: 0 },
  isLocal: true
};

const expensiveReplica: ModelReplica = {
  id: 'anthropic-main/claude-3-5-sonnet',
  logicalModelId: 'claude-3-5-sonnet',
  providerId: 'anthropic-main',
  upstreamModelName: 'claude-3-5-sonnet-20241022',
  cost: { inputPer1MTokens: 3, outputPer1MTokens: 15 },
  isLocal: false
};

const defaultContext: ReplicaSelectionContext = {
  localPreference: 'preferred',
  latencies: new Map(),
  errorRates: new Map(),
  tier: 'small'
};

// =============================================================================
// LogicalModels
// =============================================================================

describe('LogicalModels', () => {
  it('returns all canonical models', () => {
    const all = getAllLogicalModels();
    expect(all.length).toBeGreaterThanOrEqual(9);
  });

  it('looks up by id', () => {
    const model = getLogicalModel('gpt-4o-mini');
    expect(model).toBeDefined();
    expect(model?.tier).toBe('small');
  });

  it('returns undefined for unknown id', () => {
    expect(getLogicalModel('nonexistent')).toBeUndefined();
  });

  it('filters by tier', () => {
    const micro = getLogicalModelsByTier('micro');
    expect(micro.length).toBeGreaterThanOrEqual(1);
    expect(micro[0]?.tier).toBe('micro');
  });
});

// =============================================================================
// ReplicaRegistry
// =============================================================================

describe('ReplicaRegistry', () => {
  it('registers and retrieves by id', () => {
    const reg = new ReplicaRegistry();
    reg.register(replicaA);
    expect(reg.getById('openai-main/gpt-4o-mini')).toBe(replicaA);
  });

  it('indexes by logical model', () => {
    const reg = new ReplicaRegistry();
    reg.register(replicaA);
    reg.register(replicaB);
    const replicas = reg.getByLogicalModel('gpt-4o-mini');
    expect(replicas).toHaveLength(2);
  });

  it('indexes by provider', () => {
    const reg = new ReplicaRegistry();
    reg.register(replicaA);
    expect(reg.getByProvider('openai-main')).toHaveLength(1);
  });

  it('removes a replica from all indexes', () => {
    const reg = new ReplicaRegistry();
    reg.register(replicaA);
    reg.remove('openai-main/gpt-4o-mini');
    expect(reg.getById('openai-main/gpt-4o-mini')).toBeUndefined();
    expect(reg.getByLogicalModel('gpt-4o-mini')).toHaveLength(0);
    expect(reg.getByProvider('openai-main')).toHaveLength(0);
  });

  it('clears all replicas', () => {
    const reg = new ReplicaRegistry();
    reg.register(replicaA);
    reg.clear();
    expect(reg.getAll()).toHaveLength(0);
  });

  it('returns empty array for unknown logical model', () => {
    const reg = new ReplicaRegistry();
    expect(reg.getByLogicalModel('nope')).toEqual([]);
  });
});

// =============================================================================
// ReplicaScore
// =============================================================================

describe('computeReplicaScore', () => {
  it('applies local bonus for local models', () => {
    const score = computeReplicaScore({
      costInputPer1MTokens: 0,
      errorRate: 0,
      isLocal: true,
      latencyMs: 0,
      tier: 'small'
    });
    // small tier local bonus = 80, minus 0 penalties
    expect(score).toBe(80);
  });

  it('does not apply local bonus when applyLocalBonus is false', () => {
    const score = computeReplicaScore({
      applyLocalBonus: false,
      costInputPer1MTokens: 0,
      errorRate: 0,
      isLocal: true,
      latencyMs: 0,
      tier: 'small'
    });
    expect(score).toBe(0);
  });

  it('penalizes latency', () => {
    const score = computeReplicaScore({
      costInputPer1MTokens: 0,
      errorRate: 0,
      isLocal: false,
      latencyMs: 1000,
      tier: 'small'
    });
    // 0 - (1000 * 0.01) = -10
    expect(score).toBe(-10);
  });

  it('penalizes cost', () => {
    const score = computeReplicaScore({
      costInputPer1MTokens: 10,
      errorRate: 0,
      isLocal: false,
      latencyMs: 0,
      tier: 'small'
    });
    // 0 - (10 * 1.0) = -10
    expect(score).toBe(-10);
  });

  it('penalizes error rate', () => {
    const score = computeReplicaScore({
      costInputPer1MTokens: 0,
      errorRate: 0.5,
      isLocal: false,
      latencyMs: 0,
      tier: 'small'
    });
    // 0 - (0.5 * 5.0) = -2.5
    expect(score).toBe(-2.5);
  });

  it('accepts custom weights', () => {
    const score = computeReplicaScore(
      {
        costInputPer1MTokens: 10,
        errorRate: 0,
        isLocal: false,
        latencyMs: 0,
        tier: 'small'
      },
      { costWeight: 2.0 }
    );
    // 0 - (10 * 2.0) = -20
    expect(score).toBe(-20);
  });
});

// =============================================================================
// ReplicaSelector
// =============================================================================

describe('DefaultReplicaSelector', () => {
  const selector = new DefaultReplicaSelector();

  it('selects the cheapest replica by default', () => {
    const result = selector.selectReplica([expensiveReplica, replicaA], defaultContext);
    expect(result).toBe(replicaA);
  });

  it('prefers local when localPreference=preferred', () => {
    const result = selector.selectReplica([replicaA, localReplica], defaultContext);
    expect(result).toBe(localReplica);
  });

  it('returns undefined when localPreference=required and no local', () => {
    const result = selector.selectReplica([replicaA], { ...defaultContext, localPreference: 'required' });
    expect(result).toBeUndefined();
  });

  it('filters out local when localPreference=disabled', () => {
    const result = selector.selectReplica([replicaA, localReplica], { ...defaultContext, localPreference: 'disabled' });
    expect(result).toBe(replicaA);
  });

  it('returns undefined for empty list', () => {
    const result = selector.selectReplica([], defaultContext);
    expect(result).toBeUndefined();
  });
});

// =============================================================================
// Spillover
// =============================================================================

describe('spillover', () => {
  const reg = new ReplicaRegistry();
  reg.register(replicaA);
  reg.register(replicaB);
  reg.register(localReplica);
  // Register a replica for claude-3-5-haiku so same-tier fallback has a target
  const haikuReplica: ModelReplica = {
    id: 'anthropic-main/claude-3-5-haiku',
    logicalModelId: 'claude-3-5-haiku',
    providerId: 'anthropic-main',
    upstreamModelName: 'claude-3-5-haiku-20241022',
    cost: { inputPer1MTokens: 0.8, outputPer1MTokens: 4 },
    isLocal: false
  };
  reg.register(haikuReplica);

  it('returns the next replica when the first is excluded', () => {
    const result = spilloverSameReplica(
      'gpt-4o-mini',
      reg,
      new DefaultReplicaSelector(),
      defaultContext,
      new Set(['openai-main/gpt-4o-mini'])
    );
    expect(result).toBeDefined();
    expect(result?.replica.id).toBe('openai-secondary/gpt-4o-mini');
  });

  it('returns undefined when all replicas are excluded', () => {
    const result = spilloverSameReplica(
      'gpt-4o-mini',
      reg,
      new DefaultReplicaSelector(),
      defaultContext,
      new Set(['openai-main/gpt-4o-mini', 'openai-secondary/gpt-4o-mini'])
    );
    expect(result).toBeUndefined();
  });

  it('finds a model in the same tier', () => {
    const result = spilloverSameTier(
      'small',
      reg,
      new DefaultReplicaSelector(),
      defaultContext,
      new Set(['gpt-4o-mini'])
    );
    // small tier has gpt-4o-mini and claude-3-5-haiku; gpt-4o-mini excluded
    expect(result).toBeDefined();
  });

  it('escalates to the next tier', () => {
    const result = spilloverEscalate(
      'micro',
      ['micro', 'small', 'mid', 'frontier'],
      reg,
      new DefaultReplicaSelector(),
      defaultContext
    );
    expect(result).toBeDefined();
    expect(result?.reason).toContain('small');
  });

  it('returns undefined when at the end of the escalation chain', () => {
    const result = spilloverEscalate(
      'frontier',
      ['micro', 'small', 'mid', 'frontier'],
      reg,
      new DefaultReplicaSelector(),
      defaultContext
    );
    expect(result).toBeUndefined();
  });

  it('full spillover chain: excludes first replica, finds second', () => {
    const result = spillover('gpt-4o-mini', 'small', reg, new DefaultReplicaSelector(), defaultContext, {
      excludeReplicas: new Set(['openai-main/gpt-4o-mini'])
    });
    expect(result).toBeDefined();
    expect(result?.replica.id).toBe('openai-secondary/gpt-4o-mini');
  });

  it('full spillover chain: excludes all replicas, finds same-tier model', () => {
    const result = spillover('gpt-4o-mini', 'small', reg, new DefaultReplicaSelector(), defaultContext, {
      excludeReplicas: new Set(['openai-main/gpt-4o-mini', 'openai-secondary/gpt-4o-mini'])
    });
    expect(result).toBeDefined();
    expect(result?.replica.logicalModelId).not.toBe('gpt-4o-mini');
  });

  it('does not escalate when allowTierEscalation is false', () => {
    const result = spillover('gpt-4o-mini', 'small', reg, new DefaultReplicaSelector(), defaultContext, {
      allowTierEscalation: false,
      excludeReplicas: new Set(['openai-main/gpt-4o-mini', 'openai-secondary/gpt-4o-mini']),
      excludeModels: new Set(['gpt-4o-mini', 'claude-3-5-haiku'])
    });
    // All small-tier models excluded, but escalation is off
    expect(result).toBeUndefined();
  });
});

// =============================================================================
// Routing constraints
// =============================================================================

import { evaluateConstraints } from '@agentsy/guardrails';

describe('evaluateConstraints', () => {
  const cloudModel = {
    capabilities: { jsonMode: true, reasoning: false, tools: true, vision: false },
    isLocal: false,
    providerId: 'openai'
  };
  const localModel = {
    capabilities: { jsonMode: false, reasoning: false, tools: false, vision: false },
    isLocal: true,
    providerId: 'ollama'
  };

  it('passes when no constraints are set', () => {
    const result = evaluateConstraints({}, cloudModel);
    expect(result.pass).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('fails local-only constraint for cloud model', () => {
    const result = evaluateConstraints({ localOnly: true }, cloudModel);
    expect(result.pass).toBe(false);
    expect(result.violations[0]?.code).toBe('local-only-no-local-available');
  });

  it('passes local-only constraint for local model', () => {
    const result = evaluateConstraints({ localOnly: true }, localModel);
    expect(result.pass).toBe(true);
  });

  it('fails excluded provider', () => {
    const result = evaluateConstraints({ excludeProviders: ['openai'] }, cloudModel);
    expect(result.pass).toBe(false);
    expect(result.violations[0]?.code).toBe('provider-excluded');
  });

  it('fails missing capability', () => {
    const result = evaluateConstraints({ requireReasoning: true }, cloudModel);
    expect(result.pass).toBe(false);
    expect(result.violations[0]?.code).toBe('missing-capability-reasoning');
  });

  it('returns all violations, not just the first', () => {
    const result = evaluateConstraints({ localOnly: true, requireReasoning: true }, cloudModel);
    expect(result.violations).toHaveLength(2);
  });
});
