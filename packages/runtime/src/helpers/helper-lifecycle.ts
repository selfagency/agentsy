import type { RuntimeHelperExecutionResult, RuntimeHelperInvocation } from './types.js';

export interface RuntimeHelperLifecycleEventMap {
  onComplete?: (result: RuntimeHelperExecutionResult) => void;
  onFailure?: (error: Error, invocation: RuntimeHelperInvocation) => void;
  onStart?: (invocation: RuntimeHelperInvocation) => void;
}

export function emitHelperStart(events: RuntimeHelperLifecycleEventMap, invocation: RuntimeHelperInvocation): void {
  events.onStart?.(invocation);
}

export function emitHelperComplete(events: RuntimeHelperLifecycleEventMap, result: RuntimeHelperExecutionResult): void {
  events.onComplete?.(result);
}

export function emitHelperFailure(
  events: RuntimeHelperLifecycleEventMap,
  error: Error,
  invocation: RuntimeHelperInvocation
): void {
  events.onFailure?.(error, invocation);
}
