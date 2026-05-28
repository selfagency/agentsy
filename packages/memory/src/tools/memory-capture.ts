import { randomUUID } from 'node:crypto';

import type { MemoryScope, ScopeManager } from '../scope/scope-manager.js';

export interface CapturedMemoryRecord {
  actorId: string;
  content: string;
  createdAt: Date;
  id: string;
  scope: MemoryScope;
  tags?: string[];
  title?: string;
}

export interface MemoryCaptureInput {
  actorId: string;
  content: string;
  scope: MemoryScope;
  tags?: string[];
  title?: string;
}

export interface MemoryCaptureResult {
  record: CapturedMemoryRecord;
}

export interface MemoryCaptureTool {
  execute(input: MemoryCaptureInput): Promise<MemoryCaptureResult>;
}

export interface MemoryCaptureToolDeps {
  idFactory?: () => string;
  now?: () => Date;
  save(record: CapturedMemoryRecord): void | Promise<void>;
  scopeManager?: ScopeManager;
}

export function createMemoryCaptureTool(deps: MemoryCaptureToolDeps): MemoryCaptureTool {
  return {
    async execute(input) {
      deps.scopeManager?.assertAccess({
        action: 'write',
        actorId: input.actorId,
        scope: input.scope
      });

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
