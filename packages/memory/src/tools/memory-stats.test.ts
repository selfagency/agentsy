import { describe, expect, it } from 'vitest';

import { createMemoryStatsTool } from './memory-stats.js';

describe('memory_stats tool', () => {
  it('returns aggregated counts by scope', async () => {
    const tool = createMemoryStatsTool({
      list: () => [
        { id: '1', actorId: 'u1', scope: 'session', content: 'a', createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: '2', actorId: 'u1', scope: 'project', content: 'b', createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: '3', actorId: 'u1', scope: 'project', content: 'c', createdAt: new Date('2026-01-01T00:00:00Z') }
      ]
    });

    const result = await tool.execute();
    expect(result.totalRecords).toBe(3);
    expect(result.byScope.project).toBe(2);
  });
});
