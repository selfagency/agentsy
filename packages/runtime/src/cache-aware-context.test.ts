import { describe, expect, it } from 'vitest';

import { buildRuntimeContext } from './index.js';

describe('buildRuntimeContext', () => {
  it('reuses cached segments when fingerprints still match', () => {
    const context = buildRuntimeContext({
      modelFamily: 'qwen',
      reusableSegments: [
        {
          fingerprint: 'systemPrompt:qwen:v3',
          invalidations: [],
          reuseClass: 'hot'
        }
      ],
      templateVersion: 'v3'
    });

    expect(context.reusedSegments).toContain('systemPrompt:qwen:v3');
  });

  it('filters by explicit invalidation keys only', () => {
    const context = buildRuntimeContext({
      invalidatedKeys: ['memory-summary'],
      modelFamily: 'qwen',
      reusableSegments: [
        {
          fingerprint: 'systemPrompt:qwen:v3',
          invalidations: ['model-family:qwen', 'template:v3'],
          reuseClass: 'hot'
        },
        {
          fingerprint: 'memorySummary:qwen:v3',
          invalidations: ['memory-summary'],
          reuseClass: 'warm'
        }
      ],
      templateVersion: 'v3'
    });

    expect(context.reusedSegments).toContain('systemPrompt:qwen:v3');
    expect(context.reusedSegments).not.toContain('memorySummary:qwen:v3');
  });
});
