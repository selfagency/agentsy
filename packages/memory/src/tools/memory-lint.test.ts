import { describe, expect, it } from 'vitest';

import { createMemoryLintTool } from './memory-lint.js';

describe('memory_lint tool', () => {
  it('flags secret-like patterns and oversized records', async () => {
    const tool = createMemoryLintTool({
      list: () => [
        { id: '1', actorId: 'u1', scope: 'session', content: 'normal', createdAt: new Date('2026-01-01T00:00:00Z') },
        {
          id: '2',
          actorId: 'u1',
          scope: 'project',
          content: 'api_key=sk_live_123456789',
          createdAt: new Date('2026-01-01T00:00:00Z')
        },
        {
          id: '3',
          actorId: 'u1',
          scope: 'project',
          content: 'x'.repeat(1_500),
          createdAt: new Date('2026-01-01T00:00:00Z')
        }
      ]
    });

    const result = await tool.execute({ maxContentLength: 1024 });
    expect(result.issues.some(issue => issue.code === 'secret-like-pattern')).toBe(true);
    expect(result.issues.some(issue => issue.code === 'oversized-record')).toBe(true);
  });
});
