import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock(import('@tursodatabase/sync'), () => ({
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
    records: [
      {
        content: 'hello',
        id: 'page-1',
        tier: 'wiki',
        updatedAt: '2026-05-15T00:00:00.000Z'
      }
    ]
  };
}

function createFakeDatabase(): FakeDatabase {
  return {
    checkpoint: vi.fn(async () => {
      /* no-op */
    }),
    close: vi.fn(async () => {
      /* no-op */
    }),
    connect: vi.fn(async () => {
      /* no-op */
    }),
    get: vi.fn(async () => null),
    pull: vi.fn(async () => true),
    push: vi.fn(async () => {
      /* no-op */
    }),
    run: vi.fn(async () => ({ changes: 1, lastInsertRowid: 1 })),
    stats: vi.fn(async () => ({ pendingChanges: 0 }))
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

    await expect(client.upload(snapshot)).resolves.toStrictEqual({
      nextCursor: 'cursor-1',
      uploadedCount: 1
    });
    await expect(client.download('cursor-2')).resolves.toStrictEqual({
      cursor: 'cursor-2',
      records: []
    });
  });

  it('uploads and downloads over the HTTP transport', async () => {
    server.use(
      http.post('https://example.turso.io/sync/upload', async ({ request }) => {
        const payload = (await request.json()) as SyncSnapshot;
        expect(request.headers.get('authorization')).toBe('Bearer token-value');

        expect(payload).toStrictEqual(createSnapshot());
        return HttpResponse.json({
          nextCursor: 'cursor-2',
          uploadedCount: payload.records.length
        });
      }),
      http.get('https://example.turso.io/sync/download', ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer token-value');
        expect(request.url).toContain('cursor=cursor-2');
        return HttpResponse.json(createSnapshot('cursor-3'));
      })
    );

    const client = createTursoHttpClient({
      authToken: 'token-value',
      databaseUrl: 'https://example.turso.io'
    });

    await expect(client.upload(createSnapshot())).resolves.toStrictEqual({
      nextCursor: 'cursor-2',
      uploadedCount: 1
    });
    await expect(client.download('cursor-2')).resolves.toStrictEqual(createSnapshot('cursor-3'));
  });

  it('throws for HTTP upload and download failures', async () => {
    server.use(http.post('https://example.turso.io/sync/upload', () => new HttpResponse(null, { status: 500 })));

    const client = createTursoHttpClient({
      authToken: 'token-value',
      databaseUrl: 'https://example.turso.io'
    });

    await expect(client.upload(createSnapshot())).rejects.toThrow(/status 500/u);

    server.use(http.get('https://example.turso.io/sync/download', () => new HttpResponse(null, { status: 404 })));

    await expect(client.download('cursor-2')).rejects.toThrow(/status 404/u);
  });

  it('resolves auth token suppliers before issuing HTTP requests', async () => {
    server.use(
      http.post('https://example.turso.io/sync/upload', ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer supplied-token');
        return HttpResponse.json({ nextCursor: 'cursor-2', uploadedCount: 1 });
      }),
      http.get('https://example.turso.io/sync/download', ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer supplied-token');
        return HttpResponse.json(createSnapshot('cursor-3'));
      })
    );

    const client = createTursoHttpClient({
      authToken: async () => 'supplied-token',
      databaseUrl: 'https://example.turso.io'
    });

    await expect(client.upload(createSnapshot())).resolves.toStrictEqual({
      nextCursor: 'cursor-2',
      uploadedCount: 1
    });
    await expect(client.download('cursor-2')).resolves.toStrictEqual(createSnapshot('cursor-3'));
  });

  it('uses the Turso sync database for upload and download lifecycle', async () => {
    const database = createFakeDatabase();
    database.get.mockResolvedValue({
      cursor: 'remote-cursor',
      payload: JSON.stringify(createSnapshot().records)
    });
    connectMock.mockResolvedValue(database);

    const client = createTursoSyncClient({
      authToken: 'token-value',
      clientName: 'agentsy-memory',
      fetch,
      longPollTimeoutMs: 5000,
      path: './tmp/memory.db',
      remoteWritesExperimental: true,
      tracing: 'debug',
      url: 'libsql://agentsy-memory.turso.io'
    });

    await expect(client.upload(createSnapshot())).resolves.toStrictEqual({
      nextCursor: 'cursor-1',
      uploadedCount: 1
    });
    await expect(client.download('cursor-0')).resolves.toStrictEqual({
      cursor: 'remote-cursor',
      records: createSnapshot().records
    });
    await expect(client.checkpoint?.()).resolves.toBeUndefined();
    await expect(client.stats?.()).resolves.toStrictEqual({
      pendingChanges: 0
    });
    await expect(client.close?.()).resolves.toBeUndefined();

    expect(connectMock).toHaveBeenCalledWith({
      authToken: 'token-value',
      clientName: 'agentsy-memory',
      fetch,
      longPollTimeoutMs: 5000,
      path: './tmp/memory.db',
      remoteWritesExperimental: true,
      tracing: 'debug',
      url: 'libsql://agentsy-memory.turso.io'
    });
    expect(database.connect).toHaveBeenCalledOnce();
    expect(database.run).toHaveBeenCalledTimes(2);
    expect(database.push).toHaveBeenCalledOnce();
    expect(database.pull).toHaveBeenCalledOnce();
    expect(database.checkpoint).toHaveBeenCalledOnce();
    expect(database.stats).toHaveBeenCalledOnce();
    expect(database.close).toHaveBeenCalledOnce();
  });

  it('returns empty records when the sync row is missing or malformed', async () => {
    const database = createFakeDatabase();
    database.get.mockResolvedValueOnce(null).mockResolvedValueOnce({ cursor: 'remote-cursor', payload: null });
    connectMock.mockResolvedValue(database);

    const client = createTursoSyncClient({
      path: './tmp/memory.db',
      url: 'libsql://agentsy-memory.turso.io'
    });

    await expect(client.download('cursor-a')).resolves.toStrictEqual({
      cursor: 'cursor-a',
      records: []
    });
    await expect(client.download('cursor-b')).resolves.toStrictEqual({
      cursor: 'remote-cursor',
      records: []
    });
  });

  it('creates a sync client when a path is configured and only falls back to noop in local-only mode', async () => {
    const database = createFakeDatabase();
    database.get.mockResolvedValue({
      cursor: 'remote-cursor',
      payload: JSON.stringify([])
    });
    connectMock.mockResolvedValue(database);

    const syncClient = createDefaultTursoClient({
      authToken: 'token-value',
      clientName: 'agentsy-memory',
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      maxRetries: 3,
      path: './tmp/memory.db',
      syncIntervalMs: 5000
    });
    const noopClient = createDefaultTursoClient({
      authToken: 'token-value',
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      maxRetries: 3,
      mode: 'local-only',
      syncIntervalMs: 5000
    });

    await expect(syncClient.download('cursor-1')).resolves.toStrictEqual({
      cursor: 'remote-cursor',
      records: []
    });
    await expect(noopClient.download('cursor-2')).resolves.toStrictEqual({
      cursor: 'cursor-2',
      records: []
    });
    expect(connectMock).toHaveBeenCalledOnce();
  });

  it('throws when remote sync is configured without a path', () => {
    expect(() =>
      createDefaultTursoClient({
        authToken: 'token-value',
        databaseUrl: 'libsql://agentsy-memory.turso.io',
        maxRetries: 3,
        syncIntervalMs: 5000
      })
    ).toThrow(/path is required/u);
  });
});
