/**
 * Per-call token breakdown. Mirrors the production
 * `CompletionResponse.usage` shape.
 */
export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Per-call metrics payload. Recorded by the gateway once a request
 * completes (success or failure).
 */
export interface RequestMetric {
  /**
   * Optional cost in USD. Callers (e.g. cost-based strategy
   * calibration) can supply this from a pricing table.
   */
  costUsd?: number;
  /**
   * Latency of the call in milliseconds. Zero or undefined means
   * "no timing recorded" (typically a synchronous rejection).
   */
  latencyMs: number;
  /**
   * Resolved upstream model id, when known. May be empty for
   * requests that fail before model resolution.
   */
  modelId: string;
  /**
   * Provider entry id selected for the request. Set on both success
   * and failure so per-provider error rates can be derived.
   */
  providerId: string;
  /**
   * Whether the call succeeded. `false` means the gateway surfaced
   * an error to the caller (after retry/failover). A retry that
   * succeeds on a different provider counts as one success and one
   * failover event.
   */
  success: boolean;
  /**
   * Token usage for the call. Omitted when the provider did not
   * return usage info (e.g. on failure or for cached responses).
   */
  tokens?: TokenCounts;
}

/**
 * Latency percentiles in milliseconds, computed from a sample of
 * the most recent observations. Returns `undefined` for any
 * percentile that has no samples.
 */
export interface LatencyPercentiles {
  p50: number | undefined;
  p95: number | undefined;
  p99: number | undefined;
  samples: number;
}

/**
 * Per-provider aggregate, rolled up across all (provider, model)
 * pairs. Numbers are summed; latency percentiles are computed from
 * the per-provider samples.
 */
export interface ProviderAggregate {
  circuitTrips: number;
  errorRate: number;
  failoverCount: number;
  failureCount: number;
  latency: LatencyPercentiles;
  providerId: string;
  requestCount: number;
  successCount: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
}

/**
 * Top-level metrics snapshot returned by `getUsageSnapshot()`.
 * Suitable for structured logging or OpenTelemetry export.
 */
export interface MetricsSnapshot {
  circuitTrips: number;
  failoverCount: number;
  failureCount: number;
  latency: LatencyPercentiles;
  perProvider: ProviderAggregate[];
  requestCount: number;
  streamCount: number;
  streamFailureCount: number;
  streamSuccessCount: number;
  successCount: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalStreamChunks: number;
  totalStreamDurationMs: number;
  totalStreamTtfbMs: number;
  totalTokens: number;
}

/**
 * Latency buffer per provider/model. Stores the last N samples
 * (default 1000) and computes percentiles on demand using a
 * simple sort-and-pick. For high-throughput services, prefer
 * exporting samples to a T-digest implementation; this is the
 * small, dependency-free path that fits the gateway.
 */
class LatencyBuffer {
  readonly #samples: number[] = [];
  readonly #capacity: number;
  #cursor = 0;
  #count = 0;

  constructor(capacity = 1000) {
    this.#capacity = capacity;
  }

  record(value: number): void {
    if (this.#count < this.#capacity) {
      this.#samples.push(value);
      this.#count += 1;
    } else {
      const slot = this.#cursor % this.#capacity;
      this.#samples[slot] = value;
      this.#cursor += 1;
    }
  }

  percentile(p: number): number | undefined {
    if (this.#count === 0) {
      return;
    }
    const sorted = [...this.#samples].sort((a, b) => a - b);
    const rank = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
    return sorted[rank];
  }

  sampleCount(): number {
    return this.#count;
  }
}

interface ProviderBucket {
  circuitTrips: number;
  failoverCount: number;
  failureCount: number;
  latency: LatencyBuffer;
  models: Map<string, ModelBucket>;
  providerId: string;
  requestCount: number;
  successCount: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

interface ModelBucket {
  costUsd: number;
  failureCount: number;
  inputTokens: number;
  latency: LatencyBuffer;
  modelId: string;
  outputTokens: number;
  requestCount: number;
  successCount: number;
}

/**
 * Records per-request metrics for the gateway. The collector is
 * a passive sink: callers invoke `recordRequest()` after each
 * `complete()` / `stream()` call. Aggregates are computed on
 * demand from `getUsageSnapshot()` and `getProviderAggregate()`.
 *
 * The collector is provider-agnostic and does not depend on
 * `ProviderHealthRegistry` directly; circuit trips and failovers
 * are passed in via `recordCircuitTrip()` and `recordFailover()`.
 * The gateway's `retryWithFailover` and `ProviderHealthRegistry`
 * invoke these as appropriate.
 */
export class MetricsCollector {
  readonly #buckets = new Map<string, ProviderBucket>();
  #globalCircuitTrips = 0;
  #globalFailoverCount = 0;
  readonly #globalLatency = new LatencyBuffer();
  #globalRequestCount = 0;
  #globalSuccessCount = 0;
  #globalFailureCount = 0;
  #globalInputTokens = 0;
  #globalOutputTokens = 0;
  #globalCostUsd = 0;
  #streamCount = 0;
  #streamSuccessCount = 0;
  #streamFailureCount = 0;
  #totalStreamDurationMs = 0;
  #totalStreamTtfbMs = 0;
  #totalStreamChunks = 0;
  readonly #sampleCapacity: number;

