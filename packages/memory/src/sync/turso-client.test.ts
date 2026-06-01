import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

import {
  createDefaultTursoClient,
  createNoopTursoClient,
  createTursoHttpClient,
  createTursoSyncClient
} from './turso-client.js';
import type { SyncSnapshot } from './types.js';

const { connectMock } = vi.hoisted(() => ({
  connectMock: vi.fn()
}));

vi.mock('@tursodatabase/sync', () => ({
  connect: connectMock
}));

interface FakeDatabase {
  connect: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  push: ReturnType<typeof vi.fn>;
  pull: ReturnType<typeof vi.fn>;
  checkpoint: ReturnType<typeof vi.fn>;
  stats: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

const server = setupServer();

function createSnapshot(cursor = 'cursor-1'): SyncSnapshot {
  return {
    cursor,
    records: [{ id: 'page-1', tier: 'wiki', updatedAt: '2026-05-15T00:00:00.000Z', content: 'hello' }]
  };
}

function createFakeDatabase(): FakeDatabase {
  return {
    connect: vi.fn(async () => {}),
    run: vi.fn(async () => ({ changes: 1, lastInsertRowid: 1 })),
    get: vi.fn(async () => null),
    push: vi.fn(async () => {}),
    pull: vi.fn(async () => true),
    checkpoint: vi.fn(async () => {}),
    stats: vi.fn(async () => ({ pendingChanges: 0 })),
    close: vi.fn(async () => {})
  };
}

describe('turso-client', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    connectMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('returns local snapshot semantics for noop client', async () => {
    const client = createNoopTursoClient();
    const snapshot = createSnapshot();

    await expect(client.upload(snapshot)).resolves.toEqual({
      uploadedCount: 1,
      nextCursor: 'cursor-1'
    });
    await expect(client.download('cursor-2')).resolves.toEqual({
      cursor: 'cursor-2',
      records: []
    });
  });

  it('uploads and downloads over the HTTP transport', async () => {
    server.use(
      http.post('https://example.turso.io/sync/upload', async ({ request }) => {
        const payload = (await request.json()) as SyncSnapshot;
        expect(request.headers.get('authorization')).toBe('Bearer token-value');

        expect(payload).toEqual(createSnapshot());
        return HttpResponse.json({ uploadedCount: payload.records.length, nextCursor: 'cursor-2' });
      }),
      http.get('https://example.turso.io/sync/download', ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer token-value');
        expect(request.url).toContain('cursor=cursor-2');
        return HttpResponse.json(createSnapshot('cursor-3'));
      })
    );

    const client = createTursoHttpClient({
      databaseUrl: 'https://example.turso.io',
      authToken: 'token-value'
    });

    await expect(client.upload(createSnapshot())).resolves.toEqual({
      uploadedCount: 1,
      nextCursor: 'cursor-2'
    });
    await expect(client.download('cursor-2')).resolves.toEqual(createSnapshot('cursor-3'));
  });

  it('throws for HTTP upload and download failures', async () => {
    server.use(http.post('https://example.turso.io/sync/upload', () => new HttpResponse(null, { status: 500 })));

    const client = createTursoHttpClient({
      databaseUrl: 'https://example.turso.io',
      authToken: 'token-value'
    });

    await expect(client.upload(createSnapshot())).rejects.toThrow(/status 500/u);

    server.use(http.get('https://example.turso.io/sync/download', () => new HttpResponse(null, { status: 404 })));

    await expect(client.download('cursor-2')).rejects.toThrow(/status 404/u);
  });

  it('resolves auth token suppliers before issuing HTTP requests', async () => {
    server.use(
      http.post('https://example.turso.io/sync/upload', ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer supplied-token');
        return HttpResponse.json({ uploadedCount: 1, nextCursor: 'cursor-2' });
      }),
      http.get('https://example.turso.io/sync/download', ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer supplied-token');
        return HttpResponse.json(createSnapshot('cursor-3'));
      })
    );

    const client = createTursoHttpClient({
      databaseUrl: 'https://example.turso.io',
      authToken: async () => 'supplied-token'
    });

