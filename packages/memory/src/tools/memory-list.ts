import type { MemoryScope, ScopeManager } from '../scope/scope-manager.js';
import type { CapturedMemoryRecord } from './memory-capture.js';

export interface MemoryListInput {
  actorId?: string;
  scope?: MemoryScope;
}

export interface MemoryListResult {
  records: CapturedMemoryRecord[];
}

export interface MemoryListTool {
  execute(input?: MemoryListInput): Promise<MemoryListResult>;
}

export interface MemoryListToolDeps {
  list(): CapturedMemoryRecord[] | Promise<CapturedMemoryRecord[]>;
  scopeManager?: ScopeManager;
}

function cloneRecord(record: CapturedMemoryRecord): CapturedMemoryRecord {
  return {
    id: record.id,
    actorId: record.actorId,
    scope: record.scope,
    content: record.content,
    ...(record.title === undefined ? {} : { title: record.title }),
    ...(record.tags === undefined ? {} : { tags: [...record.tags] }),
    createdAt: new Date(record.createdAt)
  };
}

export function createMemoryListTool(deps: MemoryListToolDeps): MemoryListTool {
  return {
    async execute(input = {}) {
      const rows = await deps.list();
      const filtered = rows.filter(record => {
        if (input.scope && record.scope !== input.scope) {
          return false;
        }

        if (!(input.actorId && deps.scopeManager)) {
          return true;
        }

        return deps.scopeManager.canAccess({
          action: 'read',
          actorId: input.actorId,
          scope: record.scope
        });
      });

      return {
        records: filtered.map(cloneRecord)
      };
    }
  };
}
