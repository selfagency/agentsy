import type { RuntimeHelperExecutionResult } from './types.js';

export interface RuntimeHelperCheckpoint {
  helperId: string;
  sessionId: string;
  updatedAt: number;
}

export function toRuntimeHelperCheckpoint(result: RuntimeHelperExecutionResult): RuntimeHelperCheckpoint {
  return {
    helperId: result.helperId,
    sessionId: result.sessionId,
    updatedAt: Date.now()
  };
}
