import { describe, expect, it } from 'vitest';

import { createHierarchicalSummarizationStrategy } from './hierarchical-summarization.js';

describe('hierarchical summarization strategy', () => {
  it('keeps the tail while reducing oversized message sets', () => {
    const strategy = createHierarchicalSummarizationStrategy<string>();
    const messages = Array.from({ length: 9 }, (_, i) => `message-${i}`);

    const result = strategy.compress(messages, {
      maxTokens: 10,
      preserveLast: 2
    });

    expect(result.messages.slice(-2)).toStrictEqual(['message-7', 'message-8']);
    expect(result.metadata.strategy).toBe('hierarchical-summarization');
  });
});
