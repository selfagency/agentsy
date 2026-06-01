import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createRAGConfig } from './config.js';
import { createRAGServerClient } from './server-client.js';
import { createMockRAGState, createRAGMockServer } from './test-msw.js';

const BASE_URL = 'http://rag.e2e.local';
const state = createMockRAGState();
const server = createRAGMockServer(BASE_URL, state);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  state.healthy = true;
  state.documents.clear();
  state.searchResults = [];
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('Phase 3 e2e modes', () => {
  it('supports local-only mode and degraded fallback when remote health fails', async () => {
    const localConfig = createRAGConfig({ localOnly: true });
    expect(localConfig.localOnly).toBeTruthy();

    const remoteClient = createRAGServerClient({
      baseUrl: BASE_URL,
      timeoutMs: 500
    });
    const healthy = await remoteClient.health();
    expect(healthy.ok).toBeTruthy();

    state.healthy = false;
    const degraded = await remoteClient.health();
    expect(degraded.ok).toBeFalsy();
  });
});
