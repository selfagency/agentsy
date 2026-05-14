/**
 * @agentsy/observability - AI Agent Observability Platform
 *
 * OpenTelemetry-compatible observability stack for monitoring agent behavior,
 * cost, and performance across the Agentsy framework.
 *
 * Provides:
 * - Distributed tracing for multi-agent workflows
 * - AI-specific metrics (token usage, cost, latency)
 * - Privacy-safe redaction of sensitive data before export
 * - Structured logging with multiple severity levels
 * - Recording and replay for debugging non-deterministic interactions
 *
 * @example Basic usage
 * ```typescript
 * import { createObservabilityEngine } from '@agentsy/observability';
 *
 * const observability = createObservabilityEngine({
 *   serviceName: 'ai-agent-runtime',
 *   serviceVersion: '1.0.0',
 *   sampling: 'always_on',
 * });
 *
 * // Create a span for a task
 * const span = observability.startSpan('agent.task-execution', {
 *   attributes: {
 *     'agent.id': 'agent-123',
 *     'task.type': 'security-review',
 *   },
 * });
 *
 * // Record metrics
 * observability.recordCounter('tasks.completed', 1, {
 *   'agent.type': 'code-reviewer',
 * });
 * ```
 */

// Core types and implementations
export * from './core/logger.js';
export * from './core/meter.js';
export * from './core/observability.js';
export * from './core/tracer.js';
export * from './core/types.js';

// Legacy exports for backward compatibility
/** @deprecated Use getDefaultEngine().meter instead */
export const createMetricsCollector = () => {
  const counters = new Map<string, number>();
  return {
    increment(name: string, amount = 1) {
      const current = counters.get(name) ?? 0;
      counters.set(name, current + amount);
    },
    snapshot() {
      return Array.from(counters.entries()).map(([name, value]) => ({ name, value }));
    },
  };
};

/** @deprecated Use Counter instead */
export type CounterMetric = {
  record(amount: number, attributes?: Record<string, string | number | boolean | string[]>): void;
};

/** @deprecated Use Meter instead */
export type MetricsCollector = {
  increment(name: string, amount?: number): void;
  snapshot(): Array<{ name: string; value: number }>;
};
