import { describe, expect, it } from 'vitest';

describe('Turso sync foundation', () => {
  it('exports a sync factory from the sync barrel', async () => {
    const syncModule = await import('./index.js');

    expect(syncModule.createTursoManager).toBeTypeOf('function');
  });

  it('fails fast when required sync config is missing', async () => {
    const { createTursoManager } = await import('./index.js');

    expect(() =>
      createTursoManager({
        databaseUrl: '',
        authToken: '',
        syncIntervalMs: 0,
        maxRetries: -1
      })
    ).toThrow(/databaseUrl|authToken|syncIntervalMs|maxRetries/u);
  });

  it('starts idle, supports pause and resume, and reports metrics', async () => {
    const { createTursoManager } = await import('./index.js');

    const manager = createTursoManager({
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      authToken: 'token-value',
      syncIntervalMs: 5_000,
      maxRetries: 3
    });

    expect(manager.getStatus()).toBe('idle');
    expect(manager.getMetrics()).toEqual({
      successes: 0,
      failures: 0,
      retries: 0,
      conflicts: 0
    });

    manager.pause();
    expect(manager.getStatus()).toBe('paused');

    manager.resume();
    expect(manager.getStatus()).toBe('idle');
  });

  it('skips sync work while paused', async () => {
    const { createTursoManager } = await import('./index.js');

    const manager = createTursoManager({
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      authToken: 'token-value',
      syncIntervalMs: 5_000,
      maxRetries: 3,
      client: {
        async upload() {
          throw new Error('upload should not run while paused');
        },
        async download() {
          throw new Error('download should not run while paused');
        }
      }
    });

    manager.pause();

    await expect(
      manager.sync({
        cursor: 'cursor-1',
        records: []
      })
    ).resolves.toMatchObject({
      status: 'paused',
      uploaded: 0,
      downloaded: 0,
      resolvedConflicts: 0,
      unresolvedConflicts: 0
    });
  });

  it('tracks successful sync runs from an injected client', async () => {
    const { createTursoManager } = await import('./index.js');

    const manager = createTursoManager({
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      authToken: 'token-value',
      syncIntervalMs: 5_000,
      maxRetries: 3,
      client: {
        async upload(snapshot) {
          return {
            uploadedCount: snapshot.records.length,
            nextCursor: 'remote-cursor-2'
          };
        },
        async download(cursor) {
          return {
            cursor,
            records: [
              {
                id: 'remote-1',
                tier: 'wiki',
                updatedAt: '2026-05-15T00:00:00.000Z',
                content: 'Remote wiki page'
              }
            ]
          };
        }
      }
    });

    const result = await manager.sync({
      cursor: 'local-cursor-1',
      records: [
        {
          id: 'local-1',
          tier: 'wiki',
          updatedAt: '2026-05-15T00:00:00.000Z',
          content: 'Local wiki page'
        }
      ]
    });

    expect(result).toMatchObject({
      status: 'success',
      uploaded: 1,
      downloaded: 1,
      resolvedConflicts: 0,
      unresolvedConflicts: 0,
      nextCursor: 'remote-cursor-2'
    });
    expect(manager.getStatus()).toBe('idle');
    expect(manager.getMetrics()).toEqual({
      successes: 1,
      failures: 0,
      retries: 0,
      conflicts: 0
    });
  });

  it('moves to error status and increments failures when the client throws', async () => {
    const { createTursoManager } = await import('./index.js');

    const manager = createTursoManager({
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      authToken: 'token-value',
      syncIntervalMs: 5_000,
      maxRetries: 3,
      client: {
        async upload() {
          throw new Error('remote unavailable');
        },
        async download() {
          return {
            cursor: 'cursor-1',
            records: []
          };
        }
      }
    });

    await expect(
      manager.sync({
        cursor: 'cursor-1',
        records: []
      })
    ).resolves.toMatchObject({
      status: 'error',
      uploaded: 0,
      downloaded: 0,
      resolvedConflicts: 0,
      unresolvedConflicts: 0,
      error: {
        code: 'SYNC_FAILED',
        retryable: true
      }
    });
    expect(manager.getStatus()).toBe('error');
    expect(manager.getMetrics()).toEqual({
      successes: 0,
      failures: 1,
      retries: 0,
      conflicts: 0
    });
  });
});
