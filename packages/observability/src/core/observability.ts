/**
 * Observability Engine
 * 
 * Main observability engine that orchestrates tracing, metrics, and logging
 */

import * as api from '@opentelemetry/api';

import type {
  TraceId,
  SpanId,
} from '@agentsy/types/src/types.js';
import type {
  ObservabilityEngine,
  ObservabilitySink,
  RedactionPolicy,
} from '../core/types.js';
import { TracerImpl, type Span, InternalSpan } from './tracer.js';
import { MeterImpl } from './meter.js';
import { LoggerImpl, type LogLevel } from './logger.js';

/**
 * Configuration for initializing the observability engine
 */
import {
  Span as OtelSpan,
} from '@opentelemetry/api';

import type {
  TraceId,
  SpanId,
} from '@agentsy/types/src/types.js';
import type {
  ObservabilityEngine,
  ObservabilitySink,
  RedactionPolicy,
} from '../core/types.js';
import { TracerImpl, type Span, InternalSpan } from './tracer.js';
import { MeterImpl } from './meter.js';
import { LoggerImpl, type LogLevel } from './logger.js';

/**
 * Configuration for initializing the observability engine
 */
export interface ObservabilityEngineConfig {
  /** Service name for telemetry (e.g., 'ai-agent-runtime') */
  serviceName: string;
  /** Service version string */
  serviceVersion?: string;
  /** Tracing configuration */
  tracing?: {
    /** Sampling strategy ('always_on', 'never', 'parentBased') */
    sampling?: 'always_on' | 'never' | 'parentBased';
    /** Jaeger endpoint for distributed tracing */
    jaegerEndpoint?: string;
  };
  /** Metrics configuration */
  metrics?: {
    /** Prometheus endpoint for metrics scraping */
    prometheusEndpoint?: string;
    /** Interval for metrics export in milliseconds */
    interval?: number;
  };
  /** Logging configuration */
  logging?: {
    /** Minimum log level to output (INFO, DEBUG, WARN, ERROR) */
    minLevel?: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
    /** Whether to include timestamps in logs */
    includeTimestamp?: boolean;
  };
}

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};
export { LOG_LEVEL_MAP };

/**
 * Main observability engine implementation
 * Provides unified entry point for all tracing, metrics, and logging operations
 */
export class ObservabilityEngineImpl implements ObservabilityEngine {
  readonly tracer: TracerImpl;
  readonly meter: MeterImpl;
  readonly logger: LoggerImpl;
  private config: ObservabilityEngineConfig;
  private _sinks: ObservabilitySink[] = [];
  private _redactionPolicy: RedactionPolicy | null = null;
  private _isShutdown = false;

  constructor(config: ObservabilityEngineConfig) {
    this.config = config;
    this.tracer = new TracerImpl();
    this.meter = new MeterImpl();
    this.logger = new LoggerImpl({
      minLevel: config.logging?.minLevel
        ? LOG_LEVEL_MAP[config.logging.minLevel.toUpperCase()]
        : 1,
      includeTimestamp: config.logging?.includeTimestamp ?? true,
    });
  }

  setSink(sink: ObservabilitySink): void {
    this._sinks.push(sink);
  }

  setRedactionPolicy(policy: RedactionPolicy): void {
    this._redactionPolicy = policy;
  }

  async shutdown(): Promise<void> {
    if (this._isShutdown) {
      this.logger.warn('Observability engine already shut down');
      return;
    }

    this._isShutdown = true;

    // Flush all sinks
    for (const sink of this._sinks) {
      try {
        await sink.flush();
      } catch (error) {
        this.logger.error('Failed to flush sink during shutdown', { error });
      }
    }

    // Shutdown OpenTelemetry SDKs
    try {
      await api.metrics.getMeter('agentsy').shutdown();
      api.trace.getTracer('agentsProvider');
    } catch (error) {
      this.logger.error('Failed to shutdown OpenTelemetry SDKs', { error });
    }

    this.logger.info('Observability engine shut down complete');
  }

