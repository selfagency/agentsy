import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearLocalProviderDiscoveryCache, discoverLocalProviders } from './index.js';
import { probeOllama } from './ollama.js';
import { probeVllm } from './vllm.js';

vi.mock('./ollama.js', () => ({
  probeOllama: vi.fn()
}));

vi.mock('./vllm.js', () => ({
  probeVllm: vi.fn()
}));

describe('discoverLocalProviders', () => {
  beforeEach(() => {
    clearLocalProviderDiscoveryCache();
    vi.mocked(probeOllama).mockReset();
    vi.mocked(probeVllm).mockReset();
  });

  it('caches successful discovery for 5 minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    vi.mocked(probeOllama).mockResolvedValue({
      available: true,
      models: [{ id: 'llama3', name: 'Llama 3' }]
    });
    vi.mocked(probeVllm).mockResolvedValue({
      available: true,
      models: [{ id: 'qwen2.5', name: 'Qwen 2.5' }]
    });

    const first = await discoverLocalProviders();
    const second = await discoverLocalProviders();

    expect(first).toEqual(second);
    expect(vi.mocked(probeOllama)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(probeVllm)).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('invalidates the cache on probe error', async () => {
    vi.mocked(probeOllama)
      .mockResolvedValueOnce({
        available: true,
        models: [{ id: 'llama3', name: 'Llama 3' }]
      })
      .mockResolvedValueOnce({
        available: false,
        error: 'offline',
        models: []
      });
    vi.mocked(probeVllm).mockResolvedValue({
      available: true,
      models: [{ id: 'qwen2.5', name: 'Qwen 2.5' }]
    });

    const first = await discoverLocalProviders();
    const second = await discoverLocalProviders({ forceRefresh: true });

    expect(first.discovered).toHaveLength(2);
    expect(second.ollama.available).toBe(false);
    expect(vi.mocked(probeOllama)).toHaveBeenCalledTimes(2);
  });
});
