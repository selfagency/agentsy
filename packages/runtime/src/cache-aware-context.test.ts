import { describe, expect, it } from 'vitest';

import { buildRuntimeContext } from './index.js';

describe('buildRuntimeContext', () => {
  it('reuses cached segments when fingerprints still match', () => {
    const context = buildRuntimeContext({
      modelFamily: 'qwen',
      templateVersion: 'v3',
      reusableSegments: [{ fingerprint: 'systemPrompt:qwen:v3', reuseClass: 'hot', invalidations: [] }],
    });

    expect(context.reusedSegments).toContain('systemPrompt:qwen:v3');
  });
});
