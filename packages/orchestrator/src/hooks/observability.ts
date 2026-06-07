/**
 * @module Observability hooks — root-span creation and tool-call tracing.
 *
 * Provides two hooks that integrate the orchestrator with
 * `@agentsy/observability` multi-agent tracing:
 *
 * - {@link createObservabilityHook} — runs before plan construction to
 *   create a root {@link AgentSpan}.
 * - {@link createToolCallTracingHook} — runs after each tool call to
 *   record the call on the current span.
 *
 * @example
 * ```ts
 * import { createObservabilityHook, createToolCallTracingHook }
 *   from './hooks/observability.js';
 *
 * const initHook = createObservabilityHook(tracer);
 * const traceHook = createToolCallTracingHook(tracer);
 * ```
 */

import type { MultiAgentTracer } from '@agentsy/observability/spans/agent-span.js';
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
export type ObservabilityHook = HookDefinition & {
  handler: HookHandler;
};

/**
 * A tool-call tracing hook definition paired with its handler.
 */
export type ToolCallTracingHook = HookDefinition & {
  handler: HookHandler;
};

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/**
 * Create an observability hook that initialises a root {@link AgentSpan}
 * before plan construction begins.
 *
 * The hook runs in the `beforePlan` phase at priority 5 (lowest, runs
 * first).  It calls `tracer.createRootSpan()` with the agent ID and
 * operation name, then stores the resulting `spanId` and `traceId` on
 * `ctx.metadata` for downstream hooks to consume.
 *
 * @param tracer - The multi-agent tracer instance.
 */
export function createObservabilityHook(tracer: MultiAgentTracer): ObservabilityHook {
  return {
    name: 'observability:before-init',
    phase: 'beforePlan',
    priority: 5,
    enabled: true,

    handler: (ctx: HookContext): Promise<HookContext> => {
      const span = tracer.createRootSpan(ctx.agentId, 'orchestration', {
        agentRole: ctx.role,
        metadata: ctx.metadata
      });

      return Promise.resolve({
        ...ctx,
        metadata: {
          ...ctx.metadata,
          spanId: span.spanId,
          traceId: span.traceId
        }
      });
    }
  };
}

/**
 * Create a hook that records tool-call results on the current agent span.
 *
 * The hook runs in the `afterToolCall` phase at priority 5 (lowest, runs
 * first within its phase).  It uses `tracer.getCurrentSpan()` to find the
 * active span and then calls `tracer.recordToolCall()` with the tool-call
 * data from the context.
 *
 * When no current span is available (e.g. tracing was not initialised),
 * the handler silently passes the context through unchanged.
 *
 * @param tracer - The multi-agent tracer instance.
 */
export function createToolCallTracingHook(tracer: MultiAgentTracer): ToolCallTracingHook {
  return {
    name: 'observability:tool-call-trace',
    phase: 'afterToolCall',
    priority: 5,
    enabled: true,

    handler: (ctx: HookContext): Promise<HookContext> => {
      if (!ctx.toolName) {
        return Promise.resolve(ctx);
      }

      const currentSpan = tracer.getCurrentSpan();
      if (!currentSpan) {
        return Promise.resolve(ctx);
      }

      tracer.recordToolCall(currentSpan.spanId, {
        toolName: ctx.toolName,
        input: ctx.toolInput,
        output: ctx.toolOutput,
        status: ctx.error ? 'error' : 'ok',
        duration: 0
      });

      return Promise.resolve(ctx);
    }
  };
}
