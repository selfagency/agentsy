# Phase 8 — Retrieval / RAG Augmentation (4-Stage Pipeline)

**Effort:** ~14 hours  
**Milestone:** Local-first RAG with source attribution  
**Packages:** `@agentsy/retrieval`, `@agentsy/memory`  
**Gate:** 4-stage pipeline working; hybrid ranking + reranking functional  
**Next:** Phase 9

---

## Overview

Build complete retrieval pipeline with 4 stages: query processing, hybrid retrieval, reranking, context building. All local-first; zero external dependencies for core functionality.

---

## TASK-037: Manifest Promotion

**Effort:** ~1 hour

Move from plan-only to executable:

```typescript
// packages/retrieval/package.json
{
  \"name\": \"@agentsy/retrieval\",
  \"version\": \"0.1.0\",
  \"main\": \"dist/index.js\",
  \"exports\": {
    \".\": \"./dist/index.js\",
    \"./query\": \"./dist/query/index.js\",
    \"./retrieval\": \"./dist/retrieval/index.js\",
    \"./reranking\": \"./dist/reranking/index.js\",
    \"./context\": \"./dist/context/index.js\"
  }
}

// packages/retrieval/src/index.ts
export { QueryProcessor } from './query';
export { hybridRetrieve, HybridRetriever } from './retrieval';
export { Reranker, createReranker } from './reranking';
export { ContextBuilder } from './context';
```

---

## Stage 1: Query Processing

**Location:** `packages/retrieval/src/query/`

```typescript
export type QueryClass = 'factual_lookup' | 'reasoning' | 'creative' | 'multi_hop';

export interface ProcessedQuery {
  original: string;
  class: QueryClass;
  hypothetical?: string; // HyDE rewriting
  keywords: string[];
}

export class QueryProcessor {
  async process(query: string, ctx: QueryContext): Promise<ProcessedQuery> {
    const class = await classifyQuery(query);

    let hypothetical: string | undefined;
    if (class === 'factual_lookup' || class === 'multi_hop') {
      // HyDE: ask model \"Write a hypothetical answer to: {query}\"
      const prompt = `Write a hypothetical answer to: \"${query}\"`;
      hypothetical = await ctx.model.complete({
        messages: [{ role: 'user', content: prompt }]
      });
    }

    const keywords = extractKeywords(query);

    return { original: query, class, hypothetical, keywords };
  }
}
```

---

## Stage 2: Hybrid Retrieval

**Location:** `packages/retrieval/src/retrieval/`

Combine sparse (BM25) + dense (vector) search:

```typescript
export async function hybridRetrieve(
  query: string,
  indexes: { sparse: BM25Index; dense: VectorIndex },
  options: {
    topK?: number;
    rrf_k?: number; // Reciprocal Rank Fusion parameter
  } = {}
): Promise<RetrievalResult[]> {
  const { topK = 10, rrf_k = 60 } = options;

  // Parallel sparse + dense
  const [sparseResults, denseResults] = await Promise.all([
    indexes.sparse.search(query, topK * 2),
    indexes.dense.search(query, topK * 2)
  ]);

  // RRF scoring
  const scores = new Map<string, number>();

  sparseResults.forEach((result, rank) => {
    const score = 1 / (rrf_k + rank);
    scores.set(result.id, (scores.get(result.id) || 0) + score);
  });

  denseResults.forEach((result, rank) => {
    const score = 1 / (rrf_k + rank);
    scores.set(result.id, (scores.get(result.id) || 0) + score);
  });

  // Merge + sort by RRF score
  const merged = [...new Set([...sparseResults, ...denseResults])].map(r => ({
    ...r,
    rrf_score: scores.get(r.id) || 0
  }));

  return merged.sort((a, b) => b.rrf_score - a.rrf_score).slice(0, topK);
}
```

---

## Stage 3: Reranking

**Location:** `packages/retrieval/src/reranking/`

```typescript
export interface Reranker {
  rerank(query: string, chunks: RetrievalResult[], topN: number): Promise<RerankedResult[]>;
}

