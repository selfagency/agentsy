import { randomUUID } from 'node:crypto';

import type { MemoryScope, ScopeManager } from '../scope/scope-manager.js';

export interface CapturedMemoryRecord {
  id: string;
  actorId: string;
  scope: MemoryScope;
  content: string;
  title?: string;
  tags?: string[];
  createdAt: Date;
}

export interface MemoryCaptureInput {
  actorId: string;
  scope: MemoryScope;
  content: string;
  title?: string;
  tags?: string[];
}

export interface MemoryCaptureResult {
  record: CapturedMemoryRecord;
}

export interface MemoryCaptureTool {
  execute(input: MemoryCaptureInput): Promise<MemoryCaptureResult>;
}

export interface MemoryCaptureToolDeps {
  save(record: CapturedMemoryRecord): void | Promise<void>;
  scopeManager?: ScopeManager;
  idFactory?: () => string;
  now?: () => Date;
}

export function createMemoryCaptureTool(deps: MemoryCaptureToolDeps): MemoryCaptureTool {
  return {
    async execute(input) {
      deps.scopeManager?.assertAccess({ actorId: input.actorId, action: 'write', scope: input.scope });

      const record: CapturedMemoryRecord = {
        id: deps.idFactory?.() ?? randomUUID(),
        actorId: input.actorId,
        scope: input.scope,
        content: input.content,
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
        createdAt: deps.now?.() ?? new Date()
      };

      await deps.save(record);
      return { record };
    }
  };
}
