import { describe, expect, it } from 'vitest';
import { createLoadBalancedClient } from './client.js';

describe('createLoadBalancedClient (client.ts)', () => {
  it('returns noop client when no providers configured', () => {
    const client = createLoadBalancedClient({ providers: [] });

    expect(client.getRoutingState()).toStrictEqual({
      providerCount: 0,
      providerId: 'unconfigured',
      providerStatus: 'unknown',
      strategy: 'adaptive'
    });
    expect(client.getUsageSnapshot()).toStrictEqual([]);
  });

  it('returns routing state for configured provider', () => {
    const client = createLoadBalancedClient({
      providers: [{ id: 'p1', name: 'P1', provider: 'openai' }]
    });

    const state = client.getRoutingState();
    expect(state.providerCount).toBe(1);
    expect(state.providerId).toBe('p1');
    expect(state.providerStatus).toBe('healthy');
    expect(state.strategy).toBe('adaptive');
  });

  it('returns usage snapshot', () => {
    const client = createLoadBalancedClient({
      providers: [
        { id: 'a', name: 'A', provider: 'openai' },
        { id: 'b', name: 'B', provider: 'anthropic' }
      ]
    });

    expect(client.getUsageSnapshot()).toStrictEqual([{ providerId: 'a' }, { providerId: 'b' }]);
  });

  it('handles markProviderHealthy without throwing', () => {
    const client = createLoadBalancedClient({
      providers: [{ id: 'p1', name: 'P1', provider: 'openai' }]
    });

    expect(() => client.markProviderHealthy('p1')).not.toThrow();
  });

  it('handles markProviderUnhealthy without throwing', () => {
    const client = createLoadBalancedClient({
      providers: [{ id: 'p1', name: 'P1', provider: 'openai' }]
    });

    expect(() => client.markProviderUnhealthy('p1')).not.toThrow();
  });

  it('handles shutdown without throwing', async () => {
    const client = createLoadBalancedClient({
      providers: [{ id: 'p1', name: 'P1', provider: 'openai' }]
    });

    await expect(client.shutdown()).resolves.toBeUndefined();
  });

  it('returns 0 provider count from noop client', () => {
    const client = createLoadBalancedClient({ providers: [] });
    expect(client.getRoutingState().providerCount).toBe(0);
  });
});
