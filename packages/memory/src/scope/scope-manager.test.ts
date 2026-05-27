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

  it('assertAccess throws on denied access', () => {
    const manager = createScopeManager();

    expect(() => manager.assertAccess({ action: 'read', actorId: 'a1', scope: 'project' })).toThrow('Access denied');
  });

  it('assertAccess passes on allowed access', () => {
    const manager = createScopeManager();

    manager.setPolicy({
      actorId: 'a1',
      grants: [{ actions: ['read'], scope: 'project' }]
    });

    expect(() => manager.assertAccess({ action: 'read', actorId: 'a1', scope: 'project' })).not.toThrow();
  });

  it('filterAccessibleScopes returns only accessible scopes', () => {
    const manager = createScopeManager();

    manager.setPolicy({
      actorId: 'a1',
      grants: [
        { actions: ['read'], scope: 'project' },
        { actions: ['read'], scope: 'user' }
      ]
    });

    const result = manager.filterAccessibleScopes('a1', 'read', ['project', 'user', 'session']);
    expect(result).toStrictEqual(['project', 'user']);
  });

  it('filterAccessibleScopes returns empty when no scopes match', () => {
    const manager = createScopeManager();

    const result = manager.filterAccessibleScopes('a1', 'read', ['project', 'user']);
    expect(result).toStrictEqual([]);
  });

  it('removePolicy removes the policy entry', () => {
    const manager = createScopeManager();

    manager.setPolicy({
      actorId: 'a1',
      grants: [{ actions: ['read'], scope: 'project' }]
    });

    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'project' })).toBeTruthy();

    manager.removePolicy('a1');
    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'project' })).toBeFalsy();
  });

  it('removePolicy is idempotent on non-existent actor', () => {
    const manager = createScopeManager();
    expect(() => manager.removePolicy('nonexistent')).not.toThrow();
  });

  it('grants global scope inherits to team, project, user, and session', () => {
    const manager = createScopeManager();

    manager.setPolicy({
      actorId: 'a1',
      grants: [{ actions: ['read'], includeDescendants: true, scope: 'global' }]
    });

    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'global' })).toBeTruthy();
    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'team' })).toBeTruthy();
    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'project' })).toBeTruthy();
    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'user' })).toBeTruthy();
    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'session' })).toBeTruthy();
  });

  it('grant without inheritance does not apply to descendants', () => {
    const manager = createScopeManager();

    manager.setPolicy({
      actorId: 'a1',
      grants: [{ actions: ['read'], scope: 'team' }]
    });

    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'team' })).toBeTruthy();
    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'project' })).toBeFalsy();
    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'session' })).toBeFalsy();
  });

  it('setPolicy deep copies grants to prevent mutation', () => {
    const manager = createScopeManager();
    const grants = [{ actions: ['read'] as const, scope: 'project' as const }];

    manager.setPolicy({ actorId: 'a1', grants });

    // Mutate the original array
    grants.push({ actions: ['write'], scope: 'session' });

    // The stored policy should not have been affected
    expect(manager.canAccess({ action: 'write', actorId: 'a1', scope: 'session' })).toBeFalsy();
  });

  it('handles multiple actors independently', () => {
    const manager = createScopeManager();

    manager.setPolicy({
      actorId: 'a1',
      grants: [{ actions: ['read'], scope: 'project' }]
    });
    manager.setPolicy({
      actorId: 'a2',
      grants: [{ actions: ['write'], scope: 'user' }]
    });

    expect(manager.canAccess({ action: 'read', actorId: 'a1', scope: 'project' })).toBeTruthy();
    expect(manager.canAccess({ action: 'write', actorId: 'a1', scope: 'user' })).toBeFalsy();
    expect(manager.canAccess({ action: 'read', actorId: 'a2', scope: 'project' })).toBeFalsy();
    expect(manager.canAccess({ action: 'write', actorId: 'a2', scope: 'user' })).toBeTruthy();
  });
});
