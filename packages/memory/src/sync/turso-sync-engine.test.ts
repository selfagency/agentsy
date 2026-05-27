import { describe, expect, it, vi } from 'vitest';

import { createTursoSyncEngine } from './turso-sync-engine.js';

vi.mock('@tursodatabase/sync', () => ({
  connect: vi.fn()
}));

const { connect } = await import('@tursodatabase/sync');

describe('TursoSyncEngine', () => {
  it('creates engine with default client name', async () => {
    const mockClient = {
      checkpoint: vi.fn(),
      close: vi.fn(),
      connect: vi.fn(),
      pull: vi.fn(),
      push: vi.fn(),
      stats: vi.fn()
    };
    vi.mocked(connect).mockResolvedValue(mockClient);

    const engine = await createTursoSyncEngine({ path: '/tmp/test.db' });

    expect(connect).toHaveBeenCalledWith({
      clientName: 'agentsy-memory',
      path: '/tmp/test.db'
    });
    expect(mockClient.connect).toHaveBeenCalled();
    expect(engine.status()).toBe('idle');
  });

  it('passes url and authToken when provided', async () => {
    const mockClient = {
      checkpoint: vi.fn(),
      close: vi.fn(),
      connect: vi.fn(),
      pull: vi.fn(),
      push: vi.fn(),
      stats: vi.fn()
    };
    vi.mocked(connect).mockResolvedValue(mockClient);

    await createTursoSyncEngine({
      authToken: 'tok_123',
      path: '/tmp/test.db',
      url: 'libsql://db-org.turso.io'
    });

    expect(connect).toHaveBeenCalledWith({
      authToken: 'tok_123',
      clientName: 'agentsy-memory',
      path: '/tmp/test.db',
      url: 'libsql://db-org.turso.io'
    });
  });

  it('passes authToken as function', async () => {
    const mockClient = {
      checkpoint: vi.fn(),
      close: vi.fn(),
      connect: vi.fn(),
      pull: vi.fn(),
      push: vi.fn(),
      stats: vi.fn()
    };
    vi.mocked(connect).mockResolvedValue(mockClient);
    const tokenFn = vi.fn().mockResolvedValue('tok_fn');

    await createTursoSyncEngine({
      authToken: tokenFn,
      path: '/tmp/test.db'
    });

    expect(connect).toHaveBeenCalledWith({
      authToken: tokenFn,
      clientName: 'agentsy-memory',
      path: '/tmp/test.db'
    });
  });

  it('syncs successfully with pull, push, stats, and checkpoint', async () => {
    const mockClient = {
      checkpoint: vi.fn(),
      connect: vi.fn(),
      pull: vi.fn().mockResolvedValue(true),
      push: vi.fn(),
      stats: vi.fn().mockResolvedValue({ cdcOperations: 3 }),
      close: vi.fn()
    };
    vi.mocked(connect).mockResolvedValue(mockClient);

    const engine = await createTursoSyncEngine({ path: '/tmp/test.db' });
    const result = await engine.sync();

    expect(mockClient.pull).toHaveBeenCalled();
    expect(mockClient.push).toHaveBeenCalled();
    expect(mockClient.stats).toHaveBeenCalled();
    expect(mockClient.checkpoint).toHaveBeenCalled();
    expect(result).toStrictEqual({
      downloaded: 1,
      nextCursor: '',
      resolvedConflicts: 0,
      status: 'success',
      unresolvedConflicts: 0,
      uploaded: 3
    });
    expect(engine.status()).toBe('idle');
  });

  it('returns downloaded=0 when pull returns falsy', async () => {
    const mockClient = {
      checkpoint: vi.fn(),
      connect: vi.fn(),
      pull: vi.fn().mockResolvedValue(false),
      push: vi.fn(),
      stats: vi.fn().mockResolvedValue({ cdcOperations: 0 }),
      close: vi.fn()
    };
    vi.mocked(connect).mockResolvedValue(mockClient);

    const engine = await createTursoSyncEngine({ path: '/tmp/test.db' });
    const result = await engine.sync();

    expect(result.downloaded).toBe(0);
    expect(result.uploaded).toBe(0);
  });

  it('returns paused status when engine is paused', async () => {
    const mockClient = {
      checkpoint: vi.fn(),
      close: vi.fn(),
      connect: vi.fn(),
      pull: vi.fn(),
      push: vi.fn(),
      stats: vi.fn()
    };
    vi.mocked(connect).mockResolvedValue(mockClient);

    const engine = await createTursoSyncEngine({ path: '/tmp/test.db' });
    engine.pause();
    const result = await engine.sync();

    expect(result.status).toBe('paused');
    expect(mockClient.pull).not.toHaveBeenCalled();
  });

  it('returns error status when client.pull throws', async () => {
    const mockClient = {
      checkpoint: vi.fn(),
      connect: vi.fn(),
      pull: vi.fn().mockRejectedValue(new Error('connection lost')),
      push: vi.fn(),
      stats: vi.fn(),
      close: vi.fn()
    };
    vi.mocked(connect).mockResolvedValue(mockClient);

    const engine = await createTursoSyncEngine({ path: '/tmp/test.db' });
    const result = await engine.sync();

    expect(result.status).toBe('error');
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('connection lost');
    expect(engine.status()).toBe('error');
  });

  it('resume transitions from paused to idle', async () => {
    const mockClient = {
      checkpoint: vi.fn(),
      close: vi.fn(),
      connect: vi.fn(),
      pull: vi.fn(),
      push: vi.fn(),
      stats: vi.fn()
    };
    vi.mocked(connect).mockResolvedValue(mockClient);

    const engine = await createTursoSyncEngine({ path: '/tmp/test.db' });
    engine.pause();
    expect(engine.status()).toBe('paused');

    engine.resume();
    expect(engine.status()).toBe('idle');
  });

  it('resume from idle does nothing', async () => {
    const mockClient = {
      checkpoint: vi.fn(),
      close: vi.fn(),
      connect: vi.fn(),
      pull: vi.fn(),
      push: vi.fn(),
      stats: vi.fn()
    };
    vi.mocked(connect).mockResolvedValue(mockClient);

    const engine = await createTursoSyncEngine({ path: '/tmp/test.db' });
    engine.resume();
    expect(engine.status()).toBe('idle');
  });

  it('close shuts down the client', async () => {
    const mockClient = {
      checkpoint: vi.fn(),
      close: vi.fn(),
      connect: vi.fn(),
      pull: vi.fn(),
      push: vi.fn(),
      stats: vi.fn()
    };
    vi.mocked(connect).mockResolvedValue(mockClient);

    const engine = await createTursoSyncEngine({ path: '/tmp/test.db' });
    await engine.close();

    expect(mockClient.close).toHaveBeenCalled();
  });
});
