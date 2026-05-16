import { describe, expect, it } from 'vitest';

import { createScopeManager } from './scope-manager.js';

describe('ScopeManager', () => {
  it('denies by default', () => {
    const manager = createScopeManager();

    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'project' })).toBeFalsy();
  });

  it('enforces explicit grants and inheritance', () => {
    const manager = createScopeManager();

    manager.setPolicy({
      actorId: 'a1',
      grants: [{ actions: ['read'], includeDescendants: true, scope: 'project' }]
    });

    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'project' })).toBeTruthy();
    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'session' })).toBeTruthy();
    expect(manager.canAccess({ action: 'write', actorId: 'a1', scope: 'project' })).toBeFalsy();
  });
});
