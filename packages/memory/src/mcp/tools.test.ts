import { describe, it, expect } from 'vitest';

import { createMemoryEngine } from '../cognitive/memory-engine.js';
import { createMemoryMcpTools } from './tools.js';

describe('MCP Tools', () => {
  function setup() {
    const engine = createMemoryEngine();
    const { definitions, handlers } = createMemoryMcpTools(engine);
    return { engine, definitions, handlers };
  }

  it('should create all 8 tool definitions', () => {
    const { definitions } = setup();
    expect(Object.keys(definitions)).toHaveLength(8);
    expect(definitions.memory_ingest).toBeDefined();
    expect(definitions.memory_recall).toBeDefined();
    expect(definitions.memory_awaken).toBeDefined();
    expect(definitions.memory_stats).toBeDefined();
    expect(definitions.memory_lint).toBeDefined();
    expect(definitions.memory_list).toBeDefined();
    expect(definitions.memory_search).toBeDefined();
    expect(definitions.memory_capture).toBeDefined();
  });

  it('should ingest content via memory_ingest', async () => {
    const { handlers } = setup();
    const handler = handlers['memory_ingest']!;
    const result = await handler({ content: 'Hello world' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toMatch(/^Ingested: mem-\d+$/);
  });

  it('should reject ingest without content', async () => {
    const { handlers } = setup();
    const handler = handlers['memory_ingest']!;
    const result = await handler({ content: '' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('required');
  });

  it('should recall memories via memory_recall', async () => {
    const { engine, handlers } = setup();
    engine.ingest('test memory one');
    engine.ingest('test memory two');

    const handler = handlers['memory_recall']!;
    const result = await handler({});
    expect(result.content[0]!.text).toContain('test memory');
  });

  it('should filter recall by query', async () => {
    const { engine, handlers } = setup();
    engine.ingest('apple fruit');
    engine.ingest('banana fruit');

    const handler = handlers['memory_recall']!;
    const result = await handler({ query: 'apple' });
    expect(result.content[0]!.text).toContain('apple');
  });

  it('should return no memories when none match', async () => {
    const { handlers } = setup();
    const handler = handlers['memory_recall']!;
    const result = await handler({ query: 'nonexistent' });
    expect(result.content[0]!.text).toContain('No memories matched');
  });

  it('should run awaken via memory_awaken', async () => {
    const { handlers } = setup();
    const handler = handlers['memory_awaken']!;
    const result = await handler({});
    expect(result.content[0]!.text).toContain('Awaken:');
    expect(result.content[0]!.text).toContain('Decay');
    expect(result.content[0]!.text).toContain('Consolidation');
  });

  it('should return stats via memory_stats', async () => {
    const { engine, handlers } = setup();
    engine.ingest('some memory');

    const handler = handlers['memory_stats']!;
    const result = await handler({});
    expect(result.content[0]!.text).toContain('Items: 1');
    expect(result.content[0]!.text).toContain('Budget');
  });

  it('should return health OK via memory_lint when healthy', async () => {
    const { engine, handlers } = setup();
    engine.ingest('some memory');

    const handler = handlers['memory_lint']!;
    const result = await handler({});
    expect(result.content[0]!.text).toContain('Health: OK');
  });

  it('should report issues via memory_lint when empty', async () => {
    const { handlers } = setup();
    const handler = handlers['memory_lint']!;
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('No memories');
  });

  it('should list memories in a specific tier via memory_list', async () => {
    const { engine, handlers } = setup();
    engine.ingest('sensory item');

    const handler = handlers['memory_list']!;
    const result = await handler({ tier: 'sensory_buffer' });
    expect(result.content[0]!.text).toContain('sensory_buffer');
  });

  it('should return empty message for empty tier', async () => {
    const { handlers } = setup();
    const handler = handlers['memory_list']!;
    const result = await handler({ tier: 'working_memory' });
    expect(result.content[0]!.text).toContain('No items in');
  });

  it('should use memory_search as alias for memory_recall', async () => {
    const { engine, handlers } = setup();
    engine.ingest('searchable content');

    const handler = handlers['memory_search']!;
    const result = await handler({ query: 'searchable' });
    expect(result.content[0]!.text).toContain('searchable');
  });

  it('should use memory_capture as alias for memory_ingest', async () => {
    const { handlers } = setup();
    const handler = handlers['memory_capture']!;
    const result = await handler({ content: 'captured item' });
    expect(result.content[0]!.text).toMatch(/^Ingested: mem-\d+$/);
  });

  it('should ingest with kind and importance', async () => {
    const { engine, handlers } = setup();
    const handler = handlers['memory_ingest']!;
    const result = await handler({
      content: 'important memory',
      importance: 0.9,
      kind: 'semantic'
    });
    expect(result.isError).toBeUndefined();

    const stats = engine.stats();
    expect(stats.totalItems).toBe(1);
  });
});
