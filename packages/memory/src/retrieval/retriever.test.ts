import { describe, expect, it } from 'vitest';

import { createMemoryRetriever } from './retriever.js';

describe('MemoryRetriever', () => {
  it('ranks hybrid search with lexical, semantic and temporal signals', async () => {
    const retriever = createMemoryRetriever();

    retriever.upsert({
      id: 'auth-1',
      scope: 'project',
      title: 'OAuth PKCE',
      content: 'Use OAuth PKCE refresh token flow',
      createdAt: new Date(Date.now() - 1_000)
    });

    retriever.upsert({
      id: 'cache-1',
      scope: 'project',
      title: 'Redis',
      content: 'Redis eviction policy',
      createdAt: new Date(Date.now() - 5_000)
    });

    const results = await retriever.search({ query: 'oauth refresh token', scope: 'project', limit: 2 });

    expect(results).toHaveLength(2);
    expect(results[0]?.record.id).toBe('auth-1');
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });
});
