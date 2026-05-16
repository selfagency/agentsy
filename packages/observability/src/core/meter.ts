/**
 * Meter Implementation
 *
 * OpenTelemetry-based meter implementation for metrics collection
 */

import * as api from "@opentelemetry/api";

import type {
  AttributeValue,
  Counter,
  Gauge,
  Histogram,
  Meter,
  MetricOptions,
  ObservableGauge,
} from "../core/types.js";

/**
 * Base implementation for shared utility methods
 */
abstract class BaseMetric {
  protected _otelAttributesToAttributes(
    attributes: Record<string, AttributeValue>
  ): api.Attributes {
    return attributes;
  }
}

/**
 * Counter implementation
 */
class CounterImpl extends BaseMetric implements Counter {
  private readonly _otelCounter: api.Counter;

  constructor(otelCounter: api.Counter) {
    super();
    this._otelCounter = otelCounter;
  }

  increment(
    amount?: number,
    attributes?: Record<string, AttributeValue>
  ): void {
    const amt = amount ?? 1;
    const attrs = attributes
      ? this._otelAttributesToAttributes(attributes)
      : {};
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
  private readonly _otelHistogram: api.Histogram;

  constructor(otelHistogram: api.Histogram) {
    super();
    this._otelHistogram = otelHistogram;
  }

  record(amount: number, attributes?: Record<string, AttributeValue>): void {
    const attrs = attributes
      ? this._otelAttributesToAttributes(attributes)
      : {};
    this._otelHistogram.record(amount, attrs);
  }
}

/**
 * Gauge implementation
 */
class GaugeImpl extends BaseMetric implements Gauge {
  private readonly _otelGauge: api.Gauge;

  constructor(otelGauge: api.Gauge) {
    super();
    this._otelGauge = otelGauge;
  }

  record(amount: number, attributes?: Record<string, AttributeValue>): void {
    const attrs = attributes
      ? this._otelAttributesToAttributes(attributes)
      : {};
    this._otelGauge.record(amount, attrs);
  }

  increment(
    amount?: number,
    attributes?: Record<string, AttributeValue>
  ): void {
    const amt = amount ?? 1;
    const attrs = attributes
      ? this._otelAttributesToAttributes(attributes)
      : {};
    if ("add" in this._otelGauge && typeof this._otelGauge.add === "function") {
      (this._otelGauge as unknown as api.Counter).add(amt, attrs);
    }
  }

  decrement(
    amount?: number,
    attributes?: Record<string, AttributeValue>
  ): void {
    const amt = amount ?? 1;
    const attrs = attributes
      ? this._otelAttributesToAttributes(attributes)
      : {};
    if ("add" in this._otelGauge && typeof this._otelGauge.add === "function") {
      (this._otelGauge as unknown as api.Counter).add(-amt, attrs);
    }
  }
}

/**
 * Observable gauge implementation
 */
class ObservableGaugeImpl extends BaseMetric implements ObservableGauge {
  private readonly _observableResult: api.ObservableResult<api.Attributes>;

  constructor(observableResult: api.ObservableResult<api.Attributes>) {
    super();
    this._observableResult = observableResult;
  }

  record(amount: number, attributes?: Record<string, AttributeValue>): void {
    const attrs = attributes
      ? this._otelAttributesToAttributes(attributes)
      : {};
    this._observableResult.observe(amount, attrs);
  }
}

/**
 * Meter implementation wrapping OpenTelemetry meter
 */
export class MeterImpl implements Meter {
  private readonly _otelMeter: api.Meter;

  constructor() {
    this._otelMeter = api.metrics.getMeter("agentsy");
  }

  createCounter(name: string, options?: MetricOptions): Counter {
    const otelOptions: api.MetricOptions = {};
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
    const otelOptions: api.MetricOptions = {};
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
    const otelOptions: api.MetricOptions = {};
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
    const otelOptions: api.MetricOptions = {};
    if (options?.description) {
      otelOptions.description = options.description;
    }
    if (options?.unit) {
      otelOptions.unit = options.unit;
    }

    this._otelMeter.addBatchObservableCallback(
      async (_batch: api.BatchObservableResult) => {
        // Real implementation would be more complex.
      },
      []
    );

    const otelObservable = this._otelMeter.createObservableGauge(
      name,
      otelOptions
    );
    otelObservable.addCallback((result: api.ObservableResult) => {
      callback(new ObservableGaugeImpl(result));
    });

    // We need to return a dummy ObservableGauge that doesn't actually do anything
    // since the real recording happens in the callback.
    return {
      record: (
        _amount: number,
        _attributes?: Record<string, AttributeValue>
      ) => {},
    };
  }
}
