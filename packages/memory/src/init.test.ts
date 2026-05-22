import { describe, expect, it, vi } from 'vitest';

import { initMemory } from './init.js';

vi.mock('@tursodatabase/sync', () => ({
  connect: vi.fn().mockResolvedValue({
    connect: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn().mockResolvedValue(false),
    push: vi.fn().mockResolvedValue(undefined),
    stats: vi.fn().mockResolvedValue({ cdcOperations: 0 }),
    checkpoint: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined)
  })
}));

describe('initMemory', () => {
  it('returns an engine and config by default', async () => {
    const result = await initMemory({ skipMcp: true, skipDb: true });
    expect(result.engine).toBeDefined();
    expect(result.config).toBeDefined();
    expect(result.db).toBeUndefined();
  });

  it('creates and returns a database when skipDb is false', async () => {
    const result = await initMemory({ skipMcp: true, skipDb: false, db: { path: ':memory:' } });
    expect(result.engine).toBeDefined();
    expect(result.config).toBeDefined();
    expect(result.db).toBeDefined();
  });

  it('creates an MCP server when skipMcp is false', async () => {
    const result = await initMemory({ skipMcp: false, skipDb: true });
    expect(result.engine).toBeDefined();
    expect('server' in result).toBe(true);
  });

  it('returns tursoSyncEngine when syncUrl is configured with a file db', async () => {
    const result = await initMemory({
      skipMcp: true,
      skipDb: false,
      db: { path: '/tmp/agentsy-test-init.db' },
      config: {
        db: {
          path: '/tmp/agentsy-test-init.db',
          syncUrl: 'libsql://test.turso.io',
          syncAuthToken: 'token123'
        }
      }
    });
    expect(result.tursoSyncEngine).toBeDefined();
    expect(result.tursoSyncEngine?.status()).toBe('idle');
  });

  it('does not create tursoSyncEngine when db is :memory:', async () => {
    const result = await initMemory({
      skipMcp: true,
      skipDb: false,
      db: { path: ':memory:' },
      config: {
        db: {
          path: ':memory:',
          syncUrl: 'libsql://test.turso.io',
          syncAuthToken: 'token123'
        }
      }
    });
    expect(result.tursoSyncEngine).toBeUndefined();
  });

  it('does not create tursoSyncEngine when syncUrl is not configured', async () => {
    const result = await initMemory({
      skipMcp: true,
      skipDb: false,
      db: { path: '/tmp/agentsy-test-init-no-sync.db' }
    });
    expect(result.tursoSyncEngine).toBeUndefined();
  });
});
