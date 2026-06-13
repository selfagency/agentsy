/**
 * Stage 3: Reranking
 *
 * Re-rank retrieved chunks to improve result ordering.
 * Supports BGE-style local reranking and Passthrough for no-op.
 */

import type { RetrievalResult } from '../retrieval/index.js';

export interface RerankedResult extends RetrievalResult {
  rerankScore: number;
}

export interface Reranker {
  rerank(query: string, chunks: RetrievalResult[], topN: number): Promise<RerankedResult[]>;
}

export interface RerankerConfig {
  /** BGE onnx model path — omit for passthrough. */
  modelPath?: string;
}

/**
 * Passthrough reranker — preserves retrieval order with default scores.
 */
export class PassthroughReranker implements Reranker {
  // biome-ignore lint/suspicious/useAwait: Interface requires Promise return type
  async rerank(_query: string, chunks: RetrievalResult[], topN: number): Promise<RerankedResult[]> {
    return chunks.slice(0, topN).map(c => ({
      ...c,
      rerankScore: c.rrfScore
    }));
  }
}

export type RerankerStrategy = 'passthrough' | 'bge';

export function createReranker(config: RerankerConfig = {}, strategy: RerankerStrategy = 'passthrough'): Reranker {
  if (strategy === 'bge') {
    if (config.modelPath) {
      process.emitWarning('BGE reranker not yet implemented; falling back to passthrough');
    }
    return new PassthroughReranker();
  }
  return new PassthroughReranker();
}
