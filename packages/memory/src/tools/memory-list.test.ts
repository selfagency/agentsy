import { describe, expect, it } from 'vitest';

import { createMemoryListTool } from './memory-list.js';

describe('memory_list tool', () => {
  it('lists records by scope', async () => {
    const tool = createMemoryListTool({
      list: () => [
        { id: '1', actorId: 'u1', scope: 'session', content: 's', createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: '2', actorId: 'u1', scope: 'project', content: 'p', createdAt: new Date('2026-01-01T00:00:00Z') }
      ]
    });

    const result = await tool.execute({ scope: 'session' });
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.id).toBe('1');
  });
});