export function createReranker(config: RerankerConfig): Reranker {
  const strategy = process.env.AGENTSY_RERANKER || 'bge';

  switch (strategy) {
    case 'cohere':
      return new CohereReranker(config);
    case 'bge':
      return new BGEReranker(config);
    case 'none':
      return new PassthroughReranker(config);
    default:
      return new PassthroughReranker(config);
  }
}

export class BGEReranker implements Reranker {
  async rerank(query: string, chunks: RetrievalResult[], topN: number): Promise<RerankedResult[]> {
    // Local ONNX-based reranking
    const scores = await this.model.rerank(
      query,
      chunks.map(c => c.text)
    );

    return chunks
      .map((chunk, i) => ({ ...chunk, rerank_score: scores[i] }))
      .sort((a, b) => b.rerank_score - a.rerank_score)
      .slice(0, topN);
  }
}

export class PassthroughReranker implements Reranker {
  async rerank(_query: string, chunks: RetrievalResult[], topN: number): Promise<RerankedResult[]> {
    return chunks.slice(0, topN).map(c => ({
      ...c,
      rerank_score: c.relevance_score || 1.0
    }));
  }
}
```

---

## Stage 4: Context Builder

**Location:** `packages/retrieval/src/context/`

```typescript
export type ContextOrdering = 'relevance' | 'recency' | 'lost-in-middle';

export class ContextBuilder {
  build(
    chunks: RerankedResult[],
    options: {
      maxTokens?: number;
      ordering?: ContextOrdering;
    } = {}
  ): {
    text: string;
    citations: CitationMap;
    tokenCount: number;
  } {
    const { maxTokens = 4000, ordering = 'lost-in-middle' } = options;

    let ordered = chunks;
    if (ordering === 'lost-in-middle') {
      // Place most relevant at start and end; less relevant in middle
      ordered = this.lostInMiddleOrder(chunks);
    } else if (ordering === 'recency') {
      ordered = chunks.sort((a, b) => b.timestamp - a.timestamp);
    }

    const segments: string[] = [];
    let tokenCount = 0;
    const citations: CitationMap = {};

    for (const chunk of ordered) {
      const segmentTokens = estimateTokens(chunk.text);
      if (tokenCount + segmentTokens > maxTokens) break;

      segments.push(`[${chunk.id}] ${chunk.text}`);
      citations[chunk.id] = {
        source: chunk.source,
        page: chunk.page,
        timestamp: chunk.timestamp
      };
      tokenCount += segmentTokens;
    }

    return {
      text: segments.join('\n\n'),
      citations,
      tokenCount
    };
  }

  private lostInMiddleOrder(chunks: RerankedResult[]): RerankedResult[] {
    // Alternate: start, end, second-from-start, second-from-end, ...
    const result: RerankedResult[] = [];
    let left = 0,
      right = chunks.length - 1;

    while (left <= right) {
      result.push(chunks[left++]);
      if (left <= right) result.push(chunks[right--]);
    }

    return result;
  }
}
```

---

## Chunking Strategies

**Location:** `packages/retrieval/src/chunking/`

```typescript
export interface ChunkingStrategy {
  chunk(document: string): Chunk[];
}

// 1. Hierarchical (default + recommended)
export class HierarchicalChunking implements ChunkingStrategy {
  chunk(document: string): Chunk[] {
    // Paragraph-level parents + sentence-level children
    const paragraphs = document.split('\n\n');
    const chunks: Chunk[] = [];

    paragraphs.forEach((para, paraIdx) => {
      const sentences = para.split(/[.!?]+\s+/);
      const parentId = `para_${paraIdx}`;

      sentences.forEach((sent, sentIdx) => {
        chunks.push({
          id: `${parentId}_sent_${sentIdx}`,
          parentId,
          text: sent.trim(),
          level: 'sentence',
          parentText: para // Context
        });
      });
    });

    return chunks;
  }
}

// 2. Fixed-size (fast, lower quality)
export class FixedChunking implements ChunkingStrategy {
  constructor(
    readonly chunkSize: number = 512,
    readonly overlap: number = 50
  ) {}

