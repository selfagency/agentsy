import { describe, expect, it } from 'vitest';

import { packEvidenceForContext } from './context-packer.js';
import { createHybridRetriever } from './hybrid-retriever.js';
import { createRAGMetrics } from './metrics.js';
import { createQueryPlanner } from './query-planner.js';
import { rerankResults } from './reranker.js';

describe('Phase 3 retrieval quality pipeline', () => {
  it('plans query, retrieves, reranks, and packs evidence under budget', async () => {
    const planner = createQueryPlanner();
    const planned = planner.plan({
      query: 'oauth token rotation policy',
      scope: 'project'
    });

    const retriever = createHybridRetriever();
    retriever.upsert({
      content: 'Rotate refresh tokens and enforce short access token TTL',
      id: 'wiki-oauth',
      metadata: { entities: ['oauth', 'token', 'refresh'] },
      sourceId: 'wiki:oauth',
      sourceType: 'wiki',
      title: 'OAuth policy',
      updatedAt: new Date('2026-01-03T00:00:00.000Z').toISOString()
    });

    retriever.upsert({
      content: 'Redis eviction and cache invalidation patterns',
      id: 'wiki-cache',
      metadata: { entities: ['redis', 'cache'] },
      sourceId: 'wiki:cache',
      sourceType: 'wiki',
      title: 'Cache policy',
      updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString()
    });

    const retrieved = await retriever.search(planned);
    const reranked = rerankResults(retrieved, {
      entity: 0.2,
      lexical: 0.3,
      temporal: 0.1,
      vector: 0.4
    });

    expect(reranked[0]?.id).toBe('wiki-oauth');

    const packed = packEvidenceForContext(reranked, {
      includeCitations: true,
      maxTokens: 40
    });

    expect(packed.usedTokens).toBeLessThanOrEqual(40);
    expect(packed.items.length).toBeGreaterThan(0);
    expect(packed.items[0]?.citations.length).toBeGreaterThan(0);

    const metrics = createRAGMetrics();
    metrics.recordQuery({
      cited: packed.items.length,
      hits: reranked.length,
      latencyMs: 120,
      sourceMix: { wiki: 1 }
    });
    const snapshot = metrics.snapshot();

    expect(snapshot.queries).toBe(1);
  });
});
