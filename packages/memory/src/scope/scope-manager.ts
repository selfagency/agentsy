export type MemoryScope = 'session' | 'user' | 'project' | 'team' | 'global';
export type ScopeAction = 'read' | 'write';

export interface ScopeGrant {
  scope: MemoryScope;
  actions: ScopeAction[];
  includeDescendants?: boolean;
}

export interface ScopePolicy {
  actorId: string;
  grants: ScopeGrant[];
}

export interface ScopeAccessRequest {
  actorId: string;
  action: ScopeAction;
  scope: MemoryScope;
}

export interface ScopeManager {
  setPolicy(policy: ScopePolicy): void;
  removePolicy(actorId: string): void;
  canAccess(request: ScopeAccessRequest): boolean;
  assertAccess(request: ScopeAccessRequest): void;
  filterAccessibleScopes(actorId: string, action: ScopeAction, scopes: MemoryScope[]): MemoryScope[];
}

const SCOPE_DESCENDANTS: Record<MemoryScope, readonly MemoryScope[]> = {
  global: ['team', 'project', 'user', 'session'],
  project: ['user', 'session'],
  session: [],
  team: ['project', 'user', 'session'],
  user: ['session']
};

function grantMatchesScope(grant: ScopeGrant, requestedScope: MemoryScope): boolean {
  if (grant.scope === requestedScope) {
    return true;
  }

  if (!grant.includeDescendants) {
    return false;
  }

  return SCOPE_DESCENDANTS[grant.scope].includes(requestedScope);
}

export function createScopeManager(): ScopeManager {
  const policies = new Map<string, ScopePolicy>();

  return {
    assertAccess(request) {
      if (!this.canAccess(request)) {
        throw new Error(
          `Access denied: actor=${request.actorId} action=${request.action} scope=${request.scope} (deny-by-default)`
        );
      }
    },

    canAccess(request) {
      const policy = policies.get(request.actorId);
      if (!policy) {
        return false;
      }

      return policy.grants.some(
        grant => grant.actions.includes(request.action) && grantMatchesScope(grant, request.scope)
      );
    },

    filterAccessibleScopes(actorId, action, scopes) {
      return scopes.filter(scope => this.canAccess({ action, actorId, scope }));
    },

    removePolicy(actorId) {
      policies.delete(actorId);
    },

    setPolicy(policy) {
      policies.set(policy.actorId, {
        actorId: policy.actorId,
        grants: policy.grants.map(grant => ({
          actions: [...grant.actions],
          includeDescendants: grant.includeDescendants ?? false,
          scope: grant.scope
        }))
      });
    }
  };
}
