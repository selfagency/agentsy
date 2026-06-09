import { describe, expect, it } from 'vitest';

import { createHelperRoleRegistry } from './registry.js';

describe('createHelperRoleRegistry', () => {
  it('registers and lists helpers', () => {
    const registry = createHelperRoleRegistry();
    registry.register({
      id: 'planner',
      name: 'Planner',
      description: 'desc',
      capabilities: ['planning'],
      trigger: 'manual',
      visibility: 'user-visible'
    });

    expect(registry.list()).toHaveLength(1);
    expect(registry.get('planner')?.name).toBe('Planner');
  });
});
