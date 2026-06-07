/**
 * @module Recovery gate hook — structured error recovery for failed tool calls.
 *
 * Provides a hook that runs after tool-call failure or on error, creating a
 * {@link RecoveryExecutor} from the given policy and executing the full
 * retry-loop / fallback-loop / escalation lifecycle against a re-thrown
 * version of the original error.
 *
 * @example
 * ```ts
 * import { createRecoveryHook } from './hooks/recovery-gate.js';
 *
 * const hook = createRecoveryHook(recoveryPolicy);
 * // hook.phase === 'afterToolCall'
 * // hook.priority === 20
 * ```
 */

import { RecoveryExecutor, type RecoveryPolicy } from '../recovery/policy.js';
import type { HookDefinition } from './types.js';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Context passed through the hook chain during execution.
 *
 * Carries agent identity, the current tool invocation, error state, and
 * arbitrary metadata that hooks may read or write.
 */
export interface HookContext {
  agentId: string;
  blocked?: boolean;
  error?: Error;
  metadata: Record<string, unknown>;
  reason?: string;
  role: string;
  toolInput?: unknown;
  toolName?: string;
  toolOutput?: unknown;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Handler type
// ---------------------------------------------------------------------------

/** Hook handler function signature. */
type HookHandler = (ctx: HookContext) => Promise<HookContext>;

/**
 * A {@link HookDefinition} paired with its handler function.
 */
export type RecoveryGateHook = HookDefinition & {
  handler: HookHandler;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a recovery hook that triggers the structured error recovery
 * lifecycle when a tool call has failed.
 *
 * The hook runs in the `afterToolCall` phase at priority 20 (recovery
 * tier).  It only fires when `ctx.error` is set, indicating the preceding
 * tool call raised an error.
 *
 * The handler:
 * 1. Creates a {@link RecoveryExecutor} from the supplied policy.
 * 2. Calls `executor.execute()` with a task function that re-throws the
 *    original error so the executor can exercise its retry / fallback /
 *    escalation pipeline.
 * 3. If the executor throws (escalation action: `fail`), the error is
 *    captured back onto the context.
 * 4. Attaches the {@link RecoveryResult} to `ctx.metadata.recoveryResult`.
 *
 * @param policy - The recovery policy that defines retry configuration,
 *                 fallback targets, and escalation action.
 */
export function createRecoveryHook(policy: RecoveryPolicy): RecoveryGateHook {
  return {
    name: 'recovery:post-tool-call',
    phase: 'afterToolCall',
    priority: 20,
    enabled: true,

    handler: async (ctx: HookContext): Promise<HookContext> => {
      // Only trigger when a tool-call error exists.
      if (!ctx.error) {
        return ctx;
      }

      const executor = new RecoveryExecutor(policy);

      const recoveryContext: Record<string, unknown> = {
        agentId: ctx.agentId,
        role: ctx.role,
        toolName: ctx.toolName,
        ...ctx.metadata
      };

      // The task function re-throws the original error so the executor
      // can exercise its retry / fallback / escalation lifecycle.
      const taskFn = (): Promise<unknown> => Promise.reject(ctx.error);

      try {
        const result = await executor.execute(taskFn, recoveryContext);

        // Recovery completed without throwing (escalation was
        // 'escalate', 'skip', or 'default').
        return {
          ...ctx,
          ...(result.recovered ? {} : { error: result.finalError ?? ctx.error }),
          metadata: {
            ...ctx.metadata,
            recoveryResult: result
          }
        };
      } catch (recoveryError: unknown) {
        // Recovery executor threw because the escalation action is
        // 'fail'.  Capture the escalation error on the context.
        const finalError = recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError));

        return {
          ...ctx,
          error: finalError,
          metadata: {
            ...ctx.metadata,
            recoveryResult: {
              recovered: false,
              attempts: 0,
              totalTimeMs: 0,
              finalError
            }
          }
        };
      }
    }
  };
}
