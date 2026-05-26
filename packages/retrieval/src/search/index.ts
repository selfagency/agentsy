import type { Document, RetrievalQuery, SearchResult } from '../types.js';

export interface RetrievalEngineOptions {
  minSimilarity?: number;
  topK?: number;
}

export class RetrievalEngine {
  private readonly documents: Map<string, Document>;
  private readonly embeddings: Map<string, number[]>;
  private readonly options: RetrievalEngineOptions;

  constructor(options: RetrievalEngineOptions = {}) {
    this.documents = new Map();
    this.embeddings = new Map();
    this.options = {
      minSimilarity: options.minSimilarity ?? 0.7,
      topK: options.topK ?? 10
    };
  }

  async index(documents: Document[]): Promise<void> {
    for (const document of documents) {
      this.documents.set(document.id, document);

      for (const chunk of document.chunks) {
        const embedding = this.generateEmbedding(chunk.content);
        this.embeddings.set(chunk.id, embedding);
      }
    }
  }

  keywordSearch(query: RetrievalQuery): SearchResult {
    const startTime = Date.now();
    const results: { document: Document; score: number }[] = [];
    const queryLower = query.query.toLowerCase();
    const queryWords = queryLower.split(/\s+/u);

    for (const [, document] of this.documents) {
      for (const chunk of document.chunks) {
        const contentLower = chunk.content.toLowerCase();
        let score = 0;

        for (const word of queryWords) {
          if (contentLower.includes(word)) {
            score += 0.1;
          }
        }

        if (score > 0) {
          results.push({
            document,
            score
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);

    const queryTime = Date.now() - startTime;

    return {
      documents: results.slice(0, query.topK ?? 10).map(r => this.toSearchResultDocument(r.document, r.score)),
      queryTime,
      total: results.length
    };
  }

  vectorSearch(query: RetrievalQuery): SearchResult {
    const startTime = Date.now();
    const results: { document: Document; similarity: number }[] = [];

    if (!query.embedding || query.embedding.length === 0) {
      return {
        documents: [],
        queryTime: Date.now() - startTime,
        total: 0
      };
    }

    for (const [, document] of this.documents) {
      for (const chunk of document.chunks) {
        const chunkEmbedding = this.embeddings.get(chunk.id);
        if (chunkEmbedding) {
          const similarity = this.calculateCosineSimilarity(query.embedding, chunkEmbedding);

          const minSimilarity = query.minSimilarity ?? this.options.minSimilarity ?? 0.7;
          if (similarity >= minSimilarity) {
            results.push({
              document,
              similarity
            });
          }
        }
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    const queryTime = Date.now() - startTime;

    return {
      documents: results.slice(0, query.topK ?? 10).map(r => this.toSearchResultDocument(r.document, r.similarity)),
      queryTime,
      total: results.length
    };
  }

  async hasDoc(docId: string): Promise<boolean> {
    return this.documents.has(docId);
  }

  search(query: RetrievalQuery): SearchResult {
    const startTime = Date.now();
    const keywordResult = this.keywordSearch(query);
    const vectorResult = this.vectorSearch(query);

    const results = new Map<string, { document: Document; keywordScore: number; vectorScore: number }>();

    for (const doc of keywordResult.documents) {
      const storedDocument = this.documents.get(doc.id);
      if (!storedDocument) {
        continue;
      }

      results.set(doc.id, {
        document: storedDocument,
        keywordScore: doc.score ?? 0,
        vectorScore: 0
      });
    }

    for (const doc of vectorResult.documents) {
      const storedDocument = this.documents.get(doc.id);
      if (!storedDocument) {
        continue;
      }

      const existing = results.get(doc.id);
      results.set(doc.id, {
        document: storedDocument,
        keywordScore: existing?.keywordScore ?? 0,
        vectorScore: doc.similarity ?? 0
      });
    }

    const combinedResults = [...results.values()]
      .map(r => ({
        document: r.document,
        score: r.keywordScore * 0.3 + r.vectorScore * 0.7
      }))
      .toSorted((a, b) => b.score - a.score)
      .slice(0, query.topK ?? 10);

    const queryTime = Date.now() - startTime;

    return {
      documents: combinedResults.map(r => this.toSearchResultDocument(r.document, r.score)),
      queryTime,
      total: combinedResults.length
    };
  }

  delete(docId: string): void {
    const doc = this.documents.get(docId);
    if (doc) {
      for (const chunk of doc.chunks) {
        this.embeddings.delete(chunk.id);
      }
      this.documents.delete(docId);
    }
  }

  clear(): void {
    this.documents.clear();
    this.embeddings.clear();
  }

  count(): number {
    return this.documents.size;
  }

  private generateEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/u);
    const embedding = Array.from({ length: 32 }, () => 0);

    for (const word of words) {
      const wordHash = this.hashWord(word);
      const index = wordHash % embedding.length;
      embedding[index] = (embedding[index] ?? 0) + 1;
    }

    const magnitude = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));

    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }

    return embedding;
  }

  private hashWord(word: string): number {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      const charCode = word.codePointAt(i) ?? 0;
      hash = Math.floor(hash * 31 + charCode);
    }
    return Math.abs(hash);
  }

  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < Math.min(vecA.length, vecB.length); i++) {
      const a = vecA[i] ?? 0;
      const b = vecB[i] ?? 0;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  private toSearchResultDocument(document: Document, score: number): SearchResult['documents'][number] {
    const [firstChunk] = document.chunks;
    const result: SearchResult['documents'][number] = {
      content: document.content,
      id: document.id,
      score,
      similarity: score
    };

    if (firstChunk?.id) {
      result.chunkId = firstChunk.id;
    }

    return result;
  }
}
