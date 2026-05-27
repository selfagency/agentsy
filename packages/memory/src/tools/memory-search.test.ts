import { describe, expect, it, vi } from 'vitest';

import { createMemorySearchTool } from './memory-search.js';

describe('memory_search tool', () => {
  it('delegates to retriever and returns ranked results', async () => {
    const tool = createMemorySearchTool({
      search: async () => [
        {
          reasons: ['lexical:1.00'],
          record: {
            content: 'oauth',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            id: 'auth',
            scope: 'project'
          },
          score: 0.9
        }
      ]
    });

    const result = await tool.execute({
      limit: 3,
      query: 'oauth',
      scope: 'project'
    });
    expect(result.results[0]?.record.id).toBe('auth');
  });

  it('returns empty results when scope manager denies access', async () => {
    const tool = createMemorySearchTool({
      scopeManager: {
        canAccess: vi.fn().mockReturnValue(false),
        assertAccess: vi.fn(),
        filterAccessibleScopes: vi.fn(),
        removePolicy: vi.fn(),
        setPolicy: vi.fn()
      },
      search: async () => [
        {
          reasons: ['lexical:1.00'],
          record: {
            content: 'secret',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            id: 'doc-1',
            scope: 'project'
          },
          score: 0.9
        }
      ]
    });

    const result = await tool.execute({
      actorId: 'user-1',
      query: 'secret',
      scope: 'project'
    });

    expect(result.results).toStrictEqual([]);
  });

  it('passes through all parameters to search function', async () => {
    const searchFn = vi.fn().mockResolvedValue([]);
    const tool = createMemorySearchTool({ search: searchFn });

    await tool.execute({ actorId: 'a1', limit: 5, query: 'test', scope: 'project' });

    expect(searchFn).toHaveBeenCalledWith({
      actorId: 'a1',
      limit: 5,
      query: 'test',
      scope: 'project'
    });
  });
});
