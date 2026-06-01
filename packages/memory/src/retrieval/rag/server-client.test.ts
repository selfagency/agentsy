import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createRAGServerClient } from './server-client.js';
import { createMockRAGState, createRAGMockServer } from './test-msw.js';

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

describe('RAGServerClient', () => {
  it('checks health, upserts documents, searches, and deletes documents', async () => {
    const client = createRAGServerClient({ baseUrl: BASE_URL, timeoutMs: 500 });

    const health = await client.health();
    expect(health.ok).toBe(true);

    await client.upsert({
      id: 'doc-1',
      sourceId: 'wiki:oauth',
      sourceType: 'wiki',
      title: 'OAuth token lifetime',
      content: 'Access tokens typically expire quickly.',
      chunkIndex: 0,
      updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      metadata: { tags: ['oauth'] }
    });

    state.searchResults = [
      {
        id: 'doc-1',
        sourceId: 'wiki:oauth',
        sourceType: 'wiki',
        title: 'OAuth token lifetime',
        content: 'Access tokens typically expire quickly.',
        score: 0.91,
        updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        metadata: { tags: ['oauth'] }
      }
    ];

    const results = await client.search({ query: 'oauth token', limit: 5 });
    expect(results[0]?.id).toBe('doc-1');

    const deletion = await client.delete('doc-1');
    expect(deletion.deleted).toBe(true);
  });

  it('returns degraded health when remote endpoint fails', async () => {
    state.healthy = false;
    const client = createRAGServerClient({ baseUrl: BASE_URL, timeoutMs: 500 });

    const health = await client.health();
    expect(health.ok).toBe(false);
  });
});
