import { describe, expect, it } from 'vitest';
import { CostTracker } from './cost-tracker.js';

describe('CostTracker', () => {
  it('computes cost for known models', () => {
    const tracker = new CostTracker();
    const cost = tracker.computeCost('openai', 'gpt-4o-mini', { input: 1000, output: 2000 });
    // 1K input * $0.00015/K + 2K output * $0.0006/K = $0.00015 + $0.0012 = $0.00135
    expect(cost).toBeCloseTo(0.001_35, 5);
  });

  it('returns 0 for unknown models', () => {
    const tracker = new CostTracker();
    const cost = tracker.computeCost('openai', 'unknown-model', { input: 100, output: 200 });
    expect(cost).toBe(0);
  });

  it('returns 0 for unknown providers', () => {
    const tracker = new CostTracker();
    const cost = tracker.computeCost('unknown-provider', 'gpt-4o', { input: 100, output: 200 });
    expect(cost).toBe(0);
  });

  it('tracks total accumulated cost', () => {
    const tracker = new CostTracker();
    tracker.trackLlmCall('openai', 'gpt-4o-mini', { input: 1000, output: 2000 });
    tracker.trackLlmCall('anthropic', 'claude-3-5-sonnet-20241022', { input: 500, output: 1000 });
    const snapshot = tracker.getSessionCost();
    expect(snapshot.total).toBeGreaterThan(0);
    expect(snapshot.byProvider.openai).toBeDefined();
    expect(snapshot.byProvider.anthropic).toBeDefined();
    expect(snapshot.byModel['gpt-4o-mini']).toBeDefined();
    expect(snapshot.byModel['claude-3-5-sonnet-20241022']).toBeDefined();
  });

  it('aggregates multiple calls to the same model', () => {
    const tracker = new CostTracker();
    tracker.trackLlmCall('openai', 'gpt-4o-mini', { input: 1000, output: 0 });
    tracker.trackLlmCall('openai', 'gpt-4o-mini', { input: 2000, output: 0 });
    const snapshot = tracker.getSessionCost();
    // 1000 * $0.00015/K + 2000 * $0.00015/K = $0.00015 + $0.00030 = $0.00045
    expect(snapshot.byModel['gpt-4o-mini']).toBeCloseTo(0.000_45, 5);
  });
});
