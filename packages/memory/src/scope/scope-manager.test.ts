import { describe, expect, it } from 'vitest';

import { createScopeManager } from './scope-manager.js';

describe('ScopeManager', () => {
  it('denies by default', () => {
    const manager = createScopeManager();

    expect(manager.canAccess({ actorId: 'a1', action: 'read', scope: 'project' })).toBe(false);
  });

  it('enforces explicit grants and inheritance', () => {
    const manager = createScopeManager();

    manager.setPolicy({
      actorId: 'a1',
      grants: [{ scope: 'project', actions: ['read'], includeDescendants: true }]
    });

    expect(manager.canAccess({ actorId: 'a1', action: 'read', scope: 'project' })).toBe(true);
    expect(manager.canAccess({ actorId: 'a1', action: 'read', scope: 'session' })).toBe(true);
    expect(manager.canAccess({ actorId: 'a1', action: 'write', scope: 'project' })).toBe(false);
  });
});
