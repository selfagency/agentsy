import { describe, expect, it } from 'vitest';

import { createMemoryListTool } from './memory-list.js';

describe('memory_list tool', () => {
  it('lists records by scope', async () => {
    const tool = createMemoryListTool({
      list: () => [
        {
          actorId: 'u1',
          content: 's',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          id: '1',
          scope: 'session'
        },
        {
          actorId: 'u1',
          content: 'p',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          id: '2',
          scope: 'project'
        }
      ]
    });

    const result = await tool.execute({ scope: 'session' });
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.id).toBe('1');
  });
});
