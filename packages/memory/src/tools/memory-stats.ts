import type { MemoryScope } from '../scope/scope-manager.js';
import type { CapturedMemoryRecord } from './memory-capture.js';

export interface MemoryStats {
  averageContentLength: number;
  byScope: Record<MemoryScope, number>;
  totalRecords: number;
}

export interface MemoryStatsTool {
  execute(): Promise<MemoryStats>;
}

export interface MemoryStatsToolDeps {
  list(): CapturedMemoryRecord[] | Promise<CapturedMemoryRecord[]>;
}

function emptyByScope(): Record<MemoryScope, number> {
  return {
    global: 0,
    project: 0,
    session: 0,
    team: 0,
    user: 0
  };
}

export function createMemoryStatsTool(deps: MemoryStatsToolDeps): MemoryStatsTool {
  return {
    async execute() {
      const records = await deps.list();
      const byScope = emptyByScope();
      let totalContentLength = 0;

      for (const record of records) {
        byScope[record.scope] += 1;
        totalContentLength += record.content.length;
      }

      return {
        averageContentLength: records.length === 0 ? 0 : totalContentLength / records.length,
        byScope,
        totalRecords: records.length
      };
    }
  };
}
