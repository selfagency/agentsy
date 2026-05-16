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
        authToken: '',
        databaseUrl: '',
        maxRetries: -1,
        syncIntervalMs: 0
      })
    ).toThrow(/databaseUrl|authToken|syncIntervalMs|maxRetries/u);
  });

  it('starts idle, supports pause and resume, and reports metrics', async () => {
    const { createTursoManager } = await import('./index.js');

    const manager = createTursoManager({
      authToken: 'token-value',
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      maxRetries: 3,
      mode: 'local-only',
      syncIntervalMs: 5000
    });

    expect(manager.getStatus()).toBe('idle');
    expect(manager.getMetrics()).toStrictEqual({
      conflicts: 0,
      failures: 0,
      retries: 0,
      successes: 0
    });

    manager.pause();
    expect(manager.getStatus()).toBe('paused');

    manager.resume();
    expect(manager.getStatus()).toBe('idle');
  });

  it('skips sync work while paused', async () => {
    const { createTursoManager } = await import('./index.js');

    const manager = createTursoManager({
      authToken: 'token-value',
      client: {
        async download() {
          throw new Error('download should not run while paused');
        },
        async upload() {
          throw new Error('upload should not run while paused');
        }
      },
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      maxRetries: 3,
      syncIntervalMs: 5000
    });

    manager.pause();

    await expect(
      manager.sync({
        cursor: 'cursor-1',
        records: []
      })
    ).resolves.toMatchObject({
      downloaded: 0,
      resolvedConflicts: 0,
      status: 'paused',
      unresolvedConflicts: 0,
      uploaded: 0
    });
  });

  it('tracks successful sync runs from an injected client', async () => {
    const { createTursoManager } = await import('./index.js');
    let uploadedSnapshot: { cursor: string; records: { id: string; tier: string }[] } | undefined;

    const manager = createTursoManager({
      authToken: 'token-value',
      client: {
        async download(cursor) {
          return {
            cursor,
            records: [
              {
                content: 'Remote wiki page',
                id: 'remote-1',
                tier: 'wiki',
                updatedAt: '2026-05-15T00:00:00.000Z'
              }
            ]
          };
        },
        async upload(snapshot) {
          uploadedSnapshot = {
            cursor: snapshot.cursor,
            records: snapshot.records.map(record => ({
              id: record.id,
              tier: record.tier
            }))
          };
          return {
            nextCursor: 'remote-cursor-2',
            uploadedCount: snapshot.records.length
          };
        }
      },
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      maxRetries: 3,
      syncIntervalMs: 5000
    });

    const result = await manager.sync({
      cursor: 'local-cursor-1',
      records: [
        {
          content: 'Local wiki page',
          id: 'local-1',
          tier: 'wiki',
          updatedAt: '2026-05-15T00:00:00.000Z'
        }
      ]
    });

    expect(result).toMatchObject({
      downloaded: 1,
      nextCursor: 'remote-cursor-2',
      resolvedConflicts: 0,
      status: 'success',
      unresolvedConflicts: 0,
      uploaded: 2
    });
    expect(manager.getStatus()).toBe('idle');
    expect(manager.getMetrics()).toStrictEqual({
      conflicts: 0,
      failures: 0,
      retries: 0,
      successes: 1
    });
    expect(uploadedSnapshot?.records).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'local-1', tier: 'wiki' }),
        expect.objectContaining({ id: 'remote-1', tier: 'wiki' })
      ])
    );
  });

  it('moves to error status and increments failures when the client throws', async () => {
    const { createTursoManager } = await import('./index.js');

    const manager = createTursoManager({
      authToken: 'token-value',
      client: {
        async download() {
          return {
            cursor: 'cursor-1',
            records: []
          };
        },
        async upload() {
          throw new Error('remote unavailable');
        }
      },
      databaseUrl: 'libsql://agentsy-memory.turso.io',
      maxRetries: 3,
      syncIntervalMs: 5000
    });

    await expect(
      manager.sync({
        cursor: 'cursor-1',
        records: []
      })
    ).resolves.toMatchObject({
      downloaded: 0,
      error: {
        code: 'SYNC_FAILED',
        retryable: true
      },
      resolvedConflicts: 0,
      status: 'error',
      unresolvedConflicts: 0,
      uploaded: 0
    });
    expect(manager.getStatus()).toBe('error');
    expect(manager.getMetrics()).toStrictEqual({
      conflicts: 0,
      failures: 1,
      retries: 0,
      successes: 0
    });
  });
});
