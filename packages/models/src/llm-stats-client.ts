import os from 'node:os';
import path from 'node:path';

export interface LLMStatsClientOptions {
  baseUrl?: string;
  cacheDir?: string;
  cacheTtlMs?: number;
}

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

function isCacheEntry(value: unknown): value is CacheEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.timestamp === 'number' && 'data' in record;
}

export class LLMStatsClient {
  private readonly baseUrl: string;
  private readonly cacheDir: string;
  private readonly cacheTtlMs: number;
  private readonly cacheByEndpoint = new Map<string, CacheEntry>();

  constructor(options: LLMStatsClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'https://llm-stats.com';
    this.cacheDir = options.cacheDir ?? os.tmpdir();
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000;
  }

  fetchModels(force = false): Promise<unknown> {
    return this.fetchEndpoint('models', force);
  }

  fetchModel(id: string, force = false): Promise<unknown> {
    return this.fetchEndpoint(`models/${encodeURIComponent(id)}`, force);
  }

  fetchBenchmarks(force = false): Promise<unknown> {
    return this.fetchEndpoint('benchmarks', force);
  }

  fetchRankings(force = false): Promise<unknown> {
    return this.fetchEndpoint('rankings', force);
  }

  fetchScores(force = false): Promise<unknown> {
    return this.fetchEndpoint('scores', force);
  }

  fetchUpdates(force = false): Promise<unknown> {
    return this.fetchEndpoint('updates', force);
  }

  private async fetchEndpoint(endpoint: string, force: boolean): Promise<unknown> {
    const cached = this.cacheByEndpoint.get(endpoint);
    if (!force && cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.data;
    }

    const cachePath = this.getCachePath(endpoint);

    if (!force) {
      const diskCache = await this.readCache(cachePath);
      if (diskCache) {
        this.cacheByEndpoint.set(endpoint, diskCache);
        return diskCache.data;
      }
    }

    const response = await fetch(`${this.baseUrl}/stats/v1/${endpoint}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch LLM Stats ${endpoint}: ${response.status}`);
    }

    const data: unknown = await response.json();
    const entry: CacheEntry = {
      data,
      timestamp: Date.now()
    };

    this.cacheByEndpoint.set(endpoint, entry);
    await this.writeCache(cachePath, entry);
    return data;
  }

  private getCachePath(endpoint: string): string {
    return path.join(
      this.cacheDir,
      `llm-stats-${endpoint.replace(/[^a-z0-9/.-]/gi, '_').replaceAll('/', '__')}.cache.json`
    );
  }

  private async readCache(cachePath: string): Promise<CacheEntry | undefined> {
    try {
      const fs = await import('node:fs/promises');
      const content = await fs.readFile(cachePath, 'utf-8');
      const parsed: unknown = JSON.parse(content);

      if (!isCacheEntry(parsed) || Date.now() - parsed.timestamp >= this.cacheTtlMs) {
        return;
      }

      return parsed;
    } catch {
      return;
    }
  }

  private async writeCache(cachePath: string, entry: CacheEntry): Promise<void> {
    try {
      const fs = await import('node:fs/promises');
      await fs.writeFile(cachePath, JSON.stringify(entry), 'utf-8');
    } catch {
      // Ignore cache write failures.
    }
  }
}
