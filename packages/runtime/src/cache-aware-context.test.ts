import { describe, expect, it } from 'vitest';

import { buildRuntimeContext } from './index.js';

describe('buildRuntimeContext', () => {
  it('reuses cached segments when fingerprints still match', () => {
    const context = buildRuntimeContext({
      modelFamily: 'qwen',
      templateVersion: 'v3',
      reusableSegments: [{ fingerprint: 'systemPrompt:qwen:v3', reuseClass: 'hot', invalidations: [] }]
    });

    expect(context.reusedSegments).toContain('systemPrompt:qwen:v3');
  });

  it('filters by explicit invalidation keys only', () => {
    const context = buildRuntimeContext({
      modelFamily: 'qwen',
      templateVersion: 'v3',
      invalidatedKeys: ['memory-summary'],
      reusableSegments: [
        {
          fingerprint: 'systemPrompt:qwen:v3',
          reuseClass: 'hot',
          invalidations: ['model-family:qwen', 'template:v3']
        },
        {
          fingerprint: 'memorySummary:qwen:v3',
          reuseClass: 'warm',
          invalidations: ['memory-summary']
        }
      ]
    });

    expect(context.reusedSegments).toContain('systemPrompt:qwen:v3');
    expect(context.reusedSegments).not.toContain('memorySummary:qwen:v3');
  });
});
