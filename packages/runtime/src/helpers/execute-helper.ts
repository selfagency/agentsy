import {
  emitHelperComplete,
  emitHelperFailure,
  emitHelperStart,
  type RuntimeHelperLifecycleEventMap
} from './helper-lifecycle.js';
import type { RuntimeHelperExecutionResult, RuntimeHelperExecutor, RuntimeHelperInvocation } from './types.js';

export async function executeRuntimeHelper<TInput = unknown, TOutput = unknown>(
  invocation: RuntimeHelperInvocation<TInput>,
  execute: RuntimeHelperExecutor<TInput, TOutput>,
  signal: AbortSignal = new AbortController().signal,
  events: RuntimeHelperLifecycleEventMap = {}
): Promise<RuntimeHelperExecutionResult<TOutput>> {
  emitHelperStart(events, invocation);

  try {
    const output = await execute(invocation, signal);
    const result: RuntimeHelperExecutionResult<TOutput> = {
      helperId: invocation.helperId,
      output,
      sessionId: invocation.sessionId
    };
    emitHelperComplete(events, result);
    return result;
  } catch (error) {
    const runtimeError = error instanceof Error ? error : new Error('Helper execution failed');
    emitHelperFailure(events, runtimeError, invocation);
    throw runtimeError;
  }
}
