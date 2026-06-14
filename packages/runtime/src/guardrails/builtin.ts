import type { GuardrailPipeline } from '@agentsy/guardrails';
import {
  createInputGuardrailHook,
  createOutputGuardrailHook,
  createToolInputGuardrailHook,
  createToolOutputGuardrailHook
} from '../hooks/guardrail-hooks.js';
import type { HookRegistry } from '../hooks/registry.js';

/**
 * Pipelines for each guardrail phase.
 */
export interface BuiltinGuardrailPipelines {
  input: GuardrailPipeline;
  output: GuardrailPipeline;
  toolInput: GuardrailPipeline;
  toolOutput: GuardrailPipeline;
}

/**
 * Register all built-in guardrail hooks with the given `HookRegistry`.
 *
 * Each guardrail hook factory returns `{ id, priority, handler }` which is
 * destructured and passed to `registry.register()` so the registry owns the
 * handler identity and ordering.
 *
 * @param registry - The runtime hook registry to register into.
 * @param pipelines - One `GuardrailPipeline` per guardrail phase.
 * @returns An array of `{ unregister }` handles, one per registered hook.
 */
export function registerBuiltinGuardrails(
  registry: HookRegistry,
  pipelines: BuiltinGuardrailPipelines
): { unregister: () => void }[] {
  const hooks = [
    { eventType: 'UserPromptSubmit' as const, hook: createInputGuardrailHook(pipelines.input) },
    { eventType: 'PreToolCall' as const, hook: createToolInputGuardrailHook(pipelines.toolInput) },
    { eventType: 'PostToolCall' as const, hook: createToolOutputGuardrailHook(pipelines.toolOutput) },
    { eventType: 'PreResponse' as const, hook: createOutputGuardrailHook(pipelines.output) }
  ];

  return hooks.map(({ eventType, hook }) =>
    registry.register(eventType, hook.handler, { id: hook.id, priority: hook.priority })
  );
}
