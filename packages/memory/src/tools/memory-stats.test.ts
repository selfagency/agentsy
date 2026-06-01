import { describe, expect, it } from 'vitest';

import { createMemoryStatsTool } from './memory-stats.js';

describe('memory_stats tool', () => {
  it('returns aggregated counts by scope', async () => {
    const tool = createMemoryStatsTool({
      list: () => [
        {
          actorId: 'u1',
          content: 'a',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          id: '1',
          scope: 'session'
        },
        {
          actorId: 'u1',
          content: 'b',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          id: '2',
          scope: 'project'
        },
        {
          actorId: 'u1',
          content: 'c',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          id: '3',
          scope: 'project'
        }
      ]
    });

    const result = await tool.execute();
    expect(result.totalRecords).toBe(3);
    expect(result.averageContentLength).toBe(1);
    expect(result.byScope.project).toBe(2);
  });

  it('returns zero stats when no records', async () => {
    const tool = createMemoryStatsTool({ list: () => [] });

    const result = await tool.execute();
    expect(result.totalRecords).toBe(0);
    expect(result.averageContentLength).toBe(0);
    expect(result.byScope).toEqual({
      global: 0,
      project: 0,
      session: 0,
      team: 0,
      user: 0
    });
  });
});