    await expect(client.upload(createSnapshot())).resolves.toEqual({
      uploadedCount: 1,
      nextCursor: 'cursor-2'
    });
    await expect(client.download('cursor-2')).resolves.toEqual(createSnapshot('cursor-3'));
  });

  it('uses the Turso sync database for upload and download lifecycle', async () => {
    const database = createFakeDatabase();
    database.get.mockResolvedValue({
      cursor: 'remote-cursor',
      payload: JSON.stringify(createSnapshot().records)
    });
    connectMock.mockResolvedValue(database);

    const client = createTursoSyncClient({
      path: './tmp/memory.db',
      url: 'libsql://agentsy-memory.turso.io',
      authToken: 'token-value',
      clientName: 'agentsy-memory',
      longPollTimeoutMs: 5_000,
      tracing: 'debug',
      remoteWritesExperimental: true,
      fetch
    });

    await expect(client.upload(createSnapshot())).resolves.toEqual({
      uploadedCount: 1,
      nextCursor: 'cursor-1'
    });
    await expect(client.download('cursor-0')).resolves.toEqual({
      cursor: 'remote-cursor',
      records: createSnapshot().records
    });
    await expect(client.checkpoint?.()).resolves.toBeUndefined();
    await expect(client.stats?.()).resolves.toEqual({ pendingChanges: 0 });
    await expect(client.close?.()).resolves.toBeUndefined();

    expect(connectMock).toHaveBeenCalledWith({
      path: './tmp/memory.db',
      url: 'libsql://agentsy-memory.turso.io',
      authToken: 'token-value',
      clientName: 'agentsy-memory',
      longPollTimeoutMs: 5_000,
      tracing: 'debug',
      remoteWritesExperimental: true,
      fetch
    });
    expect(database.connect).toHaveBeenCalledTimes(1);
    expect(database.run).toHaveBeenCalledTimes(2);
    expect(database.push).toHaveBeenCalledTimes(1);
    expect(database.pull).toHaveBeenCalledTimes(1);
    expect(database.checkpoint).toHaveBeenCalledTimes(1);
    expect(database.stats).toHaveBeenCalledTimes(1);
    expect(database.close).toHaveBeenCalledTimes(1);
  });

  it('returns empty records when the sync row is missing or malformed', async () => {
    const database = createFakeDatabase();
    database.get.mockResolvedValueOnce(null).mockResolvedValueOnce({ cursor: 'remote-cursor', payload: null });
    connectMock.mockResolvedValue(database);

    const client = createTursoSyncClient({
      path: './tmp/memory.db',
      url: 'libsql://agentsy-memory.turso.io'
    });

    await expect(client.download('cursor-a')).resolves.toEqual({
      cursor: 'cursor-a',
      records: []
    });
    await expect(client.download('cursor-b')).resolves.toEqual({
      cursor: 'remote-cursor',
      records: []
    });
  });

  it('creates a sync client when a path is configured and only falls back to noop in local-only mode', async () => {
    const database = createFakeDatabase();
    database.get.mockResolvedValue({ cursor: 'remote-cursor', payload: JSON.stringify([]) });
    connectMock.mockResolvedValue(database);

    const syncClient = createDefaultTursoClient({
      path: './tmp/memory.db',
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      authToken: 'token-value',
      syncIntervalMs: 5_000,
      maxRetries: 3,
      clientName: 'agentsy-memory'
    });
    const noopClient = createDefaultTursoClient({
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      authToken: 'token-value',
      syncIntervalMs: 5_000,
      maxRetries: 3,
      mode: 'local-only'
    });

    await expect(syncClient.download('cursor-1')).resolves.toEqual({ cursor: 'remote-cursor', records: [] });
    await expect(noopClient.download('cursor-2')).resolves.toEqual({ cursor: 'cursor-2', records: [] });
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it('throws when remote sync is configured without a path', () => {
    expect(() =>
      createDefaultTursoClient({
        databaseUrl: 'libsql://agentsy-memory.turso.io',
        authToken: 'token-value',
        syncIntervalMs: 5_000,
        maxRetries: 3
      })
    ).toThrow(/path is required/u);
  });
});
