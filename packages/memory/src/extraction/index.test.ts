import { describe, expect, it, vi } from 'vitest';
import { createFactExtractor, type FactExtractorLlm } from './index.js';

function makeLlm(response: string): FactExtractorLlm {
  return {
    complete: vi.fn().mockResolvedValue({ text: response })
  };
}

describe('createFactExtractor', () => {
  it('extracts valid facts from LLM response', async () => {
    const model = makeLlm(
      JSON.stringify([
        { kind: 'user_preference', content: 'User prefers dark mode', confidence: 0.9 },
        { kind: 'constraint', content: 'Must use PostgreSQL', confidence: 0.8 }
      ])
    );

    const extractor = createFactExtractor({ model });
    const facts = await extractor.extract('I want dark mode and PostgreSQL');

    expect(facts).toHaveLength(2);
    expect(facts[0]).toEqual({ kind: 'user_preference', content: 'User prefers dark mode', confidence: 0.9 });
    expect(facts[1]).toEqual({ kind: 'constraint', content: 'Must use PostgreSQL', confidence: 0.8 });
  });

  it('filters facts below minConfidence', async () => {
    const model = makeLlm(
      JSON.stringify([
        { kind: 'entity', content: 'Something uncertain', confidence: 0.2 },
        { kind: 'procedure', content: 'Confirmed workflow', confidence: 0.8 }
      ])
    );

    const extractor = createFactExtractor({ model, minConfidence: 0.7 });
    const facts = await extractor.extract('test');

    expect(facts).toHaveLength(1);
    expect(facts[0]?.content).toBe('Confirmed workflow');
  });

  it('filters invalid kinds', async () => {
    const model = makeLlm(JSON.stringify([{ kind: 'invalid_kind' as never, content: 'Bad kind', confidence: 0.9 }]));

    const extractor = createFactExtractor({ model });
    const facts = await extractor.extract('test');

    expect(facts).toHaveLength(0);
  });

  it('filters empty content', async () => {
    const model = makeLlm(JSON.stringify([{ kind: 'entity', content: '', confidence: 0.9 }]));

    const extractor = createFactExtractor({ model });
    const facts = await extractor.extract('test');

    expect(facts).toHaveLength(0);
  });

  it('returns empty array on non-array response', async () => {
    const model = makeLlm(JSON.stringify({ not: 'array' }));

    const extractor = createFactExtractor({ model });
    const facts = await extractor.extract('test');

    expect(facts).toHaveLength(0);
  });

  it('returns empty array on LLM error', async () => {
    const model: FactExtractorLlm = {
      complete: vi.fn().mockRejectedValue(new Error('API error'))
    };

    const extractor = createFactExtractor({ model });
    const facts = await extractor.extract('test');

    expect(facts).toHaveLength(0);
  });

  it('returns empty array on invalid JSON', async () => {
    const model = makeLlm('not json at all');

    const extractor = createFactExtractor({ model });
    const facts = await extractor.extract('test');

    expect(facts).toHaveLength(0);
  });

  it('uses default minConfidence of 0.5', async () => {
    const model = makeLlm(
      JSON.stringify([
        { kind: 'entity', content: 'Low conf', confidence: 0.3 },
        { kind: 'entity', content: 'Good conf', confidence: 0.7 }
      ])
    );

    const extractor = createFactExtractor({ model });
    const facts = await extractor.extract('test');

    expect(facts).toHaveLength(1);
    expect(facts[0]?.content).toBe('Good conf');
  });
});
