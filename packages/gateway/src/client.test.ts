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

    expect(client.getUsageSnapshot()).toStrictEqual([
      { errorRate: 0, providerId: 'a' },
      { errorRate: 0, providerId: 'b' }
    ]);
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

  it('records an error rate when a provider is marked unhealthy', () => {
    const client = createLoadBalancedClient({
      providers: [
        { id: 'a', name: 'A', provider: 'openai' },
        { id: 'b', name: 'B', provider: 'anthropic' }
      ]
    });

    client.markProviderUnhealthy('a');
    const snapshot = client.getUsageSnapshot();
    expect(snapshot[0]?.errorRate).toBeGreaterThan(0);
  });

  it('resets the error rate when a provider is marked healthy', () => {
    const client = createLoadBalancedClient({
      providers: [{ id: 'a', name: 'A', provider: 'openai' }]
    });

    client.markProviderUnhealthy('a');
    client.markProviderHealthy('a');
    const snapshot = client.getUsageSnapshot();
    expect(snapshot[0]?.errorRate).toBe(0);
  });

  it('swaps the strategy at runtime via setStrategy', () => {
    const client = createLoadBalancedClient({
      providers: [{ id: 'p1', name: 'P1', provider: 'openai' }],
      strategy: 'round-robin'
    });
    expect(client.getRoutingState().strategy).toBe('round-robin');
    client.setStrategy('cost-based');
    expect(client.getRoutingState().strategy).toBe('cost-based');
  });

  it('setStrategy is a noop on the noop client', () => {
    const client = createLoadBalancedClient({ providers: [] });
    expect(() => client.setStrategy('adaptive')).not.toThrow();
  });
});
