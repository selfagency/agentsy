import { describe, expect, it } from 'vitest';

import { initMemory } from './init.js';

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
});
