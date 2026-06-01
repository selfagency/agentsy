import { describe, expect, it } from 'vitest';

import { buildContextSegments } from './contextSegments.js';

describe('buildContextSegments', () => {
  it('builds deterministic reusable context segments', () => {
    const segments = buildContextSegments({
      systemPrompt: 'You are helpful',
      toolSchema: { type: 'object', properties: { name: { type: 'string' } } },
      memorySummary: 'cached summary',
      modelFamily: 'qwen',
      templateVersion: 'v3'
    });

    expect(segments).toHaveLength(3);
    expect(segments[0]?.fingerprint.value).toMatch(/^sha256:/);
    expect(segments[0]?.reuseClass).toBe('hot');
    expect(segments.some(segment => segment.invalidations.includes('template:v3'))).toBe(true);
  });
});
