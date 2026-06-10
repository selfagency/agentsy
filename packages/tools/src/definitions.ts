/**
 * Annotations about tool behavior used for safety gating.
 */
export interface ToolAnnotations {
  /** Tool can modify or delete user data. */
  readonly destructiveHint?: boolean;
  /** Tool is safe to call multiple times (same input → same output). */
  readonly idempotentHint?: boolean;
  /** Tool interacts with external systems beyond the agent's workspace. */
  readonly openWorldHint?: boolean;
  /** Tool primarily reads data without side effects. */
  readonly readOnlyHint?: boolean;
  /** Tool requires explicit user approval before execution. */
  readonly requiresApproval?: boolean;
}

/**
 * Tool execution handler signature.
 */
export type ToolHandler = (input: Record<string, unknown>) => Promise<ToolResult>;

/**
 * Invocation argument describing a tool parameter with JSON Schema-like properties.
 */
export interface ToolParameter {
  readonly description?: string;
  readonly name: string;
  readonly required?: boolean;
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
}

/**
 * Canonical tool definition used by the registry and approval gating.
 */
export interface ToolDefinition<_T = unknown> {
  /** Tool annotations for safety gating. */
  readonly annotations?: ToolAnnotations;
  /** Human-readable description of what the tool does. */
  readonly description: string;
  /** Tool handler function. */
  readonly handler: ToolHandler;
  /** Unique tool identifier. */
  readonly name: string;
  /** Parameter definitions for the tool. */
  readonly parameters?: ToolParameter[];
  /** Extended JSON Schema for complex inputs. */
  readonly schema?: Record<string, unknown>;
}

/**
 * Result from executing a tool.
 */
export interface ToolResult<T = unknown> {
  readonly data: T;
  readonly error?: string;
  readonly ok: boolean;
}
