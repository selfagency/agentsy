import { describe, expect, it } from 'vitest';

import { packEvidenceForContext } from './context-packer.js';
import { createHybridRetriever } from './hybrid-retriever.js';
import { createQueryPlanner } from './query-planner.js';
import { createRAGMetrics } from './metrics.js';
import { rerankResults } from './reranker.js';

describe('Phase 3 retrieval quality pipeline', () => {
  it('plans query, retrieves, reranks, and packs evidence under budget', async () => {
    const planner = createQueryPlanner();
    const planned = planner.plan({ query: 'oauth token rotation policy', scope: 'project' });

    const retriever = createHybridRetriever();
    retriever.upsert({
      id: 'wiki-oauth',
      sourceId: 'wiki:oauth',
      sourceType: 'wiki',
      title: 'OAuth policy',
      content: 'Rotate refresh tokens and enforce short access token TTL',
      updatedAt: new Date('2026-01-03T00:00:00.000Z').toISOString(),
      metadata: { entities: ['oauth', 'token', 'refresh'] }
    });

    retriever.upsert({
      id: 'wiki-cache',
      sourceId: 'wiki:cache',
      sourceType: 'wiki',
      title: 'Cache policy',
      content: 'Redis eviction and cache invalidation patterns',
      updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      metadata: { entities: ['redis', 'cache'] }
    });

    const retrieved = await retriever.search(planned);
    const reranked = rerankResults(retrieved, {
      vector: 0.4,
      lexical: 0.3,
      entity: 0.2,
      temporal: 0.1
    });

    expect(reranked[0]?.id).toBe('wiki-oauth');

    const packed = packEvidenceForContext(reranked, {
      maxTokens: 40,
      includeCitations: true
    });

    expect(packed.usedTokens).toBeLessThanOrEqual(40);
    expect(packed.items.length).toBeGreaterThan(0);
    expect(packed.items[0]?.citations.length).toBeGreaterThan(0);

    const metrics = createRAGMetrics();
    metrics.recordQuery({ latencyMs: 120, hits: reranked.length, sourceMix: { wiki: 1 }, cited: packed.items.length });
    const snapshot = metrics.snapshot();

    expect(snapshot.queries).toBe(1);
    expect(snapshot.averageLatencyMs).toBe(120);
  });
});
