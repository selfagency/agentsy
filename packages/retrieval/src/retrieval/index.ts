/**
 * Stage 2: Hybrid Retrieval
 *
 * Combines sparse (keyword) and dense (vector) search via Reciprocal Rank Fusion (RRF).
 * Runs both searches in parallel, merges results using RRF scoring.
 */

export interface SparseIndex {
  search(query: string, topK: number): Promise<Array<{ id: string; score: number; content: string }>>;
}

export interface DenseIndex {
  /** Search by query string. Implementors are responsible for embedding the query internally. */
  search(query: string, topK: number): Promise<Array<{ id: string; score: number; content: string }>>;
}

export interface HybridOptions {
  rrfK?: number;
  topK?: number;
}

export interface RetrievalResult {
  content: string;
  denseScore: number;
  id: string;
  rrfScore: number;
  sparseScore: number;
}

/**
 * Hybrid search using RRF to merge sparse + dense results.
 */
export async function hybridRetrieve(
  query: string,
  indexes: { dense: DenseIndex; sparse: SparseIndex },
  options: HybridOptions = {}
): Promise<RetrievalResult[]> {
  const topK = options.topK ?? 10;
  const rrfK = options.rrfK ?? 60;

  const [sparseResults, denseResults] = await Promise.all([
    indexes.sparse.search(query, topK * 2),
    indexes.dense.search(query, topK * 2)
  ]);

  const scores = new Map<string, { rrf: number; sparse: number; dense: number; content: string }>();

  sparseResults.forEach((result, rank) => {
    const existing = scores.get(result.id);
    scores.set(result.id, {
      rrf: (existing?.rrf ?? 0) + 1 / (rrfK + rank),
      sparse: result.score,
      dense: existing?.dense ?? 0,
      content: result.content
    });
  });

  denseResults.forEach((result, rank) => {
    const existing = scores.get(result.id);
    scores.set(result.id, {
      rrf: (existing?.rrf ?? 0) + 1 / (rrfK + rank),
      sparse: existing?.sparse ?? 0,
      dense: result.score,
      content: result.content
    });
  });

  return [...scores.entries()]
    .map(([id, s]) => ({
      content: s.content,
      denseScore: s.dense,
      id,
      rrfScore: s.rrf,
      sparseScore: s.sparse
    }))
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK);
}
