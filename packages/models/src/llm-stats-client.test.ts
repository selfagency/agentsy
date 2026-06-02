import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LLMStatsClient } from './llm-stats-client.js';

describe('LLMStatsClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and caches models per endpoint', async () => {
    const client = new LLMStatsClient({ baseUrl: 'https://example.test', cacheTtlMs: 60_000 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ ok: true }),
      ok: true,
      status: 200
    } as Response);

    await expect(client.fetchModels()).resolves.toEqual({ ok: true });
    await expect(client.fetchModels()).resolves.toEqual({ ok: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('https://example.test/stats/v1/models');
  });

  it('supports distinct endpoint helpers', async () => {
    const client = new LLMStatsClient({ baseUrl: 'https://example.test' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ ok: true }),
      ok: true,
      status: 200
    } as Response);

    await client.fetchScores();
    await client.fetchRankings();
    await client.fetchUpdates();

    expect(fetchSpy).toHaveBeenNthCalledWith(1, 'https://example.test/stats/v1/scores');
    expect(fetchSpy).toHaveBeenNthCalledWith(2, 'https://example.test/stats/v1/rankings');
    expect(fetchSpy).toHaveBeenNthCalledWith(3, 'https://example.test/stats/v1/updates');
  });
});
