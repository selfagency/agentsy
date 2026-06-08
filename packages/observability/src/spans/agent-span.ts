/**
 * Multi-Agent Span Schema
 *
 * Defines the AgentSpan interface and MultiAgentTracer for hierarchical
 * tracing of multi-agent delegation workflows with cost attribution.
 *
 * @module @agentsy/observability/spans
 */

/**
 * Status of a span or tool call
 */
export type SpanStatus = 'cancelled' | 'error' | 'ok';

/**
 * Cost attribution for token usage
 */
export interface CostAttribution {
  readonly estimatedCost?: number;
  readonly inputTokens: number;
  readonly modelName?: string;
  readonly outputTokens: number;
}

/**
 * A tool call recorded within an agent span
 */
export interface AgentToolCall {
  readonly duration: number;
  readonly input: unknown;
  readonly output: unknown;
  readonly status: SpanStatus;
  readonly tokens?: CostAttribution;
  readonly toolName: string;
}

/**
 * Options for creating a root span
 */
export interface RootSpanOptions {
  readonly agentRole?: string;
  readonly agentTier?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ChildSpanOptions {
  readonly metadata?: Record<string, unknown>;
  readonly parentSpanId?: string;
  readonly role?: string;
  readonly tier?: string;
}

/**
 * Hierarchical agent span for multi-agent tracing
 *
 * Represents a single agent's work within a trace. Spans form a tree
 * where parent spans track delegated sub-agent spans via subspans
 * and delegatedTo arrays.
 */
export interface AgentSpan {
  /** Agent that executed this span */
  readonly agentId: string;
  /** Role of the agent (e.g. 'researcher', 'coder') */
  agentRole?: string;
  /** Tier of the agent (e.g. 'micro', 'small', 'mid') */
  agentTier?: string;
  /** Span IDs of sub-agents this agent delegated to */
  delegatedTo: string[];
  /** When this span ended (set by finishSpan) */
  endTime?: Date;
  /** Error message if the span failed */
  error?: string;
  /** Arbitrary metadata key-value pairs */
  readonly metadata: Record<string, unknown>;
  /** Name of the operation this span represents */
  readonly operationName: string;
  /** Parent span identifier for sub-agent calls */
  readonly parentSpanId?: string;
  /** Unique span identifier */
  readonly spanId: string;
  /** When this span started */
  readonly startTime: Date;
  /** Span status */
  status: SpanStatus;
  /** Nested child spans (sub-agents) */
  subspans: AgentSpan[];
  /** Token usage and cost for this span */
  tokens?: CostAttribution;
  /** Tool calls made during this span */
  toolCalls: AgentToolCall[];
  /** Root request ID (shared across all spans in a trace) */
  readonly traceId: string;
}

/**
 * Multi-Agent Tracer
 *
 * Manages hierarchical span creation, tool call recording, and
 * trace retrieval for multi-agent delegation workflows.
 */
export class MultiAgentTracer {
  private readonly spans: Map<string, AgentSpan> = new Map();
  private currentSpanId: string | undefined;

  /**
   * Creates a root span with a generated traceId and spanId
   */
  createRootSpan(agentId: string, operationName: string, opts?: RootSpanOptions): AgentSpan {
    const traceId = crypto.randomUUID();
    const spanId = crypto.randomUUID();
    const span: AgentSpan = {
      traceId,
      spanId,
      agentId,
      operationName,
      startTime: new Date(),
      toolCalls: [],
      delegatedTo: [],
      subspans: [],
      status: 'ok',
      metadata: opts?.metadata ?? {}
    };

    if (opts?.agentRole !== undefined) {
      span.agentRole = opts.agentRole;
    }
    if (opts?.agentTier !== undefined) {
      span.agentTier = opts.agentTier;
    }

    this.spans.set(spanId, span);
    this.currentSpanId = spanId;
    return span;
  }

  /**
   * Creates a child span under the given parent or current span.
   * Inherits the parent's traceId and registers the child in
   * the parent's delegatedTo and subspans arrays.
   */
  createChildSpan(agentId: string, operationName: string, opts?: ChildSpanOptions): AgentSpan {
    const parentSpanId = opts?.parentSpanId ?? this.currentSpanId;
    if (parentSpanId === undefined) {
      throw new Error('Cannot create child span: no parent span specified or current span active');
    }

    const parent = this.spans.get(parentSpanId);
    if (parent === undefined) {
      throw new Error(`Parent span ${parentSpanId} not found`);
    }

    const spanId = crypto.randomUUID();
    const span: AgentSpan = {
      traceId: parent.traceId,
      spanId,
      parentSpanId,
      agentId,
      operationName,
      startTime: new Date(),
      toolCalls: [],
      delegatedTo: [],
      subspans: [],
      status: 'ok',
      metadata: opts?.metadata ?? {}
    };

    if (opts?.role !== undefined) {
      span.agentRole = opts.role;
    }
    if (opts?.tier !== undefined) {
      span.agentTier = opts.tier;
    }

    parent.delegatedTo.push(spanId);
    parent.subspans.push(span);

    this.spans.set(spanId, span);
    this.currentSpanId = spanId;
    return span;
  }

  /**
   * Records a tool call on the specified span
   */
  recordToolCall(spanId: string, call: AgentToolCall): void {
    const span = this.spans.get(spanId);
    if (span === undefined) {
      return;
    }

    span.toolCalls.push(call);
  }

  /**
   * Finishes a span, setting its end time, status, and optional error.
   * Restores the current span pointer to the parent.
   */
  finishSpan(spanId: string, status: SpanStatus, error?: string): void {
    const span = this.spans.get(spanId);
    if (span === undefined) {
      return;
    }

    span.endTime = new Date();
    span.status = status;
    if (error !== undefined) {
      span.error = error;
    }

    this.currentSpanId = span.parentSpanId;
  }

  /**
   * Returns the root span for the given traceId with all nested
   * subspans, or undefined if the trace is not found
   */
  getTrace(traceId: string): AgentSpan | undefined {
    for (const span of this.spans.values()) {
      if (span.traceId === traceId && span.parentSpanId === undefined) {
        return span;
      }
    }
  }

  /**
   * Returns the currently active span, if any
   */
  getCurrentSpan(): AgentSpan | undefined {
    if (this.currentSpanId === undefined) {
      return;
    }
    return this.spans.get(this.currentSpanId);
  }
}
