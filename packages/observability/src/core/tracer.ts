/**
 * Tracer Implementation
 * 
 * OpenTelemetry-based tracer implementation for distributed tracing
 */

import * as api from '@opentelemetry/api';
import {
  Tracer as OtelTracer,
} from '@opentelemetry/api';

import type { TraceId, SpanId } from '@agentsy/types';
import type {
  Tracer,
  Span,
  SpanOptions,
  SpanLink,
} from '../core/types.js';

/**
 * Internal span implementation
 */
class InternalSpan implements Span {
  readonly traceId: TraceId;
  readonly spanId: SpanId;
  readonly parentId?: SpanId;
  readonly name: string;
  
  private _attributes: Record<string, string | number | boolean | string[]> = {};
  private _status: 'ok' | 'error' = 'ok';
  private _events: SpanEvent[] = [];
  private _startTime: number;
  private _endTime?: number;
  private _otelSpan: api.Span;
  private _context: api.Context;
  private _children: InternalSpan[] = [];
  readonly _isRoot: boolean;
  readonly _contextKey: string;

  constructor(
    name: string,
    options?: SpanOptions,
    parent?: InternalSpan,
    contextKey?: string,
  ) {
    this.name = name;
    this._startTime = options?.startTime ?? Date.now();
    parent?._children.push(this);
    this._isRoot = !parent;
    this._contextKey = contextKey ?? Math.random().toString(36);
    
    const parentContext = parent?._context;
    const otelTracer = api.trace.getTracer('agentsy');
    this._otelSpan = otelTracer.startSpan(
      name,
      options?. attributes
        ? { attributes: this._otelAttributesToAttributes(options.attributes) }
        : {},
      parentContext,
      options?.startTime ? options.startTime / 1000 : undefined,
    );
    
    this._context = api.trace.setActiveSpan(this._otelSpan, parentContext);
    
    // Extract trace/span IDs from the OpenTelemetry span
    const otelSpanContext = this._otelSpan.spanContext();
    this.traceId = otelSpanContext.traceId as TraceId;
    this.spanId = otelSpanContext.spanId as SpanId;
    this.parentId = parent?.spanId;
    
    // Copy initial attributes
    if (options?.attributes) {
      this._attributes = { ...options.attributes };
    }
  }

  get attributes(): Record<string, string | number | boolean | string[]> {
    return { ...this._attributes };
  }

  get status(): 'ok' | 'error' {
    return this._status;
  }

  get events(): SpanEvent[] {
    return [...this._events];
  }

  get startTime(): number {
    return this._startTime;
  }

  get endTime(): number | undefined {
    return this._endTime;
  }

  get duration(): number | undefined {
    return this._endTime ? this._endTime - this._startTime : undefined;
  }

  setAttribute(key: string, value: string | number | boolean | string[]): void {
    this._attributes[key] = value;
    this._otelSpan?.setAttribute(key, this._valueToOtelValue(value));
    
    // Store error status
    if (key === 'error.type' || key === 'error.message') {
      this._status = 'error';
    }
  }

  setAttributes(attributes: Record<string, string | number | boolean | string[]>): void {
    const entries = Object.entries(attributes);
    for (const [key, value] of entries) {
      this._attributes[key] = value;
      this._otelSpan?.setAttribute(key, this._valueToOtelValue(value));
    }
  }

  recordException(exception: unknown, attributes?: Record<string, string | number | boolean | string[]>): void {
    this._status = 'error';
    
    const errorInfo = this._extractErrorInfo(exception);
    const timestamp = Date.now();
    
    this._otelSpan?.recordException(exception);
    
    this._events.push({
      name: 'exception',
      timestamp,
      attributes: {
        ...errorInfo,
        ...attributes,
      },
    });
  }

  addEvent(name: string, attributes?: Record<string, string | number | boolean | string[]>): void {
    const otelAttributes = attributes
      ? this._otelAttributesToAttributes(attributes)
      : {};
    this._otelSpan?.addEvent(name, otelAttributes);
    
    this._events.push({
      name,
      timestamp: Date.now(),
      attributes: attributes ?? {},
    });
  }

  end(endTime?: number): void {
    if (this._endTime !== undefined) {
      return; // Already ended
    }
    
    this._endTime = endTime ?? Date.now();
    this._otelSpan?.end(this._endTime / 1000);
    
    // Restore parent context
    const parentContext = api.trace.setActiveSpan(
      this._otelSpan,
      this._context,
    );
    
    // End all children
    for (const child of this._children) {
      if (child._endTime === undefined) {
        child.end(this._endTime);
      }
    }
  }

  startChild(name: string, options?: SpanOptions): Span {
    const child = new InternalSpan(name, options, this);
    return child;
  }

  private _otelAttributesToAttributes(
    attributes: Record<string, string | number | boolean | string[]>,
  ): api.SpanAttributes {
    const result: api.SpanAttributes = {};
    for (const [key, value] of Object.entries(attributes)) {
      result[key] = this._valueToOtelValue(value);
    }
    return result;
  }

  private _valueToOtelValue(
    value: string | number | boolean | string[],
  ): api.SemanticAttribute {
    if (Array.isArray(value)) {
      return value;
    }
    return value;
  }

  private _extractErrorInfo(exception: unknown): Record<string, string> {
    if (exception instanceof Error) {
      return {
        'error.type': exception.constructor.name,
        'error.message': exception.message,
        'error.stack': exception.stack ?? '(no stack trace)',
      };
    } else if (typeof exception === 'string') {
      return {
        'error.type': 'stringError',
        'error.message': exception,
      };
    } else if (exception !== null && typeof exception === 'object') {
      if ('name' in exception && typeof exception.name === 'string') {
        const info: Record<string, string> = {
          'error.type': exception.name,
        };
        if ('message' in exception && typeof exception.message === 'string') {
          info['error.message'] = exception.message;
        }
        if ('stack' in exception && typeof exception.stack === 'string') {
          info['error.stack'] = exception.stack;
        }
        return info;
      }
    }
    
    return {
      'error.type': 'unknown',
      'error.message': String(exception),
    };
  }
}

/**
 * Tracer implementation wrapping OpenTelemetry tracer
 */
export class TracerImpl implements Tracer {
  private _currentTimeContextId: string = 'default';
  
  constructor() {
    // Initialize tracer via OpenTelemetry API
  }

  startSpan(name: string, options?: SpanOptions): Span {
    // Get current context's parent span
    const currentContext = api.context.active();
    const parentSpan = api.trace.getSpan(currentContext);
    const parentImpl = parentSpan ? (parentSpan as unknown as InternalSpan) : undefined;
    
    return new InternalSpan(name, options, parentImpl, this._currentTimeContextId);
  }

  getCurrentSpan(): Span | null {
    const currentSpan = api.trace.getSpan(api.context.active());
    return currentSpan
      ? (currentSpan as unknown as Span)
      : null;
  }
}