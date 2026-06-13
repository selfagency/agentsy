import { describe, expect, it } from 'vitest';
import { createReranker, PassthroughReranker } from './index.js';

describe('PassthroughReranker', () => {
  it('returns top N chunks with default scores', async () => {
    const reranker = new PassthroughReranker();
    const chunks = [
      { content: 'a', id: 'a', rrfScore: 2, sparseScore: 1, denseScore: 0 },
      { content: 'b', id: 'b', rrfScore: 1, sparseScore: 0, denseScore: 1 }
    ];
    const results = await reranker.rerank('test', chunks, 1);
    expect(results.length).toBe(1);
    expect(results[0]?.id).toBe('a');
    expect(results[0]?.rerankScore).toBe(2);
  });
});

describe('createReranker', () => {
  it('creates passthrough by default', () => {
    const reranker = createReranker();
    expect(reranker).toBeInstanceOf(PassthroughReranker);
  });

  it('creates passthrough when bge has no model', () => {
    const reranker = createReranker({}, 'bge');
    expect(reranker).toBeInstanceOf(PassthroughReranker);
  });
});
