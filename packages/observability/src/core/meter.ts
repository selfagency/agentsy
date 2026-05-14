/**
 * Meter Implementation
 * 
 * OpenTelemetry-based meter implementation for metrics collection
 */

import * as api from '@opentelemetry/api';
import {
  Meter as OtelMeter,
  Counter as OtelCounter,
  Histogram as OtelHistogram,
  Gauge as OtelGauge,
  Observable as OtelObservable,
} from '@opentelemetry/api';

import type {
  Meter,
  Counter,
  Histogram,
  Gauge,
  ObservableGauge,
  MetricOptions,
} from '../core/types.js';

/**
 * Counter implementation
 */
class CounterImpl implements Counter {
  private _otelCounter: OtelCounter;
  private _meter: OtelMeter;

  constructor(otelCounter: OtelCounter, meter: OtelMeter) {
    this._otelCounter = otelCounter;
    this._meter = meter;
  }

  increment(amount?: number, attributes?: Record<string, string | number | boolean | string[]>): void {
    const amt = amount ?? 1;
    const attrs = attributes ? this._otelAttributesToAttributes(attributes) : {};
    this._otelCounter.add(amt, attrs);
  }

  record(amount: number, attributes?: Record<string, string | number | boolean | string[]>): void {
    this.increment(amount, attributes);
  }

  private _otelAttributesToAttributes(
    attributes: Record<string, string | number | boolean | string[]>,
  ): api.MeterAttributes {
    const result: api.MeterAttributes = {};
    for (const [key, value] of Object.entries(attributes)) {
      result[key] = this._valueToOtelValue(value);
    }
    return result;
  }

  private _valueToOtelValue(
    value: string | number | boolean | string[],
  ): api.MeterAttributeValue {
    if (Array.isArray(value)) {
      return value;
    }
    return value;
  }
}

/**
 * Histogram implementation
 */
class HistogramImpl implements Histogram {
  private _otelHistogram: OtelHistogram;
  private _meter: OtelMeter;

  constructor(otelHistogram: OtelHistogram, meter: OtelMeter) {
    this._otelHistogram = otelHistogram;
    this._meter = meter;
  }

  record(amount: number, attributes?: Record<string, string | number | boolean | string[]>): void {
    const attrs = attributes ? this._otelAttributesToAttributes(attributes) : {};
    this._otelHistogram.record(amount, attrs);
  }

  private _otelAttributesToAttributes(
    attributes: Record<string, string | number | boolean | string[]>,
  ): api.MeterAttributes {
    const result: api.MeterAttributes = {};
    for (const [key, value] of Object.entries(attributes)) {
      result[key] = this._valueToOtelValue(value);
    }
    return result;
  }

  private _valueToOtelValue(
    value: string | number | boolean | string[],
  ): api.MeterAttributeValue {
    if (Array.isArray(value)) {
      return value;
    }
    return value;
  }
}

/**
 * Gauge implementation
 */
class GaugeImpl implements Gauge {
  private _otelGauge: OtelGauge;
  private _meter: OtelMeter;

  constructor(otelGauge: OtelGauge, meter: OtelMeter) {
    this._otelGauge = otelGauge;
    this._meter = meter;
  }

  record(amount: number, attributes?: Record<string, string | number | boolean | string[]>): void {
    const attrs = attributes ? this._otelAttributesToAttributes(attributes) : {};
    this._otelGauge.record(amount, attrs);
  }

  increment(amount?: number, attributes?: Record<string, string | number | boolean | string[]>): void {
    const amt = amount ?? 1;
    const attrs = attributes ? this._otelAttributesToAttributes(attributes) : {};
    this._otelGauge.inc(amt, attrs);
  }

  decrement(amount?: number, attributes?: Record<string, string | number | boolean | string[]>): void {
    const amt = amount ?? 1;
    const attrs = attributes ? this._otelAttributesToAttributes(attributes) : {};
    this._otelGauge.inc(-amt, attrs);
  }

  private _otelAttributesToAttributes(
    attributes: Record<string, string | number | boolean | string[]>,
  ): api.MeterAttributes {
    const result: api.MeterAttributes = {};
    for (const [key, value] of Object.entries(attributes)) {
      result[key] = this._valueToOtelValue(value);
    }
    return result;
  }

  private _valueToOtelValue(
    value: string | number | boolean | string[],
  ): api.MeterAttributeValue {
    if (Array.isArray(value)) {
      return value;
    }
    return value;
  }
}

/**
 * Observable gauge implementation
 */
class ObservableGaugeImpl implements ObservableGauge {
  private _observable: OtelObservableGauge;
  private _meter: OtelMeter;

