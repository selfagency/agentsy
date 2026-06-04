import { describe, expect, it } from 'vitest';

import { ProviderHealthRegistry } from './provider-health-registry.js';

describe('ProviderHealthRegistry', () => {
  it('reports healthy by default', () => {
    const registry = new ProviderHealthRegistry();
    const status = registry.getStatus('openai');

    expect(status.healthy).toBe(true);
    expect(status.circuitState).toBe('closed');
    expect(status.status).toBe('healthy');
    expect(status.uptimeRatio).toBe(1);
    expect(status.requestCount).toBe(0);
  });

  it('opens the circuit after five consecutive failures', () => {
    const registry = new ProviderHealthRegistry();
    for (let i = 0; i < 5; i++) {
      registry.recordFailure('openai', `error ${i}`);
    }

    const status = registry.getStatus('openai');
    expect(status.circuitState).toBe('open');
    expect(status.status).toBe('unhealthy');
    expect(status.healthy).toBe(false);
    expect(status.errorCount).toBe(5);
  });

  it('blocks requests when circuit is open', () => {
    const registry = new ProviderHealthRegistry({ breaker: { failureThreshold: 2 } });

    expect(registry.canRequest('openai')).toBe(true);
    registry.recordFailure('openai');
    registry.recordFailure('openai');

    expect(registry.canRequest('openai')).toBe(false);
  });

  it('recovers when the reset window elapses', () => {
    const registry = new ProviderHealthRegistry({
      breaker: { failureThreshold: 1, resetAfterMs: 10 }
    });

    registry.recordFailure('openai');
    expect(registry.canRequest('openai')).toBe(false);
    expect(registry.canRequest('openai', Date.now() + 11)).toBe(true);
  });

  it('resetCircuit restores closed state', () => {
    const registry = new ProviderHealthRegistry();
    for (let i = 0; i < 5; i++) {
      registry.recordFailure('openai');
    }
    expect(registry.getStatus('openai').circuitState).toBe('open');

    registry.resetCircuit('openai');
    expect(registry.getStatus('openai').circuitState).toBe('closed');
  });

  it('tracks uptime ratio and last error', () => {
    const registry = new ProviderHealthRegistry();
    registry.recordSuccess('openai', 100);
    registry.recordSuccess('openai', 150);
    registry.recordFailure('openai', 'oops');

    const status = registry.getStatus('openai');
    expect(status.successCount).toBe(2);
    expect(status.errorCount).toBe(1);
    expect(status.requestCount).toBe(3);
    expect(status.uptimeRatio).toBeCloseTo(2 / 3);
    expect(status.lastError).toBe('oops');
  });

  it('listProviderIds returns all seen providers', () => {
    const registry = new ProviderHealthRegistry();
    registry.recordSuccess('openai');
    registry.recordFailure('anthropic');

    expect(registry.listProviderIds().sort((a, b) => a.localeCompare(b))).toEqual(['anthropic', 'openai']);
  });
});