  chunk(document: string): Chunk[] {
    const chunks: Chunk[] = [];

    for (let i = 0; i < document.length; i += this.chunkSize - this.overlap) {
      const chunk = document.slice(i, i + this.chunkSize);
      chunks.push({
        id: `chunk_${chunks.length}`,
        text: chunk,
        level: 'fixed'
      });
    }

    return chunks;
  }
}

// 3. Semantic (slow, highest quality)
export class SemanticChunking implements ChunkingStrategy {
  async chunk(document: string): Promise<Chunk[]> {
    const sentences = document.split(/[.!?]+\s+/);
    const embeddings = await this.embed(sentences);

    // Cluster by similarity
    const clusters = this.clusterBySimilarity(embeddings);

    return clusters.map((cluster, idx) => ({
      id: `semantic_${idx}`,
      text: sentences.filter((_, i) => cluster.includes(i)).join('. '),
      level: 'semantic'
    }));
  }

  private clusterBySimilarity(embeddings: number[][]): number[][] {
    // Agglomerative clustering; merge if sim > threshold
    // Returns sentence indices per cluster
  }
}
```

---

## TASK-038: Integration with Memory

Wire retrieval into memory post-turn + fact extraction:

```typescript
// packages/memory/src/retrieval/rag/index.ts
export async function ingestDocument(doc: Document, rag: RagEngine, memory: MemoryEngine, ctx: { sessionId: string }) {
  // 1. Chunk + embed
  const chunks = await rag.ingest(doc);

  // 2. Store in RAG
  await rag.store({
    documentId: doc.id,
    chunks,
    metadata: doc.metadata
  });

  // 3. Extract + store in memory tiers
  const facts = extractFactsFromDoc(doc);
  for (const fact of facts) {
    await memory.capture({
      sessionId: ctx.sessionId,
      type: 'entity',
      content: fact,
      sourceDocumentId: doc.id
    });
  }
}

export async function queryRag(
  query: string,
  rag: RagEngine,
  options: { topK?: number } = {}
): Promise<{
  results: RetrievalResult[];
  citations: CitationMap;
  context: string;
}> {
  const processed = await rag.processor.process(query);
  const retrieved = await rag.retrieve(processed, options);
  const reranked = await rag.reranker.rerank(query, retrieved, options.topK || 5);
  const context = rag.contextBuilder.build(reranked);

  return { results: reranked, ...context };
}
```

---

## TASK-039: CLI Commands

```bash
/index <path>                  # Ingest document/directory
/search <query>                # Retrieve + display
/sources                       # List indexed documents

# With retrieval:
> I'd like to know about deployment
# Agent uses /search internally + cites sources
```

---

## TASK-040: Source Allowlist + Provenance

```typescript
// packages/retrieval/src/security/index.ts
export interface ProvenanceTag {
  sourceId: string;
  sourceType: 'local' | 'web' | 'memory';
  timestamp: Date;
  verified: boolean;
}

export async function ingestWithProvenance(
  source: string,
  allowlist: string[],
  rag: RagEngine
): Promise<{ chunks: Chunk[]; provenance: ProvenanceTag[] }> {
  // Verify source against allowlist
  if (!allowlist.some(pattern => matchesPattern(source, pattern))) {
    throw new SourceNotAllowedError(source);
  }

  const chunks = await rag.ingest(source);
  const provenance: ProvenanceTag[] = chunks.map(c => ({
    sourceId: source,
    sourceType: getSourceType(source),
    timestamp: new Date(),
    verified: true
  }));

  return { chunks, provenance };
}

// Redact unverified sources from output
export function redactUnverifiedSources(context: string, provenanceMap: Map<string, ProvenanceTag[]>): string {
  return context.replace(/\[(\w+)\]/g, (match, chunkId) => {
    const provenance = provenanceMap.get(chunkId);
    if (provenance?.some(p => !p.verified)) {
      return '[REDACTED:UNVERIFIED]';
    }
    return match;
  });
}
```

---

## Quality Gates

- ✅ Query classification accurate
- ✅ Hybrid retrieval deterministic
- ✅ Reranking improves ranking (A/B test)
- ✅ Context packing respects token limits
- ✅ Source allowlist enforced
- ✅ All tests pass

---

**Next phase:** `12-PHASE-9-OBSERVABILITY.md`
