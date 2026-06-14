/**
 * Stage 5: RAG Engine
 *
 * Composes QueryProcessor, hybridRetrieve, reranker, and ContextBuilder
 * into a single end-to-end RAG pipeline.
 */

import type { ContextBuilderOptions } from './context/index.js';
import { ContextBuilder } from './context/index.js';
import type { ProcessedQuery } from './query/index.js';
import { QueryProcessor } from './query/index.js';
import type { RerankerConfig, RerankerStrategy } from './reranking/index.js';
import { createReranker } from './reranking/index.js';
import type { DenseIndex, HybridOptions, RetrievalResult, SparseIndex } from './retrieval/index.js';
import { hybridRetrieve } from './retrieval/index.js';

export interface RagEngineOptions {
  /** Context builder options (maxTokens, ordering). */
  contextBuilderOptions?: ContextBuilderOptions;
  /** Dense (vector) index for hybrid search. */
  denseIndex?: DenseIndex;
  /** Reranker configuration — omit for passthrough. */
  rerankerConfig?: RerankerConfig;
  /** Sparse (keyword) index for hybrid search. */
  sparseIndex?: SparseIndex;
  /** Default top-K for retrieval (default: 10). */
  topK?: number;
}

export interface RagResult {
  /** Token-limited context string with citations. */
  context: string;
  /** Original query text. */
  query: string;
  /** Retrieved and reranked chunks. */
  results: RetrievalResult[];
}

export class RagEngine {
  private readonly queryProcessor: QueryProcessor;
  private readonly contextBuilder: ContextBuilder;
  private readonly options: RagEngineOptions;

  constructor(options: RagEngineOptions = {}) {
    this.queryProcessor = new QueryProcessor();
    this.contextBuilder = new ContextBuilder();
    this.options = options;
  }

  /**
   * Placeholder for future initialization (index loading, model warmup, etc.).
   */
  async init(): Promise<void> {
    // No-op — reserved for future async setup
  }

  /**
   * Run the full RAG pipeline:
   *   1. Process the query (classification, keyword extraction)
   *   2. Hybrid retrieve (sparse + dense via RRF)
   *   3. Rerank results
   *   4. Build token-limited context with citations
   */
  async query(text: string, options?: { topK?: number; reranker?: RerankerStrategy }): Promise<RagResult> {
    const topK = options?.topK ?? this.options.topK ?? 10;
    const rerankerStrategy = options?.reranker ?? 'passthrough';

    // 1. Process query
    const processed: ProcessedQuery = await this.queryProcessor.process(text);

    // 2. Hybrid retrieve
    const { denseIndex, sparseIndex } = this.options;
    const hybridOptions: HybridOptions = { topK };
    const results: RetrievalResult[] = await hybridRetrieve(
      processed.original,
      {
        dense: denseIndex ?? { search: () => Promise.resolve([]) },
        sparse: sparseIndex ?? { search: () => Promise.resolve([]) }
      },
      hybridOptions
    );

    // 3. Rerank
    const reranker = createReranker(this.options.rerankerConfig, rerankerStrategy);
    const reranked = await reranker.rerank(processed.original, results, topK);

    // 4. Build context
    const built = this.contextBuilder.build(reranked, this.options.contextBuilderOptions);

    return {
      results: reranked,
      context: built.text,
      query: text
    };
  }
}

/**
 * Factory function that creates and returns a RagEngine instance.
 */
export async function initRag(options?: RagEngineOptions): Promise<RagEngine> {
  const engine = new RagEngine(options);
  await engine.init();
  return engine;
}
