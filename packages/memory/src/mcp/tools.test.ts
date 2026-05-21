import { describe, it, expect } from 'vitest';

import { createMemoryEngine } from '../cognitive/memory-engine.js';
import { createKnowledgeBaseManager } from '../retrieval/rag/knowledge-base.js';
import { createWikiManager } from '../wiki/wiki-manager.js';
import { createMemoryMcpTools } from './tools.js';

function setup() {
  const engine = createMemoryEngine();
  const { definitions, handlers } = createMemoryMcpTools({ engine });
  return { engine, definitions, handlers };
}

function setupWithUnified() {
  const engine = createMemoryEngine();
  const wiki = createWikiManager();
  const kb = createKnowledgeBaseManager();
  const { definitions, handlers } = createMemoryMcpTools({ engine, wiki, kb });
  return { engine, wiki, kb, definitions, handlers };
}

function getHandler(
  handlers: Record<string, (args: Record<string, unknown>) => Promise<unknown>>,
  name: string
): (args: Record<string, unknown>) => Promise<unknown> {
  const handler = handlers[name];
  expect(handler).toBeDefined();
  return handler as (args: Record<string, unknown>) => Promise<unknown>;
}

describe('MCP Tools', () => {
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
    const handler = getHandler(handlers, 'memory_ingest');
    const result = (await handler({ content: 'Hello world' })) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };
    expect(result.isError).toBeUndefined();
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toMatch(/^Ingested: mem-\d+$/);
  });

  it('should reject ingest without content', async () => {
    const { handlers } = setup();
    const handler = getHandler(handlers, 'memory_ingest');
    const result = (await handler({ content: '' })) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };
    expect(result.isError).toBe(true);
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toContain('required');
  });

  it('should recall memories via memory_recall', async () => {
    const { engine, handlers } = setup();
    engine.ingest('test memory one');
    engine.ingest('test memory two');

    const handler = getHandler(handlers, 'memory_recall');
    const result = (await handler({})) as {
      content: Array<{ type: string; text: string }>;
    };
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toContain('test memory');
  });

  it('should filter recall by query', async () => {
    const { engine, handlers } = setup();
    engine.ingest('apple fruit');
    engine.ingest('banana fruit');

    const handler = getHandler(handlers, 'memory_recall');
    const result = (await handler({ query: 'apple' })) as {
      content: Array<{ type: string; text: string }>;
    };
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toContain('apple');
  });

  it('should return no memories when none match', async () => {
    const { handlers } = setup();
    const handler = getHandler(handlers, 'memory_recall');
    const result = (await handler({ query: 'nonexistent' })) as {
      content: Array<{ type: string; text: string }>;
    };
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toContain('No memories matched');
  });

  it('should run awaken via memory_awaken', async () => {
    const { handlers } = setup();
    const handler = getHandler(handlers, 'memory_awaken');
    const result = (await handler({})) as {
      content: Array<{ type: string; text: string }>;
    };
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toContain('Awaken:');
    expect(firstContent?.text).toContain('Decay');
    expect(firstContent?.text).toContain('Consolidation');
  });

  it('should return stats via memory_stats', async () => {
    const { engine, handlers } = setup();
    engine.ingest('some memory');

    const handler = getHandler(handlers, 'memory_stats');
    const result = (await handler({})) as {
      content: Array<{ type: string; text: string }>;
    };
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toContain('Items: 1');
    expect(firstContent?.text).toContain('Budget');
  });

  it('should return health OK via memory_lint when healthy', async () => {
    const { engine, handlers } = setup();
    engine.ingest('some memory');

    const handler = getHandler(handlers, 'memory_lint');
    const result = (await handler({})) as {
      content: Array<{ type: string; text: string }>;
    };
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toContain('Health: OK');
  });

  it('should report issues via memory_lint when empty', async () => {
    const { handlers } = setup();
    const handler = getHandler(handlers, 'memory_lint');
    const result = (await handler({})) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };
    expect(result.isError).toBe(true);
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toContain('No memories');
  });

  it('should list memories in a specific tier via memory_list', async () => {
    const { engine, handlers } = setup();
    engine.ingest('sensory item');

    const handler = getHandler(handlers, 'memory_list');
    const result = (await handler({ tier: 'sensory_buffer' })) as {
      content: Array<{ type: string; text: string }>;
    };
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toContain('sensory_buffer');
  });

  it('should return empty message for empty tier', async () => {
    const { handlers } = setup();
    const handler = getHandler(handlers, 'memory_list');
    const result = (await handler({ tier: 'working_memory' })) as {
      content: Array<{ type: string; text: string }>;
    };
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toContain('No items in');
  });

  it('should use memory_search as alias for memory_recall', async () => {
    const { engine, handlers } = setup();
    engine.ingest('searchable content');

    const handler = getHandler(handlers, 'memory_search');
    const result = (await handler({ query: 'searchable' })) as {
      content: Array<{ type: string; text: string }>;
    };
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toContain('searchable');
  });

  it('should use memory_capture as alias for memory_ingest', async () => {
    const { handlers } = setup();
    const handler = getHandler(handlers, 'memory_capture');
    const result = (await handler({ content: 'captured item' })) as {
      content: Array<{ type: string; text: string }>;
    };
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toMatch(/^Ingested: mem-\d+$/);
  });

  it('should ingest with kind and importance', async () => {
    const { engine, handlers } = setup();
    const handler = getHandler(handlers, 'memory_ingest');
    const result = (await handler({
      content: 'important memory',
      importance: 0.9,
      kind: 'semantic'
    })) as { isError?: boolean };
    expect(result.isError).toBeUndefined();

    const stats = engine.stats();
    expect(stats.totalItems).toBe(1);
  });

  describe('unified search', () => {
    it('memory_recall with scope=unified returns combined tier, wiki, and rag results', async () => {
      const { engine, wiki, kb, handlers } = setupWithUnified();
      engine.ingest('tier memory', { importance: 0.8 });
      await wiki.upsertPage({ pageId: 'p1', title: 'Wiki Page', body: 'wiki memory', tags: ['t'] });
      await kb.ingest({
        sourceId: 's1',
        sourceType: 'document',
        title: 'RAG Doc',
        content: 'rag memory',
        updatedAt: new Date().toISOString()
      });

      const handler = getHandler(handlers, 'memory_recall');
      const result = (await handler({ query: 'memory', scope: 'unified' })) as {
        content: Array<{ type: string; text: string }>;
      };
      const text = result.content[0]?.text ?? '';
      expect(text).toContain('[tier]');
      expect(text).toContain('[wiki]');
      expect(text).toContain('[rag]');
      expect(text).toContain('Found');
    });

    it('memory_search with scope=unified returns combined results', async () => {
      const { engine, wiki, kb, handlers } = setupWithUnified();
      engine.ingest('searchable', { importance: 0.8 });
      await wiki.upsertPage({ pageId: 'p1', title: 'Wiki', body: 'searchable wiki', tags: ['t'] });
      await kb.ingest({
        sourceId: 's1',
        sourceType: 'document',
        title: 'RAG',
        content: 'searchable rag',
        updatedAt: new Date().toISOString()
      });

      const handler = getHandler(handlers, 'memory_search');
      const result = (await handler({ query: 'searchable', scope: 'unified' })) as {
        content: Array<{ type: string; text: string }>;
      };
      const text = result.content[0]?.text ?? '';
      expect(text).toContain('[tier]');
      expect(text).toContain('[wiki]');
      expect(text).toContain('[rag]');
    });

    it('memory_recall with scope=wiki returns only wiki results', async () => {
      const { engine, wiki, kb, handlers } = setupWithUnified();
      engine.ingest('tier data', { importance: 0.8 });
      await wiki.upsertPage({ pageId: 'p1', title: 'Wiki Only', body: 'wiki data', tags: ['t'] });
      await kb.ingest({
        sourceId: 's1',
        sourceType: 'document',
        title: 'RAG',
        content: 'rag data',
        updatedAt: new Date().toISOString()
      });

      const handler = getHandler(handlers, 'memory_recall');
      const result = (await handler({ query: 'data', scope: 'wiki' })) as {
        content: Array<{ type: string; text: string }>;
      };
      const text = result.content[0]?.text ?? '';
      expect(text).toContain('[wiki]');
      expect(text).not.toContain('[tier]');
      expect(text).not.toContain('[rag]');
    });

    it('memory_recall with scope=rag returns only rag results', async () => {
      const { engine, wiki, kb, handlers } = setupWithUnified();
      engine.ingest('tier data', { importance: 0.8 });
      await wiki.upsertPage({ pageId: 'p1', title: 'Wiki', body: 'wiki data', tags: ['t'] });
      await kb.ingest({
        sourceId: 's1',
        sourceType: 'document',
        title: 'RAG Only',
        content: 'rag data',
        updatedAt: new Date().toISOString()
      });

      const handler = getHandler(handlers, 'memory_recall');
      const result = (await handler({ query: 'data', scope: 'rag' })) as {
        content: Array<{ type: string; text: string }>;
      };
      const text = result.content[0]?.text ?? '';
      expect(text).toContain('[rag]');
      expect(text).not.toContain('[tier]');
      expect(text).not.toContain('[wiki]');
    });

    it('memory_recall with scope=tiers returns only tier results', async () => {
      const { engine, wiki, kb, handlers } = setupWithUnified();
      engine.ingest('tier data', { importance: 0.8 });
      await wiki.upsertPage({ pageId: 'p1', title: 'Wiki', body: 'wiki data', tags: ['t'] });
      await kb.ingest({
        sourceId: 's1',
        sourceType: 'document',
        title: 'RAG',
        content: 'rag data',
        updatedAt: new Date().toISOString()
      });

      const handler = getHandler(handlers, 'memory_recall');
      const result = (await handler({ query: 'data', scope: 'tiers' })) as {
        content: Array<{ type: string; text: string }>;
      };
      const text = result.content[0]?.text ?? '';
      expect(text).toContain('[tier]');
      expect(text).not.toContain('[wiki]');
      expect(text).not.toContain('[rag]');
    });

    it('memory_recall defaults to unified scope when omitted', async () => {
      const { engine, wiki, handlers } = setupWithUnified();
      engine.ingest('default scope', { importance: 0.8 });
      await wiki.upsertPage({ pageId: 'p1', title: 'Wiki', body: 'default scope', tags: ['t'] });

      const handler = getHandler(handlers, 'memory_recall');
      const result = (await handler({ query: 'scope' })) as {
        content: Array<{ type: string; text: string }>;
      };
      const text = result.content[0]?.text ?? '';
      expect(text).toContain('[tier]');
      expect(text).toContain('[wiki]');
    });

    it('falls back to tier-only recall when wiki and kb are not provided', async () => {
      const { engine, handlers } = setup();
      engine.ingest('fallback', { importance: 0.8 });

      const handler = getHandler(handlers, 'memory_recall');
      const result = (await handler({ query: 'fallback' })) as {
        content: Array<{ type: string; text: string }>;
      };
      const text = result.content[0]?.text ?? '';
      expect(text).toContain('fallback');
      expect(text).toContain('[sensory_buffer]');
    });
  });
});
