import { describe, expect, it } from 'vitest';

import { createAnchoredIterativeStrategy } from './anchored-iterative.js';

describe('anchored iterative strategy', () => {
  it('preserves directive and tool-call messages as anchors when compressing', () => {
    const strategy = createAnchoredIterativeStrategy();
    const result = strategy.compress(
      [
        { content: 'Explain the plan.', role: 'user' },
        { content: 'I will do that.', role: 'assistant' },
        { content: 'Use the new API endpoint.', role: 'user' },
        { content: 'Calling tool now.', role: 'assistant', toolUse: { name: 'query_api', args: {} } }
      ],
      { maxTokens: 100, preserveLast: 1 }
    );

    expect(result.metadata.strategy).toBe('anchored-iterative');
    expect(result.messages).toHaveLength(4);
  });
});
