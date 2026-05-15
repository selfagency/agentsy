---
goal: @agentsy/retrieval production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: retrieval-maintainers
status: In progress
tags: [feature, architecture, retrieval, indexing, rag]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/retrieval` as the local-first indexing and search subsystem.

## 1. Requirements & Constraints

- **REQ-RETRIEVAL-001**: Indexing supports file/document/web connectors through pluggable adapters.
- **REQ-RETRIEVAL-002**: Search supports lexical/semantic/hybrid pathways with ranking fusion.
- **REQ-RETRIEVAL-003**: Retrieval outputs preserve provenance and citation metadata.
- **REQ-RETRIEVAL-004**: Runtime injection pathways remain budget-aware and deterministic.
- **SEC-RETRIEVAL-001**: Ingestion enforces source allowlists and content sanitization.
- **SEC-RETRIEVAL-002**: Retrieved content is treated as untrusted until sanitized by assembly boundaries.
- **CON-RETRIEVAL-001**: Long-horizon durable knowledge remains in `@agentsy/memory`.
- **CON-RETRIEVAL-002**: UI rendering concerns remain outside retrieval package.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-RETRIEVAL-001: Contract stabilization.

| Task               | Description                                                         | Completed | Date |
| ------------------ | ------------------------------------------------------------------- | --------- | ---- |
| TASK-RETRIEVAL-001 | Stabilize index/query/result schema and citation payload contracts. |           |      |
| TASK-RETRIEVAL-002 | Add typed tests for deterministic ranking and filter behavior.      |           |      |
| TASK-RETRIEVAL-003 | Document boundaries with memory/runtime/CLI.                        |           |      |

### Implementation Phase 2

- GOAL-RETRIEVAL-002: Core retrieval subsystem completion.

| Task               | Description                                                        | Completed | Date |
| ------------------ | ------------------------------------------------------------------ | --------- | ---- |
| TASK-RETRIEVAL-004 | Finalize indexing pipelines and incremental invalidation behavior. |           |      |
| TASK-RETRIEVAL-005 | Implement unified lexical+semantic query fusion and ranking.       |           |      |
| TASK-RETRIEVAL-006 | Implement provenance tagging and source-policy enforcement.        |           |      |

### Implementation Phase 3

- GOAL-RETRIEVAL-003: Integration and CLI workflows.

| Task               | Description                                                                       | Completed | Date |
| ------------------ | --------------------------------------------------------------------------------- | --------- | ---- |
| TASK-RETRIEVAL-007 | Integrate runtime context assembly and memory retrieval bridge pathways.          |           |      |
| TASK-RETRIEVAL-008 | Add integration tests for `/index`, `/search`, `/sources`, and citation coverage. |           |      |
| TASK-RETRIEVAL-009 | Add document/diff open workflows routed through renderer panes.                   |           |      |

### Implementation Phase 4

- GOAL-RETRIEVAL-004: Hardening and release gates.

| Task               | Description                                                          | Completed | Date |
| ------------------ | -------------------------------------------------------------------- | --------- | ---- |
| TASK-RETRIEVAL-010 | Add benchmark/regression tests for quality uplift and source recall. |           |      |
| TASK-RETRIEVAL-011 | Update docs/examples with fallback mode guidance.                    |           |      |
| TASK-RETRIEVAL-012 | Pass package and monorepo release gates.                             |           |      |

## 3. Acceptance Criteria

- **ACC-RETRIEVAL-001**: Retrieval quality, provenance, and determinism metrics meet thresholds.
- **ACC-RETRIEVAL-002**: Runtime/CLI integration tests pass.
- **ACC-RETRIEVAL-003**: Release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `packages/retrieval/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/retrieval — Implementation Plan

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

### 2.1 Backend strategy and external adapters

Retrieval should stay local-first by default, with small adapter points for managed backends.

- **Primary backend**: SQLite/libSQL + local vector store for deterministic offline workflows.
- **Managed retrieval adapter**: an R2R-style backend for teams that want hosted ingestion, search, and ranking.
- **Memory adjacency**: keep cross-session memory semantics in `@agentsy/memory`; retrieval should surface search results and provenance, not become the memory store itself.
- **Optional replay metadata**: retain source IDs, chunk IDs, and index versioning so replay/debug tools can reconstruct what the engine saw.

If the managed adapter is enabled, it should still expose the same `RetrievalEngine` contract so runtime callers do not need to know which backend is active.

### 3. Re-ranking (`src/ranking/`)

- **Responsibility**: Precision improvement.
- **Logic**: A lightweight cross-encoder pass over the top 10-20 results to ensure the most relevant context is selected for the limited context window.

### 4. Conditional media retrieval (`tldw_server`)

If media analysis becomes a first-class requirement, add a secondary retrieval adapter modeled after `tldw_server`.

- **Supported media**: video transcripts/chapters, audio transcription/summary, OCR/description for images.
- **Provider breadth**: multi-provider embeddings and completions when a local-only stack is not enough.
- **Interface options**: CLI and Web UI for teams that prefer a non-MCP workflow.

**Recommendation:**

- Keep `mcp-rag-server` as the primary RAG path.
- Add `tldw_server` only when media analysis is critical and the extra surface area is justified.
- Preserve the same retrieval contract so runtime callers do not care which backend is active.

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

### Planned backend tasks

- Define a `RetrievalBackend` interface that can wrap local SQLite and remote R2R implementations.
- Preserve RRF and reranking at the engine layer so backend swaps do not change ranking semantics.
- Add provenance-preserving fixtures that verify backend parity for path, tag, and time-range filters.

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
    options?: { topK?: number; minSimilarity?: number }
  ): Promise<Array<WikiPage & { similarity: number }>>;
}
```

### Backend constraints

- Local-first libSQL/SQLite vector backend remains preferred for deterministic offline workflows.
- Turso-backed remote mode remains supported through explicit config.
- Retrieval indexes synthesized wiki pages rather than raw conversational event logs.
