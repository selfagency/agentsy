import type { MemorySearchHit } from '../retrieval/retriever.js';
import type { MemoryScope, ScopeManager } from '../scope/scope-manager.js';

export interface MemorySearchToolInput {
  actorId?: string;
  limit?: number;
  query: string;
  scope?: MemoryScope;
}

export interface MemorySearchToolResult {
  results: MemorySearchHit[];
}

export interface MemorySearchTool {
  execute(input: MemorySearchToolInput): Promise<MemorySearchToolResult>;
}

export interface MemorySearchToolDeps {
  scopeManager?: ScopeManager;
  search(input: { query: string; scope?: MemoryScope; actorId?: string; limit?: number }): Promise<MemorySearchHit[]>;
}

export function createMemorySearchTool(deps: MemorySearchToolDeps): MemorySearchTool {
  return {
    async execute(input) {
      if (input.scope && input.actorId && deps.scopeManager) {
        const allowed = deps.scopeManager.canAccess({
          action: 'read',
          actorId: input.actorId,
          scope: input.scope
        });
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
