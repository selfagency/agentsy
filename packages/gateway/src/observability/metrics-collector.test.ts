import { describe, expect, it } from 'vitest';

import { MetricsCollector } from './metrics-collector.js';

describe('MetricsCollector', () => {
  it('records a successful request and aggregates global counters', () => {
    const collector = new MetricsCollector();
    collector.recordRequest({
      providerId: 'openai-main',
      modelId: 'gpt-4o',
      latencyMs: 250,
      success: true,
      tokens: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      costUsd: 0.005
    });
    const snapshot = collector.getUsageSnapshot();
    expect(snapshot.requestCount).toBe(1);
    expect(snapshot.successCount).toBe(1);
    expect(snapshot.failureCount).toBe(0);
    expect(snapshot.totalInputTokens).toBe(100);
    expect(snapshot.totalOutputTokens).toBe(200);
    expect(snapshot.totalTokens).toBe(300);
    expect(snapshot.totalCostUsd).toBeCloseTo(0.005, 5);
  });

  it('records a failure without inflating success counts', () => {
    const collector = new MetricsCollector();
    collector.recordRequest({ providerId: 'p', modelId: 'm', latencyMs: 50, success: false });
    const snapshot = collector.getUsageSnapshot();
    expect(snapshot.failureCount).toBe(1);
    expect(snapshot.successCount).toBe(0);
  });

  it('aggregates per-provider stats with error rate', () => {
    const collector = new MetricsCollector();
    for (let i = 0; i < 3; i++) {
      collector.recordRequest({ providerId: 'a', modelId: 'm', latencyMs: 100, success: true });
    }
    for (let i = 0; i < 2; i++) {
      collector.recordRequest({ providerId: 'a', modelId: 'm', latencyMs: 200, success: false });
    }
    collector.recordRequest({ providerId: 'b', modelId: 'm', latencyMs: 80, success: true });
    const snapshot = collector.getUsageSnapshot();
    const a = snapshot.perProvider.find(p => p.providerId === 'a');
    expect(a?.requestCount).toBe(5);
    expect(a?.errorRate).toBeCloseTo(0.4, 5);
    expect(a?.latency.p50).toBeGreaterThan(0);
  });

  it('tracks per-(provider, model) breakdowns', () => {
    const collector = new MetricsCollector();
    collector.recordRequest({
      providerId: 'p',
      modelId: 'gpt-4o',
      latencyMs: 100,
      success: true,
      tokens: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
    });
    collector.recordRequest({
      providerId: 'p',
      modelId: 'gpt-4o-mini',
      latencyMs: 50,
      success: true,
      tokens: { inputTokens: 5, outputTokens: 10, totalTokens: 15 }
    });
    const aggregate = collector.getProviderAggregate('p');
    expect(aggregate?.requestCount).toBe(2);
    expect(aggregate?.totalTokens).toBe(45);
  });

  it('counts failovers and circuit trips globally and per provider', () => {
    const collector = new MetricsCollector();
    collector.recordFailover('a');
    collector.recordFailover('a');
    collector.recordFailover('b');
    collector.recordCircuitTrip('a');
    const snapshot = collector.getUsageSnapshot();
    expect(snapshot.failoverCount).toBe(3);
    expect(snapshot.circuitTrips).toBe(1);
    const a = snapshot.perProvider.find(p => p.providerId === 'a');
    expect(a?.failoverCount).toBe(2);
    expect(a?.circuitTrips).toBe(1);
  });

  it('computes latency percentiles from a sample buffer', () => {
    const collector = new MetricsCollector();
    for (let i = 1; i <= 100; i++) {
      collector.recordRequest({ providerId: 'p', modelId: 'm', latencyMs: i, success: true });
    }
    const snapshot = collector.getUsageSnapshot();
    expect(snapshot.latency.p50).toBeGreaterThanOrEqual(50);
    expect(snapshot.latency.p50).toBeLessThanOrEqual(60);
    expect(snapshot.latency.p95).toBeGreaterThanOrEqual(95);
    expect(snapshot.latency.p99).toBeGreaterThanOrEqual(99);
    expect(snapshot.latency.samples).toBe(100);
  });

  it('returns undefined for any percentile when there are no samples', () => {
    const collector = new MetricsCollector();
    const snapshot = collector.getUsageSnapshot();
    expect(snapshot.latency.p50).toBeUndefined();
    expect(snapshot.latency.p95).toBeUndefined();
    expect(snapshot.latency.p99).toBeUndefined();
    expect(snapshot.latency.samples).toBe(0);
  });

  it('caps the latency sample buffer at the configured capacity', () => {
    const collector = new MetricsCollector({ sampleCapacity: 10 });
    for (let i = 1; i <= 50; i++) {
      collector.recordRequest({ providerId: 'p', modelId: 'm', latencyMs: i, success: true });
    }
    const aggregate = collector.getProviderAggregate('p');
    expect(aggregate?.latency.samples).toBe(10);
  });

  it('resets all counters', () => {
    const collector = new MetricsCollector();
    collector.recordRequest({ providerId: 'p', modelId: 'm', latencyMs: 50, success: true });
    collector.recordFailover('p');
    collector.recordCircuitTrip('p');
    collector.reset();
    const snapshot = collector.getUsageSnapshot();
    expect(snapshot.requestCount).toBe(0);
    expect(snapshot.failoverCount).toBe(0);
    expect(snapshot.circuitTrips).toBe(0);
  });

  it('returns undefined for an unconfigured provider', () => {
    const collector = new MetricsCollector();
    expect(collector.getProviderAggregate('nope')).toBeUndefined();
  });

  it('uses "__unknown__" as the model key when modelId is empty', () => {
    const collector = new MetricsCollector();
    collector.recordRequest({ providerId: 'p', modelId: '', latencyMs: 10, success: true });
    const aggregate = collector.getProviderAggregate('p');
    expect(aggregate?.requestCount).toBe(1);
  });

  it('treats zero/negative latency as "no timing"', () => {
    const collector = new MetricsCollector();
    collector.recordRequest({ providerId: 'p', modelId: 'm', latencyMs: 0, success: true });
    collector.recordRequest({ providerId: 'p', modelId: 'm', latencyMs: -5, success: true });
    const aggregate = collector.getProviderAggregate('p');
    expect(aggregate?.latency.samples).toBe(0);
  });
});
