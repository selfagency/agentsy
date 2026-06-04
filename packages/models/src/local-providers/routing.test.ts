import { describe, expect, it } from 'vitest';
import { routeLocalProviders } from './routing.js';
import type { LocalProviderDiscoveryResult } from './types.js';

describe('routeLocalProviders', () => {
  it('ranks lower latency local providers higher when preferLocal is set', () => {
    const decisions = routeLocalProviders(
      {
        discovered: [
          { models: [{ id: 'llama3', name: 'Llama 3' }], provider: 'ollama' },
          { models: [{ id: 'qwen2.5', name: 'Qwen 2.5' }], provider: 'vllm' }
        ],
        ollama: { available: true, latencyMs: 80, models: [{ id: 'llama3', name: 'Llama 3' }] },
        vllm: { available: true, latencyMs: 240, models: [{ id: 'qwen2.5', name: 'Qwen 2.5' }] }
      },
      { preferLocal: true }
    );

    expect(decisions[0]?.providerId).toBe('ollama');
    expect(decisions[0]?.fallbackChain).toEqual(['ollama', 'jan', 'vllm']);
    expect(decisions[0]?.rationale).toContain('local-first');
  });

  it('keeps routing deterministic for identical inputs', () => {
    const discovery: LocalProviderDiscoveryResult = {
      discovered: [{ models: [{ id: 'llama3', name: 'Llama 3' }], provider: 'ollama' }],
      ollama: { available: true, latencyMs: 120, models: [{ id: 'llama3', name: 'Llama 3' }] },
      vllm: { available: false, models: [] }
    };

    expect(routeLocalProviders(discovery, { preferLocal: true })).toEqual(
      routeLocalProviders(discovery, { preferLocal: true })
    );
  });
});
