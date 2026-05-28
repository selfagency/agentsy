/**
 * Core Observability Types
 *
 * Defines the fundamental interfaces for the observability engine including
 * ObservabilityEngine, AgentSpan, and supporting types.
 */

/**
 * Attribute value type for span attributes
 */
export type AttributeValue = string | number | boolean | string[];
export type Attributes = Record<string, AttributeValue>;

/**
 * Core observability engine that provides tracing, metrics, and logging capabilities.
 * The main entry point for all observability operations in Agentsy.
 */
export interface ObservabilityEngine {
  /** The structured logger for application logging */
  readonly logger: Logger;
  /** The OpenTelemetry meter for metrics collection */
  readonly meter: Meter;
  /**
   * Sets the redaction policy for scrubbing sensitive data.
   * Ensures PII, secrets, and credentials never leave the process in plaintext.
   */
  setRedactionPolicy(policy: RedactionPolicy): void;
  /**
   * Sets the active span exporter/sink where telemetry data is sent.
   * Supports multiple sinks: console, OTLP, Jaeger, Prometheus, etc.
   */
  setSink(sink: ObservabilitySink): void;
  /**
   * Shuts down the observability engine and flush all pending data.
   * Must be called before process exit to ensure all telemetry is exported.
   */
  shutdown(): Promise<void>;
  /** The OpenTelemetry tracer for distributed tracing */
  readonly tracer: Tracer;
}

/**
 * OpenTelemetry-compatible tracer wrapper.
 * Provides methods for creating and managing spans.
 */
export interface Tracer {
  /**
   * Gets the current active span from the context.
   * Useful for adding attributes within nested operations.
   */
  getCurrentSpan(): Span | null;
  /**
   * Creates a new span with the given name and options.
   * The span should be ended when the operation completes.
   */
  startSpan(name: string, options?: SpanOptions): Span;
}

/**
 * OpenTelemetry-compatible span representing a unit of work.
 * Spans form a tree structure through parent-child relationships.
 */
export interface Span {
  /**
   * Adds a single event to the span timeline.
   * Events are ordered in time and can carry arbitrary data.
   */
  addEvent(name: string, attributes?: Attributes): void;
  /**
   * Ends the span and flushes its data to the configured exporters.
   * After end(), no further operations can be performed on the span.
   */
  end(endTime?: number): void;
  /** The span name */
  readonly name: string;
  /** The parent span ID if this is a child span */
  readonly parentId?: string;
  /**
   * Records an exception that occurred during the span's operation.
   * Automatically sets status to error and adds error details.
   */
  recordException(exception: unknown, attributes?: Attributes): void;
  /**
   * Sets an attribute on the span with the given key and value.
   * Attributes are indexed key-value pairs exported with the span.
   */
  setAttribute(key: string, value: AttributeValue): void;
  /**
   * Sets multiple attributes on the span at once.
   * More efficient than calling setAttribute multiple times.
   */
  setAttributes(attributes: Record<string, AttributeValue>): void;
  /** The unique span ID */
  readonly spanId: string;
  /**
   * Creates a new child span of this span.
   * The child span automatically inherits parent context and trace ID.
   */
  startChild(name: string, options?: SpanOptions): Span;
  /** The unique trace ID that groups all related spans together */
  readonly traceId: string;
}

/**
 * Options for creating spans
 */
export interface SpanOptions {
  /** Initial attributes for the span */
  attributes?: Attributes;
  /** Whether this span is a remote parent in a distributed trace */
  isRemoteParent?: boolean;
  /** Links to related spans from other traces */
  links?: SpanLink[];
  /** Start time in milliseconds since epoch */
  startTime?: number;
}

/**
 * Link to a span in another trace for distributed tracing
 */
export interface SpanLink {
  readonly attributes?: Attributes;
  readonly spanId: string;
  readonly traceId: string;
}

/**
 * OpenTelemetry-compatible meter wrapper.
 * Provides methods for creating different metric instruments.
 */
export interface Meter {
  /**
   * Creates a counter metric that can be incremented.
   * Counters are non-decreasing values that only go up.
   */
  createCounter(name: string, options?: MetricOptions): Counter;
  /**
   * Creates a gauge metric that can go up and down over time.
   * Gauges represent point-in-time values.
   */
  createGauge(name: string, options?: MetricOptions): Gauge;
  /**
   * Creates a histogram metric that records distributions.
   * Histograms can record min, max, mean, percentiles, etc.
   */
  createHistogram(name: string, options?: MetricOptions): Histogram;
  /**
   * Creates an observable gauge that yields values from a callback.
   * Useful for metrics that must be actively measured.
   */
  createObservableGauge(
    name: string,
    callback: (observable: ObservableGauge) => void,
    options?: MetricOptions
  ): ObservableGauge;
}

/**
 * Options for creating metric instruments
 */
export interface MetricOptions {
  /** Set of allowed attribute keys for the metric */
  advice?: {
    /** Explicit attribute keys that must be present */
    attributeKeys?: string[];
    /** Allowed attribute keys (restricts others if set) */
    allowedAttributeKeys?: string[];
  };
  /** Human-readable description of the metric */
  description?: string;
  /** Unit of measurement (e.g., 'ms', 'bytes', '1') */
  unit?: string;
}

/**
 * Counter metric for non-decreasing values
 */
export interface Counter {
  /**
   * Increments the counter by the specified amount (default 1)
   * @param amount - The amount to increment by (must be positive)
   * @param attributes - Additional attributes to associate with this recording
   */
  increment(amount?: number, attributes?: Attributes): void;
  /**
   * Records a value to this counter (alternative interface for increment)
   * @param amount - The value to record (must be positive)
   * @param attributes - Additional attributes to associate with this recording
   */
  record(amount: number, attributes?: Attributes): void;
}

