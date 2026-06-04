import { describe, expect, it } from 'vitest';

import { createLoadBalancedClient, LoadBalancerConfigSchema, ModelAliasMap, StrategyNameSchema } from '../index.js';

describe('load balancer foundation', () => {
  it('validates config with one provider', () => {
    const result = LoadBalancerConfigSchema.safeParse({
      providers: [{ id: 'openai-1', name: 'OpenAI', provider: 'openai' }],
      strategy: 'adaptive'
    });

    expect(result.success).toBe(true);
  });

  it('exposes model aliases', () => {
    expect(ModelAliasMap.get('gpt-4o')?.openai).toBe('gpt-4o');
  });

  it('creates a routing stub for a single provider', () => {
    const client = createLoadBalancedClient({
      providers: [{ id: 'openai-1', name: 'OpenAI', provider: 'openai' }]
    });

    expect(client.getRoutingState().providerId).toBe('openai-1');
    expect(client.getRoutingState().strategy).toBe('adaptive');
    expect(client.getUsageSnapshot()).toStrictEqual([{ errorRate: 0, providerId: 'openai-1' }]);
  });

  it('creates a noop client for missing providers', () => {
    const client = createLoadBalancedClient({ providers: [] });

    expect(client.getRoutingState()).toMatchObject({
      providerCount: 0,
      providerId: 'unconfigured',
      providerStatus: 'unknown'
    });
    expect(client.getUsageSnapshot()).toStrictEqual([]);
  });

  it('falls back to the first provider when multiple entries exist', () => {
    const client = createLoadBalancedClient({
      providers: [
        { id: 'openai-1', name: 'OpenAI', provider: 'openai' },
        { id: 'anthropic-1', name: 'Anthropic', provider: 'anthropic' }
      ],
      strategy: 'round-robin'
    });

    expect(client.getRoutingState().providerId).toBe('openai-1');
    expect(client.getRoutingState().providerCount).toBe(2);
    expect(client.getRoutingState().strategy).toBe('round-robin');
    expect(client.getUsageSnapshot()).toStrictEqual([
      { errorRate: 0, providerId: 'openai-1' },
      { errorRate: 0, providerId: 'anthropic-1' }
    ]);
  });

  it('rejects invalid strategy names', () => {
    expect(StrategyNameSchema.safeParse('anything-else').success).toBe(false);
  });
});
