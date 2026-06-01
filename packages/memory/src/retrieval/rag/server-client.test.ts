import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createRAGServerClient } from './server-client.js';
import { createMockRAGState, createRAGMockServer } from './test-msw.js';

describe('RAGServerClient', () => {
  const BASE_URL = 'http://rag.local';
  const state = createMockRAGState();
  const server = createRAGMockServer(BASE_URL, state);

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
    state.healthy = true;
    state.documents.clear();
    state.searchResults = [];
  });

  afterAll(() => {
    server.close();
  });

  it('checks health, upserts documents, searches, and deletes documents', async () => {
    const client = createRAGServerClient({ baseUrl: BASE_URL, timeoutMs: 500 });

    const health = await client.health();
    expect(health.ok).toBeTruthy();

    await client.upsert({
      chunkIndex: 0,
      content: 'Access tokens typically expire quickly.',
      id: 'doc-1',
      metadata: { tags: ['oauth'] },
      sourceId: 'wiki:oauth',
      sourceType: 'wiki',
      title: 'OAuth token lifetime',
      updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString()
    });

    state.searchResults = [
      {
        content: 'Access tokens typically expire quickly.',
        id: 'doc-1',
        metadata: { tags: ['oauth'] },
        score: 0.91,
        sourceId: 'wiki:oauth',
        sourceType: 'wiki',
        title: 'OAuth token lifetime',
        updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString()
      }
    ];

    const results = await client.search({ limit: 5, query: 'oauth token' });
    expect(results[0]?.id).toBe('doc-1');

    const deletion = await client.delete('doc-1');
    expect(deletion.deleted).toBeTruthy();
  });

  it('returns degraded health when remote endpoint fails', async () => {
    state.healthy = false;
    const client = createRAGServerClient({ baseUrl: BASE_URL, timeoutMs: 500 });

    const health = await client.health();
    expect(health.ok).toBeFalsy();
  });

  it('returns empty results when search fails', async () => {
    // Force search to fail by using a non-existent URL
    const brokenClient = createRAGServerClient({ baseUrl: 'http://nonexistent.local', timeoutMs: 200 });
    const results = await brokenClient.search({ limit: 5, query: 'test' });
    expect(results).toStrictEqual([]);
  });

  it('throws when upsert fails on server error', async () => {
    // Upsert with a document to a URL that returns 404
    const brokenClient = createRAGServerClient({ baseUrl: 'http://nonexistent.local', timeoutMs: 200 });
    await expect(
      brokenClient.upsert({
        chunkIndex: 0,
        content: 'test',
        id: 'fail-doc',
        sourceId: 'test',
        sourceType: 'wiki',
        title: 'Test',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    ).rejects.toThrow('Failed to upsert document');
  });

  it('handles timeout gracefully', async () => {
    const client = createRAGServerClient({ baseUrl: 'http://rag.local', timeoutMs: 1 });

    // Health with minimal timeout — still works locally via MSW
    const health = await client.health();
    expect(health).toBeDefined();
  });
});
