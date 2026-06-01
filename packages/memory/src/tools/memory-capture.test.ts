import { describe, expect, it } from 'vitest';

import { createMemoryCaptureTool } from './memory-capture.js';

describe('memory_capture tool', () => {
  it('captures scoped memory records', async () => {
    const rows: Array<{ id: string; content: string; scope: string }> = [];
    const tool = createMemoryCaptureTool({
      save: record => {
        rows.push(record);
      }
    });

    const result = await tool.execute({ actorId: 'u1', scope: 'session', content: 'remember this' });
    expect(result.record.scope).toBe('session');
    expect(rows).toHaveLength(1);
  });
});
