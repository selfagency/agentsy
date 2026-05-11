import { describe, expect, it } from 'vitest';
import { createMetricsCollector } from './index.js';

describe('createMetricsCollector', () => {
  it('increments counters with default amount', () => {
    const metrics = createMetricsCollector();
    metrics.increment('requests');

    expect(metrics.snapshot()).toEqual([{ name: 'requests', value: 1 }]);
  });

  it('increments counters by provided amount', () => {
    const metrics = createMetricsCollector();
    metrics.increment('tokens', 3);

    expect(metrics.snapshot()).toEqual([{ name: 'tokens', value: 3 }]);
  });
});
