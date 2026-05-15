import type { MemoryScope, ScopeManager } from '../scope/scope-manager.js';
import type { MemorySearchHit } from '../retrieval/retriever.js';

export interface MemorySearchToolInput {
  actorId?: string;
  query: string;
  scope?: MemoryScope;
  limit?: number;
}

export interface MemorySearchToolResult {
  results: MemorySearchHit[];
}

export interface MemorySearchTool {
  execute(input: MemorySearchToolInput): Promise<MemorySearchToolResult>;
}

export interface MemorySearchToolDeps {
  search(input: { query: string; scope?: MemoryScope; actorId?: string; limit?: number }): Promise<MemorySearchHit[]>;
  scopeManager?: ScopeManager;
}

export function createMemorySearchTool(deps: MemorySearchToolDeps): MemorySearchTool {
  return {
    async execute(input) {
      if (input.scope && input.actorId && deps.scopeManager) {
        const allowed = deps.scopeManager.canAccess({ actorId: input.actorId, action: 'read', scope: input.scope });
        if (!allowed) {
          return { results: [] };
        }
      }

      const results = await deps.search({
        query: input.query,
        ...(input.scope === undefined ? {} : { scope: input.scope }),
        ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
        ...(input.limit === undefined ? {} : { limit: input.limit })
      });

      return { results };
    }
  };
}
