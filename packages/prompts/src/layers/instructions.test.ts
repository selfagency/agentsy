/* oxlint-disable import/no-extraneous-dependencies -- test file */
import { describe, expect, it } from 'vitest';
import { estimateTokens, type InstructionFile, InstructionsComposer, type InstructionsLayer } from './instructions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(overrides: Partial<InstructionFile> & { content: string }): InstructionFile {
  return {
    path: overrides.path ?? 'test.md',
    content: overrides.content,
    tokenCount: overrides.tokenCount ?? estimateTokens(overrides.content),
    priority: overrides.priority ?? 0,
    ...('scope' in overrides && overrides.scope !== undefined ? { scope: overrides.scope } : {})
  };
}

// ---------------------------------------------------------------------------
// estimateTokens
// ---------------------------------------------------------------------------

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('approximates 4 characters per token', () => {
    expect(estimateTokens('aaaa')).toBe(1);
    expect(estimateTokens('aaaaa')).toBe(2);
    expect(estimateTokens('a'.repeat(100))).toBe(25);
  });

  it('rounds up partial token counts', () => {
    expect(estimateTokens('a')).toBe(1);
    expect(estimateTokens('ab')).toBe(1);
    expect(estimateTokens('abc')).toBe(1);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// InstructionsLayer type
// ---------------------------------------------------------------------------

describe('InstructionsLayer type', () => {
  it('creates a layer with required fields', () => {
    const layer: InstructionsLayer = {
      type: 'instructions',
      content: 'Always use strict mode',
      tokenCount: 5,
      priority: 100
    };
    expect(layer.type).toBe('instructions');
    expect(layer.content).toBe('Always use strict mode');
    expect(layer.tokenCount).toBe(5);
    expect(layer.priority).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// InstructionsComposer
// ---------------------------------------------------------------------------

describe('InstructionsComposer', () => {
  const composer = new InstructionsComposer();

  describe('compose', () => {
    it('returns empty layer when given no instructions', () => {
      const result = composer.compose([]);
      expect(result.type).toBe('instructions');
      expect(result.content).toBe('');
      expect(result.tokenCount).toBe(0);
      expect(result.priority).toBe(0);
    });

    it('sorts instructions by priority descending', () => {
      const low = makeFile({ content: 'low-pri', priority: 1, tokenCount: 1 });
      const high = makeFile({ content: 'high-pri', priority: 100, tokenCount: 1 });
      const mid = makeFile({ content: 'mid-pri', priority: 50, tokenCount: 1 });

      const result = composer.compose([low, high, mid]);
      expect(result.content).toBe('high-pri\n\nmid-pri\n\nlow-pri');
    });

    it('joins content with double newlines', () => {
      const a = makeFile({ content: 'first', priority: 2, tokenCount: 1 });
      const b = makeFile({ content: 'second', priority: 1, tokenCount: 1 });

      const result = composer.compose([a, b]);
      expect(result.content).toBe('first\n\nsecond');
    });

    it('sums token counts from all instructions', () => {
      const a = makeFile({ content: 'a', tokenCount: 10, priority: 1 });
      const b = makeFile({ content: 'b', tokenCount: 20, priority: 2 });
      const c = makeFile({ content: 'c', tokenCount: 30, priority: 3 });

      const result = composer.compose([a, b, c]);
      expect(result.tokenCount).toBe(60);
    });

    it('uses the highest priority as the layer priority', () => {
      const low = makeFile({ content: 'a', tokenCount: 1, priority: 1 });
      const high = makeFile({ content: 'b', tokenCount: 1, priority: 99 });

      const result = composer.compose([low, high]);
      expect(result.priority).toBe(99);
    });

    it('does not mutate the input array', () => {
      const a = makeFile({ content: 'a', priority: 1, tokenCount: 1 });
      const b = makeFile({ content: 'b', priority: 2, tokenCount: 1 });
      const input: InstructionFile[] = [a, b];
      const originalOrder = [input[0]?.priority, input[1]?.priority];

      composer.compose(input);

      expect(input[0]?.priority).toBe(originalOrder[0]);
      expect(input[1]?.priority).toBe(originalOrder[1]);
    });

    it('handles single instruction', () => {
      const single = makeFile({ content: 'only one', priority: 5, tokenCount: 2 });

      const result = composer.compose([single]);
      expect(result.content).toBe('only one');
      expect(result.tokenCount).toBe(2);
      expect(result.priority).toBe(5);
    });

    it('preserves scope field on usage if needed downstream', () => {
      const withScope = makeFile({
        content: 'scoped',
        priority: 10,
        tokenCount: 1,
        scope: 'agent'
      });
      const result = composer.compose([withScope]);
      expect(result.content).toBe('scoped');
      // scope is an instruction-level concern, not propagated to the layer
    });
  });
});
