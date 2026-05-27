/**
 * Meter Implementation
 *
 * OpenTelemetry-based meter implementation for metrics collection
 */

import {
  type Attributes,
  type BatchObservableResult,
  metrics,
  type ObservableResult,
  type Counter as OtelCounter,
  type Gauge as OtelGauge,
  type Histogram as OtelHistogram,
  type Meter as OtelMeter,
  type MetricOptions as OtelMetricOptions
} from '@opentelemetry/api';

import type {
  AttributeValue,
  Counter,
  Gauge,
  Histogram,
  Meter,
  MetricOptions,
  ObservableGauge
} from '../core/types.js';

/**
 * Base implementation for shared utility methods
 */
abstract class BaseMetric {
  protected _otelAttributesToAttributes(attributes: Record<string, AttributeValue>): Attributes {
    return attributes;
  }
}

/**
 * Counter implementation
 */
class CounterImpl extends BaseMetric implements Counter {
  private readonly _otelCounter: OtelCounter;

  constructor(otelCounter: OtelCounter) {
    super();
    this._otelCounter = otelCounter;
  }

  increment(amount?: number, attributes?: Record<string, AttributeValue>): void {
    const amt = amount ?? 1;
    const attrs = attributes ? this._otelAttributesToAttributes(attributes) : {};
    this._otelCounter.add(amt, attrs);
  }

  record(amount: number, attributes?: Record<string, AttributeValue>): void {
    this.increment(amount, attributes);
  }
}

/**
 * Histogram implementation
 */
class HistogramImpl extends BaseMetric implements Histogram {
  private readonly _otelHistogram: OtelHistogram;

  constructor(otelHistogram: OtelHistogram) {
    super();
    this._otelHistogram = otelHistogram;
  }

  record(amount: number, attributes?: Record<string, AttributeValue>): void {
    const attrs = attributes ? this._otelAttributesToAttributes(attributes) : {};
    this._otelHistogram.record(amount, attrs);
  }
}

/**
 * Gauge implementation with increment/decrement support
 */
class GaugeImpl extends BaseMetric implements Gauge {
  private readonly _otelGauge: OtelGauge;

  constructor(otelGauge: OtelGauge) {
    super();
    this._otelGauge = otelGauge;
  }

  record(amount: number, attributes?: Record<string, AttributeValue>): void {
    const attrs = attributes ? this._otelAttributesToAttributes(attributes) : {};
    this._otelGauge.record(amount, attrs);
  }

  increment(amount?: number, attributes?: Record<string, AttributeValue>): void {
    const amt = amount ?? 1;
    const attrs = attributes ? this._otelAttributesToAttributes(attributes) : {};
    this._recordWithAdd(amt, attrs);
  }

  decrement(amount?: number, attributes?: Record<string, AttributeValue>): void {
    const amt = amount ?? 1;
    const attrs = attributes ? this._otelAttributesToAttributes(attributes) : {};
    this._recordWithAdd(-amt, attrs);
  }

  /**
   * Helper method to safely record using the add method if available
   */
  private _recordWithAdd(amount: number, attributes: Attributes): void {
    const gauge = this._otelGauge;
    // Check if the gauge supports the add method
    if ('add' in gauge && typeof gauge.add === 'function') {
      // This type assertion is safe because we've checked that add exists
      // and is a function above
      // biome-ignore lint: typescript/no-unsafe-type-assertion
      const gaugeWithAdd = gauge as {
        add: (amount: number, attributes?: Attributes) => void;
      };
      gaugeWithAdd.add(amount, attributes);
    }
  }
}

/**
 * Observable gauge implementation
 */
class ObservableGaugeImpl extends BaseMetric implements ObservableGauge {
  private readonly _observableResult: ObservableResult;

  constructor(observableResult: ObservableResult) {
    super();
    this._observableResult = observableResult;
  }

  record(amount: number, attributes?: Record<string, AttributeValue>): void {
    const attrs = attributes ? this._otelAttributesToAttributes(attributes) : {};
    this._observableResult.observe(amount, attrs);
  }
}

/**
 * Meter implementation wrapping OpenTelemetry meter
 */
export class MeterImpl implements Meter {
  private readonly _otelMeter: OtelMeter;

  constructor() {
    this._otelMeter = metrics.getMeter('agentsy');
  }

  createCounter(name: string, options?: MetricOptions): Counter {
    const otelOptions: OtelMetricOptions = {};
    if (options?.description) {
      otelOptions.description = options.description;
    }
    if (options?.unit) {
      otelOptions.unit = options.unit;
    }

    const otelCounter = this._otelMeter.createCounter(name, otelOptions);
    return new CounterImpl(otelCounter);
  }

  createHistogram(name: string, options?: MetricOptions): Histogram {
    const otelOptions: OtelMetricOptions = {};
    if (options?.description) {
      otelOptions.description = options.description;
    }
    if (options?.unit) {
      otelOptions.unit = options.unit;
    }

    const otelHistogram = this._otelMeter.createHistogram(name, otelOptions);
    return new HistogramImpl(otelHistogram);
  }

  createGauge(name: string, options?: MetricOptions): Gauge {
    const otelOptions: OtelMetricOptions = {};
    if (options?.description) {
      otelOptions.description = options.description;
    }
    if (options?.unit) {
      otelOptions.unit = options.unit;
    }

    const otelGauge = this._otelMeter.createGauge(name, otelOptions);
    return new GaugeImpl(otelGauge);
  }

  createObservableGauge(
    name: string,
    callback: (observable: ObservableGauge) => void,
    options?: MetricOptions
  ): ObservableGauge {
    const otelOptions: OtelMetricOptions = {};
    if (options?.description) {
      otelOptions.description = options.description;
    }
    if (options?.unit) {
      otelOptions.unit = options.unit;
    }

    this._otelMeter.addBatchObservableCallback(async (_batch: BatchObservableResult) => {
      // Real implementation would be more complex.
    }, []);

    const otelObservable = this._otelMeter.createObservableGauge(name, otelOptions);
    otelObservable.addCallback((result: ObservableResult) => {
      callback(new ObservableGaugeImpl(result));
    });

    // We need to return a dummy ObservableGauge that doesn't actually do anything
    // since the real recording happens in the callback.
    return {
      record: (_amount: number, _attributes?: Record<string, AttributeValue>) => {
        /* noop */
      }
    };
  }
}
