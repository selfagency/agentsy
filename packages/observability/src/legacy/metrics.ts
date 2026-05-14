/**
 * Legacy Metrics API
 * 
 * Kept for backward compatibility with existing code.
 * Use ObservabilityEngine for new development.
 */

import type { CounterMetric, MetricsCollector } from '../index.js';

/**
 * Creates a simple metrics collector
 * @deprecated Use ObservabilityEngine instead
 */
export const createMetricsCollector = (): MetricsCollector => {
  const counters = new Map<string, number>();

  return {
    increment(name: string, amount = 1) {
      const current = counters.get(name) ?? 0;
      counters.set(name, current + amount);
    },

    snapshot() {
      return [...counters.entries()].map(([name, value]) => ({ name, value }));
    },
  };
};

export type { CounterMetric } from '../index.js';