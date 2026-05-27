import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

function _getSafeTestPath(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'agentsy-test-'));
  if (existsSync(tempDir)) {
    return tempDir;
  }
  return join(tmpdir(), 'agentsy-test-safe.db');
}

describe('initMemory', () => {
  it('returns an engine and config by default', async () => {
    const result = await initMemory({ skipMcp: true, skipDb: true });
    expect(result.engine).toBeDefined();
    expect(result.config).toBeDefined();
  });

  it('creates an MCP server when skipMcp is false', async () => {
    const result = await initMemory({ skipMcp: false, skipDb: true });
    expect(result.engine).toBeDefined();
    expect(result.config).toBeDefined();
    expect('server' in result).toBe(true);
  });
});
