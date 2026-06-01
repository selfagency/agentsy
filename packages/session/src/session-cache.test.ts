import { describe, expect, it } from 'vitest';

import { createSessionSnapshot } from './index.js';

describe('createSessionSnapshot', () => {
  it('persists reusable context metadata for resume', () => {
    const snapshot = createSessionSnapshot({
      id: 'session-1',
      values: { modelFamily: 'qwen' },
      reusableSegments: [
        {
          fingerprint: 'systemPrompt:qwen:v3',
          reuseClass: 'hot',
          invalidations: ['model-family:qwen', 'template:v3']
        }
      ]
    });

    expect(snapshot.state.reusableSegments?.[0]?.reuseClass).toBe('hot');
    expect(snapshot.state.modelFamily).toBe('qwen');
    expect(snapshot.checksum).toMatch(/^sha256:/);
  });
});
