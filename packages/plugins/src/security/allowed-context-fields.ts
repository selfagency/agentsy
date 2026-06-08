/**
 * Plugin context-injection allowlist.
 *
 * Defines which fields from the agent loop context may be exposed to plugins
 * and provides a filter function that enforces the allowlist at runtime.
 *
 * @module @agentsy/plugins/security
 */

/**
 * Fields that plugins are allowed to read from the agent loop context.
 * Plugins MUST NOT receive systemPrompt, inputTokens, activeHooks,
 * or any other sensitive/orchestration-internal fields.
 */
export const ALLOWED_CONTEXT_INJECTION_FIELDS = [
  'sessionId',
  'agentId',
  'model',
  'userMessage',
  'orchestrationMode',
  'memoryScopes',
  'timestamp'
] as const satisfies readonly string[];

/** A union of every allowed field name. */
export type AllowedContextField = (typeof ALLOWED_CONTEXT_INJECTION_FIELDS)[number];

/**
 * A context object that contains only the fields plugins are permitted to see.
 * Every value type is `unknown` because the runtime shape is determined by
 * the caller's `AgentLoopContext` implementation.
 */
export type SafeContext = {
  [K in AllowedContextField]: unknown;
};

/**
 * The full agent-loop context shape that plugins MAY receive filtering for.
 * This is intentionally broader than `SafeContext` — callers supply their full
 * context, and only the allowed fields survive.
 */
export interface PluginContext {
  agentId: string;
  memoryScopes?: readonly string[];
  model?: string;
  orchestrationMode?: string;
  sessionId: string;
  timestamp?: Date;
  userMessage?: string;
}

/**
 * Return a `SafeContext` containing only the fields listed in
 * `ALLOWED_CONTEXT_INJECTION_FIELDS`. Any fields present on `context`
 * outside that list are silently dropped.
 *
 * @param context — The full plugin context (may contain sensitive fields).
 * @param _pluginId — Reserved for future per-plugin allowlist overrides.
 * @returns A context object with only allowed fields.
 */
export function filterContextForPlugin(context: Record<string, unknown>, _pluginId: string): SafeContext {
  const safe: Record<string, unknown> = {};

  for (const field of ALLOWED_CONTEXT_INJECTION_FIELDS) {
    if (field in context) {
      safe[field] = context[field];
    }
  }

  return safe as SafeContext;
}
