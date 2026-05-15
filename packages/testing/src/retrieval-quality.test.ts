import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runRetrievalBenchmark, type RetrievalBenchmarkDocument } from './benchmarks/retrieval-quality.js';

async function loadCorpus(): Promise<RetrievalBenchmarkDocument[]> {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const filePath = join(currentDir, '..', 'fixtures', 'retrieval', 'corpus.json');
  const payload = await readFile(filePath, 'utf8');
  return JSON.parse(payload) as RetrievalBenchmarkDocument[];
}

describe('retrieval benchmark', () => {
  it('returns oauth document first and preserves citation coverage', async () => {
    const corpus = await loadCorpus();
    const result = await runRetrievalBenchmark(corpus, 'oauth refresh token policy');

    expect(result.topId).toBe('wiki-oauth');
    expect(result.hitCount).toBeGreaterThan(0);
    expect(result.citationCoverage).toBeGreaterThanOrEqual(1);
    expect(result.latencyMs).toBeLessThan(250);
  });
});
