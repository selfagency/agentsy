// @agentsy/observability — Observability, metrics, and tracing
// Initial API scaffold. For broader roadmap context, see plan/MASTER-IMPLEMENTATION-PLAN.md.

export interface CounterMetric {
  name: string;
  value: number;
}

export interface MetricsCollector {
  increment(name: string, amount?: number): void;
  snapshot(): CounterMetric[];
}

export const createMetricsCollector = (): MetricsCollector => {
  const counters = new Map<string, number>();

  return {
    increment(name, amount = 1) {
      const current = counters.get(name) ?? 0;
      counters.set(name, current + amount);
    },
    snapshot() {
      return [...counters.entries()].map(([name, value]) => ({ name, value }));
    },
  };
};