  constructor(observable: OtelObservableGauge, meter: OtelMeter) {
    this._observable = observable;
    this._meter = meter;
  }

  record(amount: number, attributes?: Record<string, string | number | boolean | string[]>): void {
    const attrs = attributes ? this._otelAttributesToAttributes(attributes) : {};
    this._observable.record(amount, attrs);
  }

  private _otelAttributesToAttributes(
    attributes: Record<string, string | number | boolean | string[]>,
  ): api.MeterAttributes {
    const result: api.MeterAttributes = {};
    for (const [key, value] of Object.entries(attributes)) {
      result[key] = this._valueToOtelValue(value);
    }
    return result;
  }

  private _valueToOtelValue(
    value: string | number | boolean | string[],
  ): api.MeterAttributeValue {
    if (Array.isArray(value)) {
      return value;
    }
    return value;
  }
}

/**
 * Observable gauge wrapper for callback-based metrics
 */
interface OtelObservableGauge {
  record(value: number, attributes?: api.MeterAttributes): void;
}

/**
 * Meter implementation wrapping OpenTelemetry meter
 */
export class MeterImpl implements Meter {
  private _otelMeter: OtelMeter;

  constructor() {
    // Initialize meter via OpenTelemetry API
    this._otelMeter = api.metrics.getMeter('agentsy');
  }

  createCounter(name: string, options?: MetricOptions): Counter {
    const adv: api.Advice = {};
    if (options?.advice) {
      if (options.advice.attributeKeys && options.advice.attributeKeys.length > 0) {
        adv.attributeKeys = new Set(options.advice.attributeKeys);
      }
      if (
        options.advice.allowedAttributeKeys &&
        options.advice.allowedAttributeKeys.length > 0
      ) {
        adv.allowedAttributeKeys = new Set(options.advice.allowedAttributeKeys);
      }
    }

    const otelCounter = this._otelMeter.createCounter(name, {
      description: options?.description,
      unit: options?.unit,
      advice: adv,
    });

    return new CounterImpl(otelCounter, this._otelMeter);
  }

  createHistogram(name: string, options?: MetricOptions): Histogram {
    const adv: api.Advice = {};
    if (options?.advice) {
      if (options.advice.attributeKeys && options.advice.attributeKeys.length > 0) {
        adv.attributeKeys = new Set(options.advice.attributeKeys);
      }
      if (
        options.advice.allowedAttributeKeys &&
        options.advice.allowedAttributeKeys.length > 0
      ) {
        adv.allowedAttributeKeys = new Set(options.advice.allowedAttributeKeys);
      }
    }

    const otelHistogram = this._otelMeter.createHistogram(name, {
      description: options?.description,
      unit: options?.unit,
      advice: adv,
    });

    return new HistogramImpl(otelHistogram, this._otelMeter);
  }

  createGauge(name: string, options?: MetricOptions): Gauge {
    const adv: api.Advice = {};
    if (options?.advice) {
      if (options.advice.attributeKeys && options.advice.attributeKeys.length > 0) {
        adv.attributeKeys = new Set(options.advice.attributeKeys);
      }
      if (
        options.advice.allowedAttributeKeys &&
        options.advice.allowedAttributeKeys.length > 0
      ) {
        adv.allowedAttributeKeys = new Set(options.advice.allowedAttributeKeys);
      }
    }

    const otelGauge = this._otelMeter.createGauge(name, {
      description: options?.description,
      unit: options?.unit,
      advice: adv,
    });

    return new GaugeImpl(otelGauge, this._otelMeter);
  }

  createObservableGauge(
    name: string,
    options?: MetricOptions,
    callback: (observable: ObservableGauge) => void,
  ): ObservableGauge {
    const adv: api.Advice = {};
    if (options?.advice) {
      if (options.advice.attributeKeys && options.advice.attributeKeys.length > 0) {
        adv.attributeKeys = new Set(options.advice.attributeKeys);
      }
      if (
        options?.advice.allowAllAttributes &&
        options.advice.allowedAttributeKeys &&
        options.advice.allowedAttributeKeys.length > 0
      ) {
        adv.allowAllAttributes = options.advice.allowAllAttributes;
      }
    }

    const otelObservable: OtelObservable<api.UpDownCounter> = {
      *observe() {
        // Would need callback implementation for real observable values
        yield { value: 0 };
      },
    };

    this._otelMeter.createObservableGauge(name, options, callback as (observable) => void);
    
    return new ObservableGaugeImpl(otelObservable, this._otelMeter);
  }
}