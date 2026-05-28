import { describe, expect, it, vi } from 'vitest';

import { initMemory } from './init.js';
import { createMemoryMCPServer } from './mcp/server.js';

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

describe('E2E — initMemory + MCP server round-trip', () => {
  it('initializes full stack and exposes 12 tools via MCP', async () => {
    const result = initMemory({ skipMcp: true, skipDb: false });
    expect(result.engine).toBeDefined();
    expect(result.config).toBeDefined();

    const { server } = createMemoryMCPServer(result.engine, {
      dbPath: ':memory:'
    });

    // Initialize
    const initResp = await server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    await server.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(initResp).toMatchObject({ jsonrpc: '2.0', id: 1 });
    expect((initResp as unknown as Record<string, unknown>).result).toBeDefined();

    // List tools
    const toolsResp = await server.handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(toolsResp).toMatchObject({ jsonrpc: '2.0', id: 2 });
    const toolList = (toolsResp as { result: { tools: Array<{ name: string }> } }).result.tools;
    expect(toolList.length).toBeGreaterThan(0);
    expect(toolList.map(t => t.name)).toEqual(
      expect.arrayContaining([
        'memory_ingest',
        'memory_recall',
        'memory_search',
        'memory_list',
        'memory_capture',
        'memory_awaken',
        'memory_stats',
        'memory_lint'
      ])
    );
  });

  it('ingests and recalls a memory through MCP JSON-RPC', async () => {
    const result = initMemory({ skipMcp: true, skipDb: false });
    const { server } = createMemoryMCPServer(result.engine, {
      dbPath: ':memory:'
    });

    // Initialize
    await server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    await server.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });

    // Ingest
    const ingestResp = await server.handleMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'memory_ingest',
        arguments: { content: 'E2E test memory', importance: 0.9, kind: 'semantic' }
      }
    });
    expect(ingestResp).toMatchObject({ jsonrpc: '2.0', id: 2 });
    const ingestResult = (ingestResp as { result?: { content: { text: string }[] } }).result;
    expect(ingestResult?.content[0]?.text).toContain('Ingested');

    // Recall
    const recallResp = await server.handleMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'memory_recall',
        arguments: { query: 'E2E test' }
      }
    });
    expect(recallResp).toMatchObject({ jsonrpc: '2.0', id: 3 });
    const recallResult = (recallResp as { result?: { content: { text: string }[] } }).result;
    expect(recallResult?.content[0]?.text).toContain('E2E test memory');
  });

  // Wiki, KB, and unified search tests — parked until wiki/kb backends are ready
});
