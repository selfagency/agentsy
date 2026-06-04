import { fromConfig, ProfileRegistry } from '@agentsy/providers/profiles';
import { describe, expect, it } from 'vitest';

import { createLoadBalancedClient, createProviderRegistry } from '../index.js';

describe('load balancer registries', () => {
  it('builds provider profiles from config', () => {
    const profile = fromConfig({
      id: 'openai',
      name: 'OpenAI',
      provider: 'openai',
      headers: { Authorization: 'Bearer test' }
    });

    expect(profile.id).toBe('openai');
    expect(profile.headers.authorization).toBe('Bearer test');
  });

  it('registers and detects profiles', () => {
    const registry = new ProfileRegistry();
    registry.register({
      errorClassifier: () => 'ok',
      headers: { authorization: 'Bearer test' },
      id: 'openai',
      name: 'OpenAI',
      provider: 'openai'
    });

    expect(registry.get('openai')?.name).toBe('OpenAI');
    expect(registry.detectFromHeaders({ Authorization: 'Bearer test' })?.id).toBe('openai');
  });

  it('creates a provider registry from config', () => {
    const registry = createProviderRegistry({
      providers: [{ id: 'openai-1', name: 'OpenAI', provider: 'openai' }]
    });

    expect(registry.get('openai-1')?.providerId).toBe('openai-1');
  });

  it('lists registered providers', () => {
    const registry = createProviderRegistry({
      providers: [
        { id: 'openai-1', name: 'OpenAI', provider: 'openai' },
        { id: 'anthropic-1', name: 'Anthropic', provider: 'anthropic' }
      ]
    });

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list[0]?.providerId).toBe('openai-1');
    expect(list[1]?.providerId).toBe('anthropic-1');
  });

  it('handles unknown provider id', () => {
    const registry = createProviderRegistry({
      providers: [{ id: 'openai-1', name: 'OpenAI', provider: 'openai' }]
    });

    expect(registry.get('unknown')).toBeUndefined();
  });

  it('creates a balanced client with multiple providers', () => {
    const client = createLoadBalancedClient({
      providers: [
        { id: 'openai-1', name: 'OpenAI', provider: 'openai' },
        { id: 'anthropic-1', name: 'Anthropic', provider: 'anthropic' }
      ]
    });

    expect(client.getUsageSnapshot()).toStrictEqual([{ providerId: 'openai-1' }, { providerId: 'anthropic-1' }]);
  });

  it('returns noop client when no providers configured', () => {
    const client = createLoadBalancedClient({ providers: [] });
    const routingState = client.getRoutingState();
    expect(routingState.providerCount).toBe(0);
    expect(routingState.providerId).toBe('unconfigured');
    expect(routingState.strategy).toBe('adaptive');
  });

  it('returns routing state from balanced client', () => {
    const client = createLoadBalancedClient({
      providers: [{ id: 'openai-1', name: 'OpenAI', provider: 'openai' }]
    });

    const state = client.getRoutingState();
    expect(state.providerCount).toBe(1);
    expect(state.providerId).toBe('openai-1');
    expect(state.providerStatus).toBe('healthy');
    expect(state.strategy).toBe('adaptive');
  });

  it('returns empty snapshot from noop client', () => {
    const client = createLoadBalancedClient({ providers: [] });
    expect(client.getUsageSnapshot()).toStrictEqual([]);
  });

  it('handles markProviderHealthy and markProviderUnhealthy without throwing', () => {
    const client = createLoadBalancedClient({
      providers: [{ id: 'openai-1', name: 'OpenAI', provider: 'openai' }]
    });

    expect(() => client.markProviderHealthy('openai-1')).not.toThrow();
    expect(() => client.markProviderUnhealthy('openai-1')).not.toThrow();
  });

  it('handles shutdown without throwing', async () => {
    const client = createLoadBalancedClient({
      providers: [{ id: 'openai-1', name: 'OpenAI', provider: 'openai' }]
    });

    await expect(client.shutdown()).resolves.toBeUndefined();
  });

  it('creates provider registry with baseUrl config', () => {
    const registry = createProviderRegistry({
      providers: [{ id: 'custom', name: 'Custom', provider: 'openai', baseUrl: 'https://custom.example.com' }]
    });

    expect(registry.get('custom')?.providerId).toBe('custom');
  });
});
