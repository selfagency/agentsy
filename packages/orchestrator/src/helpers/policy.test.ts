import { describe, expect, it } from 'vitest';

import { evaluateHelperPolicy } from './policy.js';

describe('evaluateHelperPolicy', () => {
  const helper = {
    id: 'planner',
    name: 'Planner',
    description: 'desc',
    capabilities: ['planning'],
    trigger: 'manual' as const,
    visibility: 'user-visible' as const,
    maxConcurrency: 1
  };

  it('allows helper when under concurrency limit', () => {
    expect(evaluateHelperPolicy({ helper }).allowed).toBe(true);
  });

  it('blocks helper when concurrency is exhausted', () => {
    expect(evaluateHelperPolicy({ activeCount: 1, helper }).allowed).toBe(false);
  });
});