/**
 * Histogram metric for recording distributions
 */
export interface Histogram {
  /**
   * Records a value in this histogram
   * @param amount - The value to record
   * @param attributes - Additional attributes to associate with this recording
   */
  record(amount: number, attributes?: Attributes): void;
}

/**
 * Gauge metric for point-in-time values
 * Value that can go up or down
 */
export interface Gauge {
  /**
   * Decrements the gauge by the specified amount
   * @param amount - Optional amount to decrement by
   * @param attributes - Optional attributes to add
   */
  decrement(amount?: number, attributes?: Attributes): void;
  /**
   * Increments the gauge by the specified amount
   * @param amount - Optional amount to increment by
   * @param attributes - Optional attributes to add
   */
  increment(amount?: number, attributes?: Attributes): void;
  /**
   * Records a value to this gauge
   * @param amount - The value to record
   * Additional attributes for data association
   *
   * In English: Additional attributes to associate with this recording
   */
  record(amount: number, attributes?: Attributes): void;
}

/**
 * Observable gauge that yields values from a callback
 */
export interface ObservableGauge {
  /**
   * Records a single observation
   * @param amount - The value to record
   * Additional attributes for data association
   *
   * In English: Additional attributes to associate with this recording
   */
  record(amount: number, attributes?: Attributes): void;
}

/**
 * Structured logging interface with multiple severity levels.
 * Provides consistent formatting and output to configured sinks.
 */
export interface Logger {
  /**
   * Logs a debug message (typically filtered out in production)
   */
  debug(message: string, attributes?: Record<string, unknown>): void;
  /**
   * Logs an error message about a failure or critical condition
   */
  error(message: string, attributes?: Record<string, unknown>, error?: unknown): void;
  /**
   * Logs an informational message
   */
  info(message: string, attributes?: Record<string, unknown>): void;
  /**
   * Logs a warning message about an unexpected condition
   */
  warn(message: string, attributes?: Record<string, unknown>): void;
}

/**
 * Sink/Exporter where observability data is sent.
 * Can be a file, network endpoint, or in-memory collector.
 */
export interface ObservabilitySink {
  /** Whether this sink is currently active/enabled */
  readonly enabled: boolean;
  /**
   * Exports a span with its associated data
   */
  export(span: SpanData): Promise<void> | void;
  /**
   * Exports a metric with its associated data
   */
  exportMetric(metric: MetricData): Promise<void> | void;
  /**
   * Flushes any pending data and returns when complete
   */
  flush(): Promise<void>;
  /**
   * Shuts down the sink and releases any resources
   */
  shutdown(): Promise<void>;
  /** Unique identifier for this sink */
  readonly type: string;
}

/**
 * Data associated with a span
 */
export interface SpanData {
  /** Span attributes */
  readonly attributes: Attributes;
  /** Duration in milliseconds (if ended) */
  readonly duration?: number;
  /** End time in milliseconds since epoch (if ended) */
  readonly endTime?: number;
  /** Events recorded on the span */
  readonly events: SpanEvent[];
  /** Links to other spans */
  readonly links?: SpanLink[];
  /** Span name */
  readonly name: string;
  /** Parent span identifier if exists */
  readonly parentId?: string;
  /** Unique span identifier */
  readonly spanId: string;
  /** Start time in milliseconds since epoch */
  readonly startTime: number;
  /** Span status */
  readonly status: 'ok' | 'error';
  /** Unique trace identifier */
  readonly traceId: string;
  /** Span type (agent, tool, model, internal) */
  readonly type?: 'agent' | 'tool' | 'model' | 'internal';
}

/**
 * Event recorded on a span's timeline
 */
export interface SpanEvent {
  /** Event attributes */
  readonly attributes: Attributes;
  /** Event name/type */
  readonly name: string;
  /** Event timestamp in milliseconds */
  readonly timestamp: number;
}

/**
 * Data associated with a metric recording
 */
export interface MetricData {
  /** Associated attributes */
  readonly attributes: Attributes;
  /** Metric name */
  readonly name: string;
  /** Recording timestamp in milliseconds */
  readonly timestamp: number;
  /** Metric instrument type */
  readonly type: 'counter' | 'histogram' | 'gauge';
  /** Metric unit (e.g., 'ms', 'bytes', '1') */
  readonly unit?: string;
  /** Metric value */
  readonly value: number;
}

/**
 * Redaction policy for scrubbing sensitive data.
 * Ensures PII, secrets, and credentials are removed before export.
 */
export interface RedactionPolicy {
  /**
   * Global regex patterns to match sensitive data
   * Applied to all spans and metrics regardless of source
   */
  readonly globalPatterns: readonly RedactionRule[];
  /** Unique policy identifier */
  readonly name: string;
  /**
   * Provider-specific redaction rules
   * Allows different handling per provider (e.g., Anthropic vs OpenAI)
   */
  readonly providerRules: ReadonlyMap<string, readonly RedactionRule[]>;
  /**
   * Redacts a value according to this policy
   * @param value - Original value
   * @returns Redacted value
   */
  redact(value: string): string;
}

/**
 * Rule for redacting sensitive data
 */
export interface RedactionRule {
  /** Human-readable description of what this redacts */
  readonly description: string;
  /**
   * Whether this rule is currently enabled
   */
  readonly enabled: boolean;
  /** Unique rule identifier */
  readonly id: string;
  /** Regex pattern to match sensitive content */
  readonly pattern: RegExp;
  /** Replacement pattern (supports groups from pattern) */
  readonly replacement: string;
  /**
   * Indicates severity/match confidence
   * Values: "high", "medium", "low"
   */
  readonly severity: 'high' | 'medium' | 'low';
}
