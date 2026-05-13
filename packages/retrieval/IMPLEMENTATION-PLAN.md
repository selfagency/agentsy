# @agentsy/retrieval — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/retrieval` is the **information specialist** of the framework. It handles the "Retrieval" part of RAG (Retrieval-Augmented Generation). It provides the core indexing pipelines and query processors that turn vast amounts of unstructured data (codebases, websites, session logs) into searchable knowledge for agents.

It is consumed by `@agentsy/cli` (for indexing commands) and `@agentsy/runtime` (for context assembly).

### Ecosystem Sketch

```text
[ @agentsy/cli ]       [ @agentsy/runtime ]
      |                        |
      v                        v
[ @agentsy/retrieval ] <--- Search & Indexing
      |
      +-----------------------+-----------------------+
      |                       |                       |
      v                       v                       v
[ File Indexers ]       [ Web Indexers ]        [ Query Fusion ]
(AST / Semantic)        (HTML / MD)            (SQL + Vector)
```

## Fulfillment of Role

The package fulfills its role by implementing a high-performance RAG engine:

1. **Multi-modal Indexing**: Specialized strategies for code (Syntactic/AST), text (Semantic), and web content.
2. **Hybrid Search**: Fusing SQL precision (filtering by path, type, or tags) with Vector similarity (semantic match).
3. **Re-ranking**: Using cross-encoders to refine the top-k results for higher precision.
4. **Chunking Strategies**: Pluggable logic for fixed-size, semantic, and syntactic chunking.

## Detailed Functionality

### 1. Indexing Pipeline (`src/indexing/`)

- **Mechanism**: `IndexingPipeline` with pluggable `Indexer` modules.
- **File Indexer**: Uses tree-sitter or similar AST parsers to chunk code by function/class boundaries.
- **Web Indexer**: Converts HTML to clean Markdown before embedding.
- **Embedding Integration**: Consumes `@agentsy/core/universal-client` for generating vectors.

### 2. Search Engine (`src/search/`)

- **Mechanism**: `RetrievalEngine` orchestrating SQLite and Vector DBs.
- **Fusion Logic**: Implements RRF (Reciprocal Rank Fusion) to combine results from BM25 (keyword) and Dense Vector (semantic) searches.
- **Filtering**: Allows agents to restrict search to specific file patterns or time ranges.

### 3. Re-ranking (`src/ranking/`)

- **Responsibility**: Precision improvement.
- **Logic**: A lightweight cross-encoder pass over the top 10-20 results to ensure the most relevant context is selected for the limited context window.

## Logic & Data Flow

### 1. The Indexing Flow

1. `IndexingPipeline.process(source)` is called.
2. The source is chunked using the selected strategy.
3. Chunks are passed to `@agentsy/core` for embedding.
4. Embeddings and metadata are stored in the `DocumentStore`.
5. Relationships (e.g., imports/exports) are extracted and indexed as graph edges.

### 2. The Retrieval Flow

1. `@agentsy/runtime` calls `RetrievalEngine.search(query)`.
2. The engine executes a parallel search:
   - SQL query for metadata/keywords.
   - Vector query for semantic similarity.
3. Results are merged and re-ranked.
4. The final ranked list of `RetrievalResults` is returned for context injection.

## Key Interfaces

### IndexingPipeline

```typescript
export interface IndexingPipeline {
  index(source: DataSource): Promise<IndexingResult>;
  chunk(content: string, strategy: ChunkingStrategy): Chunk[];
  embed(chunks: Chunk[]): Promise<void>;
}
```

### RetrievalEngine

```typescript
export interface RetrievalEngine {
  search(query: RetrievalQuery): Promise<RetrievalResult[]>;
  indexPage(page: Document): Promise<void>;
  removePage(id: string): Promise<void>;
}
```

## Implementation Details

### Syntactic Chunking

For codebases, the system should prioritize syntactic boundaries. A function or a class should be treated as a single semantic unit, preventing the "mid-function split" that often occurs with fixed-size chunking.

### Hybrid Storage

The `DocumentStore` should support local-first backends like libSQL or SQLite-VEC for embedded search capabilities.

## Sources Synthesized

`agentsy-prd.md`, `agentsy-deep-dive-v2.md`, `agentsy-testing-plan.md`, `research/AGENT-PLATFORMS-ANALYSIS.md`, `packages/retrieval/IMPLEMENTATION-PLAN.md`.

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Retrieval interfaces preserved

```typescript
interface RetrievalEngine {
  indexPage(page: WikiPage): Promise<void>;
  indexPages(pages: WikiPage[]): Promise<void>;
  removePage(pageId: string): Promise<void>;
  search(
    query: string,
    options?: { topK?: number; minSimilarity?: number },
  ): Promise<Array<WikiPage & { similarity: number }>>;
}
```

### Backend constraints

- Local-first libSQL/SQLite vector backend remains preferred for deterministic offline workflows.
- Turso-backed remote mode remains supported through explicit config.
- Retrieval indexes synthesized wiki pages rather than raw conversational event logs.
