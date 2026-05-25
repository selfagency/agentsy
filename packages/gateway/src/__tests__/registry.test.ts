import { describe, expect, it } from 'vitest';

import { createLoadBalancedClient, createProviderRegistry, fromConfig, ProfileRegistry } from '../index.js';

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

  it('creates a balanced client with multiple providers', () => {
    const client = createLoadBalancedClient({
      providers: [
        { id: 'openai-1', name: 'OpenAI', provider: 'openai' },
        { id: 'anthropic-1', name: 'Anthropic', provider: 'anthropic' }
      ]
    });

    expect(client.getUsageSnapshot()).toStrictEqual([{ providerId: 'openai-1' }, { providerId: 'anthropic-1' }]);
  });
});
