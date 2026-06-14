import { describe, expect, it } from 'vitest';
import { QueryProcessor } from './index.js';

describe('QueryProcessor', () => {
  const processor = new QueryProcessor();

  describe('classifyQuery', () => {
    it('classifies factual queries', async () => {
      const result = await processor.process('What is the capital of France?');
      expect(result.class).toBe('factual_lookup');
    });

    it('classifies reasoning queries', async () => {
      const result = await processor.process('Why does the sky appear blue?');
      expect(result.class).toBe('reasoning');
    });

    it('classifies creative queries', async () => {
      const result = await processor.process('Write a poem about autumn');
      expect(result.class).toBe('creative');
    });

    it('classifies multi-hop queries', async () => {
      const result = await processor.process('What is the relationship between gravity and time?');
      expect(result.class).toBe('multi_hop');
    });
  });

  describe('extractKeywords', () => {
    it('extracts meaningful keywords from query', async () => {
      const result = await processor.process('How does authentication work in the session module?');
      expect(result.keywords).toContain('authentication');
      expect(result.keywords).toContain('session');
      expect(result.keywords).toContain('module');
    });

    it('filters stop words', async () => {
      const result = await processor.process('The and for but');
      // All stop words should be filtered
      expect(result.keywords.length).toBe(0);
    });
  });

  describe('HyDE generation', () => {
    it('generates hypothetical answer when model is provided', async () => {
      const model = {
        complete: async () => ({ text: 'Paris is the capital of France.' })
      };
      const p = new QueryProcessor({ model });
      const result = await p.process('What is the capital of France?');
      expect(result.hypothetical).toBe('Paris is the capital of France.');
    });

    it('skips HyDE on non-factual queries', async () => {
      const model = {
        complete: async () => ({ text: 'some response' })
      };
      const p = new QueryProcessor({ model });
      const result = await p.process('Write a poem');
      expect(result.hypothetical).toBeUndefined();
    });

    it('gracefully handles model errors', async () => {
      const model = {
        complete: () => {
          throw new Error('model down');
        }
      };
      const p = new QueryProcessor({ model });
      const result = await p.process('What is the capital?');
      expect(result.hypothetical).toBeUndefined();
      expect(result.class).toBe('factual_lookup');
    });
  });
});
