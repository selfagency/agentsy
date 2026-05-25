/**
 * Guardrail interfaces for input validation, output validation, and tool
 * call interceptors.
 *
 * These types are defined in `@agentsy/runtime` because guardrails plug
 * directly into the `HookRegistry`. The `@agentsy/guardrails` package
 * provides concrete implementations that conform to these interfaces.
 */

/**
 * The result of a guardrail check.
 *
 * - `allowed: true` — the input/output/tool call may proceed.
 *   `transformed` is an optional replacement value.
 * - `allowed: false` — execution is blocked with `reason` and optional
 *   machine-readable `code`.
 */
export type GuardrailResult<T> = { allowed: true; transformed?: T } | { allowed: false; reason: string; code?: string };

/**
 * Guards that run before any model interaction, on raw user input.
 */
export interface InputGuardrail<T = unknown> {
  name: string;
  check(input: T): Promise<GuardrailResult<T>>;
}

/**
 * Guards that run after a model response is generated, before it reaches
 * the user.
 */
export interface OutputGuardrail<T = unknown> {
  name: string;
  check(output: T): Promise<GuardrailResult<T>>;
}

/**
 * Guards that wrap individual tool definitions.
 *
 * `preCheck` fires before the tool runs (can block or modify args).
 * `postCheck` fires after the tool returns (can block display of result).
 */
export interface ToolGuardrail {
  name: string;
  preCheck(toolName: string, args: unknown): Promise<GuardrailResult<unknown>>;
  postCheck(toolName: string, result: unknown): Promise<GuardrailResult<unknown>>;
}
