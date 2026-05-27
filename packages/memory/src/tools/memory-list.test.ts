import { describe, expect, it, vi } from 'vitest';

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

  it('includes records when actorId without scopeManager', async () => {
    const tool = createMemoryListTool({
      list: () => [
        {
          actorId: 'u1',
          content: 'c',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          id: '1',
          scope: 'project'
        }
      ]
    });

    const result = await tool.execute({ actorId: 'u1' });
    expect(result.records).toHaveLength(1);
  });

  it('filters records by scopeManager when actorId and scopeManager provided', async () => {
    const canAccess = vi.fn().mockReturnValue(true);
    const tool = createMemoryListTool({
      list: () => [
        {
          actorId: 'u1',
          content: 'c',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          id: '1',
          scope: 'project'
        }
      ],
      scopeManager: { canAccess }
    });

    const result = await tool.execute({ actorId: 'u1' });
    expect(result.records).toHaveLength(1);
    expect(canAccess).toHaveBeenCalledWith({
      action: 'read',
      actorId: 'u1',
      scope: 'project'
    });
  });

  it('excludes records denied by scopeManager', async () => {
    const canAccess = vi.fn().mockReturnValue(false);
    const tool = createMemoryListTool({
      list: () => [
        {
          actorId: 'u1',
          content: 'c',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          id: '1',
          scope: 'project'
        }
      ],
      scopeManager: { canAccess }
    });

    const result = await tool.execute({ actorId: 'u1' });
    expect(result.records).toHaveLength(0);
  });

  it('clones records with title and tags', async () => {
    const tool = createMemoryListTool({
      list: () => [
        {
          actorId: 'u1',
          content: 'c',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          id: '1',
          scope: 'project',
          title: 'my-title',
          tags: ['a', 'b']
        }
      ]
    });

    const result = await tool.execute();
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.title).toBe('my-title');
    expect(result.records[0]?.tags).toStrictEqual(['a', 'b']);
  });
});
