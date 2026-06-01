import { describe, expect, it } from 'vitest';

import { createMemorySearchTool } from './memory-search.js';

describe('memory_search tool', () => {
  it('delegates to retriever and returns ranked results', async () => {
    const tool = createMemorySearchTool({
      search: async () => [
        {
          record: { id: 'auth', scope: 'project', content: 'oauth', createdAt: new Date('2026-01-01T00:00:00Z') },
          score: 0.9,
          reasons: ['lexical:1.00']
        }
      ]
    });

    const result = await tool.execute({ query: 'oauth', scope: 'project', limit: 3 });
    expect(result.results[0]?.record.id).toBe('auth');
  });
});