  constructor(options: { sampleCapacity?: number } = {}) {
    this.#sampleCapacity = options.sampleCapacity ?? 1000;
  }

  /**
   * Record a single request outcome. Idempotent on `providerId`: the
   * same provider can have many model buckets. Updates both the
   * per-(provider, model) bucket and the global counters.
   *
   * @param metric - The request metric to record. `providerId` and
   *   `modelId` identify the bucket; `success` determines whether
   *   the success or failure counter is incremented; `tokens` and
   *   `costUsd` are summed when present; `latencyMs` is recorded
   *   into the latency percentile buffer when > 0.
   */
  recordRequest(metric: RequestMetric): void {
    const bucket = this.#bucketFor(metric.providerId);
    bucket.requestCount += 1;
    if (metric.success) {
      bucket.successCount += 1;
    } else {
      bucket.failureCount += 1;
    }
    if (metric.tokens !== undefined) {
      bucket.totalInputTokens += metric.tokens.inputTokens;
      bucket.totalOutputTokens += metric.tokens.outputTokens;
    }
    if (metric.costUsd !== undefined) {
      bucket.totalCostUsd += metric.costUsd;
    }
    if (metric.latencyMs > 0) {
      bucket.latency.record(metric.latencyMs);
    }

    const modelId = metric.modelId.length === 0 ? '__unknown__' : metric.modelId;
    let modelBucket = bucket.models.get(modelId);
    if (modelBucket === undefined) {
      modelBucket = {
        costUsd: 0,
        failureCount: 0,
        inputTokens: 0,
        latency: new LatencyBuffer(this.#sampleCapacity),
        modelId,
        outputTokens: 0,
        requestCount: 0,
        successCount: 0
      };
      bucket.models.set(modelId, modelBucket);
    }
    modelBucket.requestCount += 1;
    if (metric.success) {
      modelBucket.successCount += 1;
    } else {
      modelBucket.failureCount += 1;
    }
    if (metric.tokens !== undefined) {
      modelBucket.inputTokens += metric.tokens.inputTokens;
      modelBucket.outputTokens += metric.tokens.outputTokens;
    }
    if (metric.costUsd !== undefined) {
      modelBucket.costUsd += metric.costUsd;
    }
    if (metric.latencyMs > 0) {
      modelBucket.latency.record(metric.latencyMs);
    }

    this.#globalRequestCount += 1;
    if (metric.success) {
      this.#globalSuccessCount += 1;
    } else {
      this.#globalFailureCount += 1;
    }
    if (metric.tokens !== undefined) {
      this.#globalInputTokens += metric.tokens.inputTokens;
      this.#globalOutputTokens += metric.tokens.outputTokens;
    }
    if (metric.costUsd !== undefined) {
      this.#globalCostUsd += metric.costUsd;
    }
    if (metric.latencyMs > 0) {
      this.#globalLatency.record(metric.latencyMs);
    }
  }

  /**
   * Record that a request was retried against a different
   * provider. Called by `retryWithFailover` for every cross-
   * provider hop. The originating provider does not change
   * (use `recordRequest` to update per-provider counts).
   */
  recordFailover(providerId: string): void {
    this.#bucketFor(providerId).failoverCount += 1;
    this.#globalFailoverCount += 1;
  }

  /**
   * Record that a provider's circuit transitioned from closed to
   * open. Useful for SLA dashboards and alerting.
   */
  recordCircuitTrip(providerId: string): void {
    this.#bucketFor(providerId).circuitTrips += 1;
    this.#globalCircuitTrips += 1;
  }

  /**
   * Record completion of a streaming request. Distinct from
   * `recordRequest` so the snapshot can expose stream-level
   * metrics (TTFB, total duration, chunk count) without
   * overloading the per-call token-and-latency shape.
   *
   * @param metric.chunkCount - Number of chunks delivered to the consumer.
   * @param metric.durationMs - Total wall-clock time from stream construction to close, in ms.
   * @param metric.modelId - Resolved upstream model id, when known.
   * @param metric.providerId - Provider entry id that served the stream.
   * @param metric.success - Whether the stream reached a normal close.
   * @param metric.ttfbMs - Time from stream construction to first byte, in ms.
   */
  recordStreamComplete(metric: {
    chunkCount: number;
    durationMs: number;
    modelId: string;
    providerId: string;
    success: boolean;
    ttfbMs: number;
  }): void {
    const bucket = this.#bucketFor(metric.providerId);
    // Streams do not contribute to request/success/failure counts
    // (the per-call `recordRequest` path owns those) but they do
    // contribute to latency and a stream-specific counter.
    if (metric.ttfbMs > 0) {
      bucket.latency.record(metric.ttfbMs);
    }
    this.#streamCount += 1;
    if (metric.success) {
      this.#streamSuccessCount += 1;
    } else {
      this.#streamFailureCount += 1;
    }
    this.#totalStreamDurationMs += metric.durationMs;
    this.#totalStreamTtfbMs += metric.ttfbMs;
    this.#totalStreamChunks += metric.chunkCount;

    const modelId = metric.modelId.length === 0 ? '__unknown__' : metric.modelId;
    let modelBucket = bucket.models.get(modelId);
    if (modelBucket === undefined) {
      modelBucket = {
        costUsd: 0,
        failureCount: 0,
        inputTokens: 0,
        latency: new LatencyBuffer(this.#sampleCapacity),
        modelId,
        outputTokens: 0,
        requestCount: 0,
        successCount: 0
      };
      bucket.models.set(modelId, modelBucket);
    }
    if (metric.ttfbMs > 0) {
      modelBucket.latency.record(metric.ttfbMs);
    }
  }

  /**
   * Aggregate snapshot across all providers. Computed on demand;
   * safe to call from request paths without measurable overhead
   * for the typical 1-10 provider setup.
   */
  getUsageSnapshot(): MetricsSnapshot {
    const perProvider: ProviderAggregate[] = [];
    for (const bucket of this.#buckets.values()) {
      perProvider.push(this.#aggregateBucket(bucket));
    }
    perProvider.sort((a, b) => a.providerId.localeCompare(b.providerId));
    return {
      circuitTrips: this.#globalCircuitTrips,
      failureCount: this.#globalFailureCount,
      failoverCount: this.#globalFailoverCount,
      latency: this.#percentiles(this.#globalLatency),
      requestCount: this.#globalRequestCount,
      streamCount: this.#streamCount,
      streamFailureCount: this.#streamFailureCount,
      streamSuccessCount: this.#streamSuccessCount,
      successCount: this.#globalSuccessCount,
      totalCostUsd: this.#globalCostUsd,
      totalInputTokens: this.#globalInputTokens,
      totalOutputTokens: this.#globalOutputTokens,
      totalStreamChunks: this.#totalStreamChunks,
      totalStreamDurationMs: this.#totalStreamDurationMs,
      totalStreamTtfbMs: this.#totalStreamTtfbMs,
      totalTokens: this.#globalInputTokens + this.#globalOutputTokens,
      perProvider
    };
  }

  /**
   * Aggregate for a single provider. Returns `undefined` when
   * the provider has no recorded traffic — useful for the status
   * CLI to skip unconfigured ids.
   */
  getProviderAggregate(providerId: string): ProviderAggregate | undefined {
    const bucket = this.#buckets.get(providerId);
    if (bucket === undefined) {
      return;
    }
    return this.#aggregateBucket(bucket);
  }

  /**
   * Reset all counters. Intended for tests and the `/lb reset`
   * slash command. Does not change the sample buffer capacity.
   */
  reset(): void {
    this.#buckets.clear();
    this.#globalCircuitTrips = 0;
    this.#globalFailoverCount = 0;
    this.#globalRequestCount = 0;
    this.#globalSuccessCount = 0;
    this.#globalFailureCount = 0;
    this.#globalInputTokens = 0;
    this.#globalOutputTokens = 0;
    this.#globalCostUsd = 0;
    this.#streamCount = 0;
    this.#streamSuccessCount = 0;
    this.#streamFailureCount = 0;
    this.#totalStreamDurationMs = 0;
    this.#totalStreamTtfbMs = 0;
    this.#totalStreamChunks = 0;
  }

  #bucketFor(providerId: string): ProviderBucket {
    let bucket = this.#buckets.get(providerId);
    if (bucket === undefined) {
      bucket = {
        circuitTrips: 0,
        failureCount: 0,
        failoverCount: 0,
        latency: new LatencyBuffer(this.#sampleCapacity),
        models: new Map(),
        providerId,
        requestCount: 0,
        successCount: 0,
        totalCostUsd: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0
      };
      this.#buckets.set(providerId, bucket);
    }
    return bucket;
  }

  #aggregateBucket(bucket: ProviderBucket): ProviderAggregate {
    return {
      providerId: bucket.providerId,
      requestCount: bucket.requestCount,
      successCount: bucket.successCount,
      failureCount: bucket.failureCount,
      errorRate: bucket.requestCount === 0 ? 0 : bucket.failureCount / bucket.requestCount,
      totalInputTokens: bucket.totalInputTokens,
      totalOutputTokens: bucket.totalOutputTokens,
      totalTokens: bucket.totalInputTokens + bucket.totalOutputTokens,
      totalCostUsd: bucket.totalCostUsd,
      failoverCount: bucket.failoverCount,
      circuitTrips: bucket.circuitTrips,
      latency: this.#percentiles(bucket.latency)
    };
  }

  #percentiles(buffer: LatencyBuffer): LatencyPercentiles {
    return {
      p50: buffer.percentile(50),
      p95: buffer.percentile(95),
      p99: buffer.percentile(99),
      samples: buffer.sampleCount()
    };
  }
}
