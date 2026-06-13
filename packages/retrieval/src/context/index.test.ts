import { describe, expect, it } from 'vitest';
import { ContextBuilder, lostInMiddleOrder } from './index.js';

const sampleChunks = [
  { content: 'Doc A: the beginning', id: 'a-1', rrfScore: 2, sparseScore: 0, denseScore: 0, rerankScore: 2 },
  { content: 'Doc B: the middle part', id: 'b-1', rrfScore: 1, sparseScore: 0, denseScore: 0, rerankScore: 1 },
  { content: 'Doc C: the end part', id: 'c-1', rrfScore: 3, sparseScore: 0, denseScore: 0, rerankScore: 3 },
  { content: 'Doc D: filler', id: 'd-1', rrfScore: 0.5, sparseScore: 0, denseScore: 0, rerankScore: 0.5 }
];

describe('ContextBuilder', () => {
  it('builds context with lost-in-middle ordering by default', () => {
    const builder = new ContextBuilder();
    const result = builder.build(sampleChunks, { maxTokens: 2000 });
    // Most relevant (c-1, a-1) should be at start and end
    const firstChunk = result.text.split('\n\n')[0];
    expect(firstChunk).toContain('c-1');
  });

  it('respects maxTokens', () => {
    const builder = new ContextBuilder();
    const result = builder.build(sampleChunks, { maxTokens: 10 }); // Very small — only one chunk fits
    expect(result.tokenCount).toBeLessThanOrEqual(12); // Allow small variance
  });

  it('includes citations', () => {
    const builder = new ContextBuilder();
    const result = builder.build(sampleChunks, { maxTokens: 2000 });
    expect(Object.keys(result.citations).length).toBeGreaterThan(0);
    expect(result.citations['a-1']).toBeDefined();
    expect(result.citations['a-1']?.chunkId).toBe('a-1');
  });

  it('orders by relevance when specified', () => {
    const builder = new ContextBuilder();
    const result = builder.build(sampleChunks, { ordering: 'relevance', maxTokens: 2000 });
    const firstChunk = result.text.split('\n\n')[0];
    expect(firstChunk).toContain('c-1'); // Highest rerankScore = 3
  });
});

describe('lostInMiddleOrder', () => {
  it('alternates extremes', () => {
    const ordered = lostInMiddleOrder(sampleChunks);
    expect(ordered[0]?.id).toBe('c-1'); // highest score first
    expect(ordered[1]?.id).toBe('d-1'); // lowest score last
    expect(ordered[2]?.id).toBe('a-1'); // second highest
    expect(ordered[3]?.id).toBe('b-1'); // second lowest
  });
});
