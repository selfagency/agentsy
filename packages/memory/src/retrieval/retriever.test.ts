import { describe, expect, it } from 'vitest';

import { createMemoryRetriever } from './retriever.js';

describe('MemoryRetriever', () => {
  it('ranks hybrid search with lexical, semantic and temporal signals', async () => {
    const retriever = createMemoryRetriever();

    retriever.upsert({
      content: 'Use OAuth PKCE refresh token flow',
      createdAt: new Date(Date.now() - 1000),
      id: 'auth-1',
      scope: 'project',
      title: 'OAuth PKCE'
    });

    retriever.upsert({
      content: 'Redis eviction policy',
      createdAt: new Date(Date.now() - 5000),
      id: 'cache-1',
      scope: 'project',
      title: 'Redis'
    });

    const results = await retriever.search({
      limit: 2,
      query: 'oauth refresh token',
      scope: 'project'
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.record.id).toBe('auth-1');
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });
});
