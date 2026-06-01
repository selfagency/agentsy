import { describe, expect, it, vi } from 'vitest';

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

  it('filters records by scope', async () => {
    const retriever = createMemoryRetriever();
    retriever.upsert({
      content: 'session item',
      createdAt: new Date(),
      id: 's1',
      scope: 'session'
    });

    const results = await retriever.search({ query: 'item', scope: 'project' });
    expect(results).toHaveLength(0);
  });

  it('filters records by actorId through canReadScope', async () => {
    const canReadScope = vi.fn().mockReturnValue(false);
    const retriever = createMemoryRetriever({ canReadScope });
    retriever.upsert({
      content: 'restricted data',
      createdAt: new Date(),
      id: 'r1',
      scope: 'project'
    });

    const results = await retriever.search({ query: 'data', actorId: 'user-1' });
    expect(results).toHaveLength(0);
    expect(canReadScope).toHaveBeenCalledWith('user-1', 'project');
  });

  it('limits results to the specified limit', async () => {
    const retriever = createMemoryRetriever();
    retriever.upsert({
      content: 'first item',
      createdAt: new Date(),
      id: '1',
      scope: 'session'
    });
    retriever.upsert({
      content: 'second item',
      createdAt: new Date(),
      id: '2',
      scope: 'session'
    });

    const results = await retriever.search({ query: 'item', limit: 1 });
    expect(results).toHaveLength(1);
  });

  it('removes a record', () => {
    const retriever = createMemoryRetriever();
    retriever.upsert({
      content: 'to delete',
      createdAt: new Date(),
      id: 'd1',
      scope: 'session'
    });

    expect(retriever.list()).toHaveLength(1);
    retriever.remove('d1');
    expect(retriever.list()).toHaveLength(0);
  });
});
