import { describe, expect, it } from 'vitest';

import { rankReusableMemoryBlocks } from './index.js';

describe('rankReusableMemoryBlocks', () => {
  it('prefers blocks with matching fingerprints and better reuse signals', () => {
    const ranked = rankReusableMemoryBlocks(
      [
        { fingerprint: 'systemPrompt:qwen:v3', reuseClass: 'hot', hitCount: 9, invalidations: [] },
        { fingerprint: 'systemPrompt:qwen:v2', reuseClass: 'cold', hitCount: 12, invalidations: ['template:v2'] },
        { fingerprint: 'memory:qwen:v3', reuseClass: 'warm', hitCount: 5, invalidations: [] }
      ],
      'systemPrompt:qwen:v3'
    );

    expect(ranked[0]?.fingerprint).toBe('systemPrompt:qwen:v3');
    expect(ranked[0]?.reuseClass).toBe('hot');
    expect(ranked).toHaveLength(2);
  });
});
