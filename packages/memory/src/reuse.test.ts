import { describe, expect, it } from 'vitest';

import { rankReusableMemoryBlocks } from './index.js';

describe('rankReusableMemoryBlocks', () => {
  it('prefers blocks with matching fingerprints and better reuse signals', () => {
    const ranked = rankReusableMemoryBlocks(
      [
        {
          fingerprint: 'systemPrompt:qwen:v3',
          hitCount: 9,
          invalidations: [],
          reuseClass: 'hot'
        },
        {
          fingerprint: 'systemPrompt:qwen:v2',
          hitCount: 12,
          invalidations: ['template:v2'],
          reuseClass: 'cold'
        },
        {
          fingerprint: 'memory:qwen:v3',
          hitCount: 5,
          invalidations: [],
          reuseClass: 'warm'
        }
      ],
      'systemPrompt:qwen:v3'
    );

    expect(ranked[0]?.fingerprint).toBe('systemPrompt:qwen:v3');
    expect(ranked[0]?.reuseClass).toBe('hot');
    expect(ranked).toHaveLength(2);
  });

  it('filters invalidated keys separately from the prioritization fingerprint', () => {
    const ranked = rankReusableMemoryBlocks(
      [
        {
          fingerprint: 'systemPrompt:qwen:v3',
          hitCount: 9,
          invalidations: ['template:v2'],
          reuseClass: 'hot'
        }
      ],
      'systemPrompt:qwen:v3',
      ['template:v2']
    );

    expect(ranked).toHaveLength(0);
  });
});
