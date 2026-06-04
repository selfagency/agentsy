import { describe, expect, it } from 'vitest';

import type { ProviderHealthEntry } from '../health/provider-health-registry.js';
import type { QuotaUsageSnapshot } from '../quota/tracker.js';
import type { ProviderEntry } from '../types.js';

import {
  AdaptiveStrategy,
  CostBasedStrategy,
  createStrategy,
  LatencyBasedStrategy,
  LeastConnectionsStrategy,
  PriorityFallbackStrategy,
  RoundRobinStrategy,
  WeightedStrategy
} from './strategies.js';
import { matchesRequest } from './strategy.js';

const emptyHealth = new Map<string, ProviderHealthEntry>();
const emptyQuota = new Map<string, QuotaUsageSnapshot>();

function entry(id: string, overrides: Partial<ProviderEntry> = {}): ProviderEntry {
  return {
    id,
    name: id,
    provider: 'openai',
    ...overrides
  };
}

describe('matchesRequest', () => {
  it('returns true when no capabilities are declared', () => {
    expect(matchesRequest(entry('a'), { model: 'gpt-4o' })).toBe(true);
  });

  it('drops providers missing required tool calling', () => {
    const tools = entry('a', { capabilities: { supportsTools: true } });
    const plain = entry('b');
    expect(matchesRequest(tools, { model: 'gpt-4o', requires: ['tools'] })).toBe(true);
    expect(matchesRequest(plain, { model: 'gpt-4o', requires: ['tools'] })).toBe(false);
  });

  it('drops providers missing required streaming', () => {
    const streaming = entry('a', { capabilities: { supportsStreaming: true } });
    const plain = entry('b');
    expect(matchesRequest(streaming, { model: 'gpt-4o', requires: ['streaming'] })).toBe(true);
    expect(matchesRequest(plain, { model: 'gpt-4o', requires: ['streaming'] })).toBe(false);
  });

  it('drops providers missing required image (vision) support', () => {
    const vision = entry('a', { capabilities: { supportsImages: true } });
    const plain = entry('b');
    expect(matchesRequest(vision, { model: 'gpt-4o', requires: ['vision'] })).toBe(true);
    expect(matchesRequest(plain, { model: 'gpt-4o', requires: ['vision'] })).toBe(false);
  });
});

describe('RoundRobinStrategy', () => {
  it('rotates through providers', () => {
    const strategy = new RoundRobinStrategy();
    const a = entry('a');
    const b = entry('b');
    const c = entry('c');

    const picks = [
      strategy.select([a, b, c], { health: emptyHealth, quota: emptyQuota, request: {} }),
      strategy.select([a, b, c], { health: emptyHealth, quota: emptyQuota, request: {} }),
      strategy.select([a, b, c], { health: emptyHealth, quota: emptyQuota, request: {} }),
      strategy.select([a, b, c], { health: emptyHealth, quota: emptyQuota, request: {} })
    ];

    expect(picks.map(p => p?.id)).toEqual(['a', 'b', 'c', 'a']);
  });

  it('skips providers with open circuits', () => {
    const strategy = new RoundRobinStrategy();
    const a = entry('a');
    const b = entry('b');
    const health = new Map<string, ProviderHealthEntry>([
      [
        'a',
        {
          averageLatencyMs: undefined,
          circuitState: 'open',
          errorCount: 5,
          healthy: false,
          lastError: undefined,
          requestCount: 5,
          status: 'unhealthy',
          successCount: 0,
          uptimeRatio: 0
        }
      ]
    ]);
    const first = strategy.select([a, b], { health, quota: emptyQuota, request: {} });
    expect(first?.id).toBe('b');
  });
});

describe('WeightedStrategy', () => {
  it('returns the only entry when there is one', () => {
    const strategy = new WeightedStrategy({ a: 5 });
    const result = strategy.select([entry('a')], {
      health: emptyHealth,
      quota: emptyQuota,
      request: {}
    });
    expect(result?.id).toBe('a');
  });

  it('defaults to weight 1 when unconfigured', () => {
    const strategy = new WeightedStrategy({ a: 1000 });
    const result = strategy.select([entry('a'), entry('b')], {
      health: emptyHealth,
      quota: emptyQuota,
      request: {}
    });
    expect(result?.id).toBe('a');
  });
});

describe('LeastConnectionsStrategy', () => {
  it('picks the provider with the smallest in-flight count', () => {
    const strategy = new LeastConnectionsStrategy();
    const inFlight = new Map<string, number>([
      ['a', 5],
      ['b', 1],
      ['c', 3]
    ]);
    const result = strategy.select([entry('a'), entry('b'), entry('c')], {
      health: emptyHealth,
      inFlight,
      quota: emptyQuota,
      request: {}
    });
    expect(result?.id).toBe('b');
  });

  it('falls back to round-robin when inFlight is missing', () => {
    const strategy = new LeastConnectionsStrategy();
    const first = strategy.select([entry('a'), entry('b')], {
      health: emptyHealth,
      quota: emptyQuota,
      request: {}
    });
    const second = strategy.select([entry('a'), entry('b')], {
      health: emptyHealth,
      quota: emptyQuota,
      request: {}
    });
    expect(first?.id).toBe('a');
    expect(second?.id).toBe('b');
  });
});

