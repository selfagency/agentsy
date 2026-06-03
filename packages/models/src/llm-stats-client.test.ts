import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LLMStatsClient } from './llm-stats-client.js';

describe('LLMStatsClient', () => {
  const cacheDir = mkdtempSync(path.join(os.tmpdir(), 'llm-stats-test-'));

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    rmSync(cacheDir, { force: true, recursive: true });
  });

  it('fetches and caches models per endpoint', async () => {
    const client = new LLMStatsClient({ baseUrl: 'https://example.test', cacheDir, cacheTtlMs: 60_000 });
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
    const client = new LLMStatsClient({ baseUrl: 'https://example.test', cacheDir });
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