  /**
   * Gets the current active span for adding attributes
   */
  getCurrentSpan(): Span | null {
    return this.tracer.getCurrentSpan();
  }

  /**
   * Starts a new span with given name and attributes
   */
  startSpan(name: string, attributes?: Record<string, string | number | boolean | string[]>): Span {
    const span = this.tracer.startSpan(name);
    if (attributes) {
      span.setAttributes(attributes);
    }
    return span;
  }

  /**
   * Records a metric value with optional attributes
   */
  recordCounter(
    name: string,
    value: number,
    attributes?: Record<string, string | number | boolean | string[]>,
  ): void {
    const counter = this.meter.createCounter(name);
    counter.record(value, attributes);
  }

  /**
   * Records a distribution value (e.g., latency, duration)
   */
  recordHistogram(
    name: string,
    value: number,
    attributes?: Record<string, string | number | boolean | string[]>,
  ): void {
    const histogram = this.meter.createHistogram(name);
    histogram.record(value, attributes);
  }

  /**
   * Records a point-in-time value (e.g., memory usage, temperature)
   */
  recordGauge(
    name: string,
    value: number,
    attributes?: Record<string, string | number | boolean | string[]>,
  ): void {
    const gauge = this.meter.createGauge(name);
    gauge.record(value, attributes);
  }

  /**
   * Creates a metric counter
   */
  createCounter(name: string, options?: { description?: string; unit?: string }): ReturnType<
    MeterImpl['createCounter']
  > {
    return this.meter.createCounter(name, {
      description: options?.description,
      unit: options?.unit,
    });
  }

  /**
   * Creates a metric histogram
   */
  createHistogram(name: string, options?: { description?: string; unit?: string }): ReturnType<
    MeterImpl['createHistogram']
  > {
    return this.meter.createHistogram(name, {
      description: options?.description,
      unit: options?.unit,
    });
  }

  /**
   * Creates a metric gauge
   */
  createGauge(name: string, options?: { description?: string; unit?: string }): ReturnType<
    MeterImpl['createGauge']
  > {
    return this.meter.createGauge(name, {
      description: options?.description,
      unit: options?.unit,
    });
  }

  /**
   * Redacts sensitive data from all attributes
   */
  applyRedaction(attributes: Record<string, string | number | boolean | string[]>): Record<string, string | number> {
    if (!this._redactionPolicy) {
      // No-op if no policy set
      return attributes;
    }

    const result: Record<string, string | number> = {
      ...attributes,
    };

    for (const [key, value] of Object.entries(attributes)) {
      if (typeof value === 'string') {
        result[key] = this._redactionPolicy.redact(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map(item =>
          this._redactionPolicy.redact(item),
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

/**
 * Factory function to create an observability engine
 */
export const createObservabilityEngine = (
  config: ObservabilityEngineConfig,
): ObservabilityEngine => {
  return new ObservabilityEngineImpl(config);
};

/**
 * Default observability engine instance for global use
 */
let _defaultEngine: ObservabilityEngineImpl | null = null;

/**
 * Get or create the default observability engine
 */
export const getDefaultEngine = (): ObservabilityEngine => {
  if (!_defaultEngine) {
    _defaultEngine = new ObservabilityImpl({
      serviceName: 'agentsy-runtime',
      serviceVersion: '0.0.0',
      sampling: 'always_on',
    });
  }
  return _defaultEngine;
};

/**
 * Factory function for creating an observability engine with a simple name
 * @deprecated Use createObservabilityEngine instead
 */
export const createSimpleEngine = (
  name: string,
  options?: {
    serviceName?: string;
    sampling?: 'always_on' | 'never' | 'parentBased';
    jaegerEndpoint?: string;
  }
): ObservabilityEngine => {
  return createObservabilityEngine({
    serviceName: options?.serviceName ?? name,
    serviceVersion: '0.0.0',
    tracing: options ? { sampling: options.sampling } : undefined,
  });
};