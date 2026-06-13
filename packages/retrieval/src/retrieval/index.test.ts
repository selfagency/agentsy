import { describe, expect, it, vi } from 'vitest';
import { type DenseIndex, hybridRetrieve, type SparseIndex } from './index.js';

function makeSparse() {
  return vi.fn().mockResolvedValue([
    { id: 'a', score: 0.9, content: 'doc a' },
    { id: 'b', score: 0.5, content: 'doc b' },
    { id: 'c', score: 0.3, content: 'doc c' }
  ]);
}

function makeDense() {
  return vi.fn().mockResolvedValue([
    { id: 'b', score: 0.8, content: 'doc b' },
    { id: 'd', score: 0.7, content: 'doc d' },
    { id: 'a', score: 0.2, content: 'doc a' }
  ]);
}

describe('hybridRetrieve', () => {
  it('merges sparse and dense results', async () => {
    const indexes: { sparse: SparseIndex; dense: DenseIndex } = {
      sparse: { search: makeSparse() },
      dense: { search: makeDense() }
    };
    const results = await hybridRetrieve('test query', indexes, { topK: 3 });

    expect(results.length).toBe(3);
    expect(results[0]?.id).toBe('b'); // b has high scores in both
  });

  it('calls both indexes in parallel', async () => {
    const sparse = { search: vi.fn().mockResolvedValue([]) };
    const dense = { search: vi.fn().mockResolvedValue([]) };
    await hybridRetrieve('test', { sparse, dense });
    expect(sparse.search).toHaveBeenCalled();
    expect(dense.search).toHaveBeenCalled();
  });

  it('returns empty when both indexes return nothing', async () => {
    const indexes = {
      sparse: { search: vi.fn().mockResolvedValue([]) },
      dense: { search: vi.fn().mockResolvedValue([]) }
    };
    const results = await hybridRetrieve('nothing', indexes);
    expect(results).toEqual([]);
  });

  it('respects topK option', async () => {
    const indexes = {
      sparse: {
        search: vi.fn().mockResolvedValue([
          { id: 'a', score: 1, content: 'a' },
          { id: 'b', score: 1, content: 'b' }
        ])
      },
      dense: { search: vi.fn().mockResolvedValue([]) }
    };
    const results = await hybridRetrieve('test', indexes, { topK: 1 });
    expect(results.length).toBe(1);
  });
});