describe('LatencyBasedStrategy', () => {
  it('picks the provider with the lowest average latency', () => {
    const strategy = new LatencyBasedStrategy();
    const health = new Map<string, ProviderHealthEntry>([
      [
        'a',
        {
          averageLatencyMs: 300,
          circuitState: 'closed',
          errorCount: 0,
          healthy: true,
          lastError: undefined,
          requestCount: 100,
          status: 'healthy',
          successCount: 100,
          uptimeRatio: 1
        }
      ],
      [
        'b',
        {
          averageLatencyMs: 50,
          circuitState: 'closed',
          errorCount: 0,
          healthy: true,
          lastError: undefined,
          requestCount: 100,
          status: 'healthy',
          successCount: 100,
          uptimeRatio: 1
        }
      ]
    ]);
    const result = strategy.select([entry('a'), entry('b')], {
      health,
      quota: emptyQuota,
      request: {}
    });
    expect(result?.id).toBe('b');
  });
});

describe('PriorityFallbackStrategy', () => {
  it('returns the first eligible provider in declared order', () => {
    const strategy = new PriorityFallbackStrategy();
    const health = new Map<string, ProviderHealthEntry>([
      [
        'a',
        {
          averageLatencyMs: undefined,
          circuitState: 'open',
          errorCount: 5,
          healthy: false,
          lastError: undefined,
          requestCount: 5,
          status: 'unhealthy',
          successCount: 0,
          uptimeRatio: 0
        }
      ]
    ]);
    const result = strategy.select([entry('a'), entry('b'), entry('c')], {
      health,
      quota: emptyQuota,
      request: {}
    });
    expect(result?.id).toBe('b');
  });

  it('returns undefined when no provider is eligible', () => {
    const strategy = new PriorityFallbackStrategy();
    expect(strategy.select([], { health: emptyHealth, quota: emptyQuota, request: {} })).toBeUndefined();
  });
});

describe('CostBasedStrategy', () => {
  it('picks the cheapest provider', () => {
    const strategy = new CostBasedStrategy({ a: 0.01, b: 0.005 });
    const result = strategy.select([entry('a'), entry('b')], {
      health: emptyHealth,
      quota: emptyQuota,
      request: {}
    });
    expect(result?.id).toBe('b');
  });

  it('treats unconfigured providers as zero cost', () => {
    const strategy = new CostBasedStrategy({ a: 0.5 });
    const result = strategy.select([entry('a'), entry('b')], {
      health: emptyHealth,
      quota: emptyQuota,
      request: {}
    });
    expect(result?.id).toBe('b');
  });
});

describe('AdaptiveStrategy', () => {
  it('penalises providers with open circuits (already filtered)', () => {
    const strategy = new AdaptiveStrategy();
    const health = new Map<string, ProviderHealthEntry>([
      [
        'a',
        {
          averageLatencyMs: 100,
          circuitState: 'closed',
          errorCount: 0,
          healthy: true,
          lastError: undefined,
          requestCount: 100,
          status: 'healthy',
          successCount: 100,
          uptimeRatio: 1
        }
      ],
      [
        'b',
        {
          averageLatencyMs: 100,
          circuitState: 'closed',
          errorCount: 50,
          healthy: true,
          lastError: undefined,
          requestCount: 100,
          status: 'degraded',
          successCount: 50,
          uptimeRatio: 0.5
        }
      ]
    ]);
    const result = strategy.select([entry('a'), entry('b')], {
      health,
      quota: emptyQuota,
      request: {}
    });
    expect(result?.id).toBe('a');
  });

  it('respects capability filters', () => {
    const strategy = new AdaptiveStrategy();
    const toolsOnly = entry('a', { capabilities: { supportsTools: true } });
    const plain = entry('b');
    const result = strategy.select([toolsOnly, plain], {
      health: emptyHealth,
      quota: emptyQuota,
      request: { requires: ['tools'] }
    });
    expect(result?.id).toBe('a');
  });

  it('returns undefined when no provider matches', () => {
    const strategy = new AdaptiveStrategy();
    const result = strategy.select([entry('a')], {
      health: emptyHealth,
      quota: emptyQuota,
      request: { requires: ['tools'] }
    });
    expect(result).toBeUndefined();
  });

  it('blocks providers with exhausted TPM quota', () => {
    const strategy = new AdaptiveStrategy();
    const quota = new Map<string, QuotaUsageSnapshot>([
      ['a', { rpmLimit: 0, rpmRemaining: 0, tpmLimit: 1000, tpmRemaining: 50 }]
    ]);
    const result = strategy.select([entry('a'), entry('b')], {
      health: emptyHealth,
      quota,
      request: { estimatedInputTokens: 200 }
    });
    expect(result?.id).toBe('b');
  });
});

describe('createStrategy', () => {
  it('returns the named strategy', () => {
    expect(createStrategy('round-robin').name).toBe('round-robin');
    expect(createStrategy('weighted', { weights: {} }).name).toBe('weighted');
    expect(createStrategy('least-connections').name).toBe('least-connections');
    expect(createStrategy('latency').name).toBe('latency');
    expect(createStrategy('priority-fallback').name).toBe('priority-fallback');
    expect(createStrategy('cost-based', { weights: {} }).name).toBe('cost-based');
    expect(createStrategy('adaptive').name).toBe('adaptive');
  });
});
