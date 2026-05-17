import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runRetrievalBenchmark } from './benchmarks/retrieval-quality.js';
import type { RetrievalBenchmarkDocument } from './benchmarks/retrieval-quality.js';

async function loadCorpus(): Promise<RetrievalBenchmarkDocument[]> {
  const currentDir = import.meta.dirname;
  const filePath = join(currentDir, '..', 'fixtures', 'retrieval', 'corpus.json');
  const payload = await readFile(filePath, 'utf-8');
  return JSON.parse(payload) as RetrievalBenchmarkDocument[];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
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
