/**
 * Branded primitive types for Agentsy IDs.
 *
 * These types prevent accidental mixing of identifiers from different domains.
 * Use them for type safety when working with entity IDs.
 */

/**
 * Unique identifier for an agent instance or configuration.
 */
export type AgentId = string & { readonly __brand: unique symbol };

/**
 * Unique identifier for a conversation session.
 */
export type SessionId = string & { readonly __brand: unique symbol };

/**
 * Unique identifier for distributed tracing.
 */
export type TraceId = string & { readonly __brand: unique symbol };

/**
 * Unique identifier for a span within a trace.
 */
export type SpanId = string & { readonly __brand: unique symbol };

/**
 * Unique identifier for a tool or function.
 */
export type ToolId = string & { readonly __brand: unique symbol };

/**
 * Unique identifier for a memory record.
 */
export type MemoryId = string & { readonly __brand: unique symbol };

/**
 * Creates a branded AgentId.
 */
export function createAgentId(): AgentId {
  // Type assertion is required for branded type pattern
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return `agent_${crypto.randomUUID()}` as AgentId;
}

/**
 * Creates a branded SessionId.
 */
export function createSessionId(): SessionId {
  // Type assertion is required for branded type pattern
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return `session_${crypto.randomUUID()}` as SessionId;
}

/**
 * Creates a branded TraceId.
 */
export function createTraceId(): TraceId {
  // Type assertion is required for branded type pattern
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return `trace_${crypto.randomUUID()}` as TraceId;
}

/**
 * Creates a branded SpanId.
 */
export function createSpanId(): SpanId {
  // Type assertion is required for branded type pattern
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return `span_${crypto.randomUUID()}` as SpanId;
}

/**
 * Creates a branded ToolId.
 */
export function createToolId(): ToolId {
  // Type assertion is required for branded type pattern
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return `tool_${crypto.randomUUID()}` as ToolId;
}

/**
 * Creates a branded MemoryId.
 */
export function createMemoryId(): MemoryId {
  // Type assertion is required for branded type pattern
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return `memory_${crypto.randomUUID()}` as MemoryId;
}

/**
 * Type guard for branded IDs.
 */
export function isAgentId(value: unknown): value is AgentId {
  return typeof value === 'string' && value.startsWith('agent_');
}

export function isSessionId(value: unknown): value is SessionId {
  return typeof value === 'string' && value.startsWith('session_');
}

export function isTraceId(value: unknown): value is TraceId {
  return typeof value === 'string' && value.startsWith('trace_');
}

export function isSpanId(value: unknown): value is SpanId {
  return typeof value === 'string' && value.startsWith('span_');
}

export function isToolId(value: unknown): value is ToolId {
  return typeof value === 'string' && value.startsWith('tool_');
}

export function isMemoryId(value: unknown): value is MemoryId {
  return typeof value === 'string' && value.startsWith('memory_');
}
