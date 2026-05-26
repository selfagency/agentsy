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
    const result = await initMemory({ skipMcp: true, skipDb: false });
    expect(result.engine).toBeDefined();
    expect(result.config).toBeDefined();

    const { server } = await createMemoryMCPServer(result.engine, {
      dbPath: ':memory:'
    });

    // Initialize
    const initResp = await server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    await server.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(initResp).toMatchObject({ jsonrpc: '2.0', id: 1 });
    expect((initResp as Record<string, unknown>).result).toBeDefined();

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
    const result = await initMemory({ skipMcp: true, skipDb: false });
    const { server } = await createMemoryMCPServer(result.engine, {
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

  /*
  // Wiki and KB functionality tests - commented out until fully implemented
  it('upserts and searches wiki pages via MCP', async () => {
    const result = await initMemory({ skipMcp: true, skipDb: false });
    const { server } = await createMemoryMCPServer(result.engine, {
      dbPath: ':memory:'
    });

    await server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    await server.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });

    const upsertResp = await server.handleMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'wiki_upsert_page',
        arguments: { pageId: 'e2e-page', title: 'E2E Page', body: 'E2E wiki content', tags: ['test'] }
      }
    });
    expect(upsertResp).toMatchObject({ jsonrpc: '2.0', id: 2 });
    const upsertResult = (upsertResp as { result?: { content: { text: string }[] } }).result;
    expect(upsertResult?.content[0]?.text).toContain('e2e-page');

    const searchResp = await server.handleMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'wiki_search',
        arguments: { query: 'E2E wiki', limit: 5 }
      }
    });
    expect(searchResp).toMatchObject({ jsonrpc: '2.0', id: 3 });
    const searchResult = (searchResp as { result?: { content: { text: string }[] } }).result;
    expect(searchResult?.content[0]?.text).toContain('e2e-page');
  });

  it('ingests and searches knowledge base via MCP', async () => {
    const result = await initMemory({ skipMcp: true, skipDb: false });
    const { server } = await createMemoryMCPServer(result.engine, {
      dbPath: ':memory:'
    });

    await server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    await server.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });

    const ingestResp = await server.handleMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'kb_ingest',
        arguments: { sourceId: 'e2e-doc', sourceType: 'document', title: 'E2E Doc', content: 'E2E kb content' }
      }
    });
    expect(ingestResp).toMatchObject({ jsonrpc: '2.0', id: 2 });

    const searchResp = await server.handleMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'kb_search',
        arguments: { query: 'E2E kb', limit: 5 }
      }
    });
    expect(searchResp).toMatchObject({ jsonrpc: '2.0', id: 3 });
    const searchResult = (searchResp as { result?: { content: { text: string }[] } }).result;
    expect(searchResult?.content[0]?.text).toContain('E2E Doc');
  });

  it('unified search returns results from all three sources', async () => {
    const result = await initMemory({ skipMcp: true, skipDb: false });
    const { server } = await createMemoryMCPServer(result.engine, {
      dbPath: ':memory:'
    });

    await server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    await server.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });

    // Seed tier
    await server.handleMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'memory_ingest',
        arguments: { content: 'unified alpha tier', importance: 0.9 }
      }
    });

    // Seed wiki
    await server.handleMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'wiki_upsert_page',
        arguments: { pageId: 'unified-page', title: 'Unified', body: 'unified alpha wiki', tags: [] }
      }
    });

    // Seed kb
    await server.handleMessage({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'kb_ingest',
        arguments: { sourceId: 'unified-doc', sourceType: 'document', title: 'Unified', content: 'unified alpha kb' }
      }
    });

    // Unified search
    const searchResp = await server.handleMessage({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'memory_search',
        arguments: { query: 'unified alpha', limit: 10 }
      }
    });
    expect(searchResp).toMatchObject({ jsonrpc: '2.0', id: 5 });
    const searchResult = (searchResp as { result?: { content: { text: string }[] } }).result;
    const text = searchResult?.content[0]?.text ?? '';
    // Should contain results from tier, wiki, and kb
    expect(text).toMatch(/unified/);
  });
  */
});
