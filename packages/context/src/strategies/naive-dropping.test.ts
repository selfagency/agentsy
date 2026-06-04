import { describe, expect, it } from 'vitest';

import { createNaiveDroppingStrategy } from './naive-dropping.js';

describe('naive dropping strategy', () => {
  it('drops the oldest messages first', () => {
    const strategy = createNaiveDroppingStrategy();
    const result = strategy.compress(['aaaa', 'bbbb', 'cccc', 'dddd'], {
      estimateTokens: (value: unknown) => String(value).length,
      maxTokens: 8,
      preserveLast: 1
    });

    expect(result.messages).toStrictEqual(['cccc', 'dddd']);
    expect(result.metadata.strategy).toBe('naive-dropping');
  });
});
