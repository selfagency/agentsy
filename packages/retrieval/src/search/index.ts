import type { Document, RetrievalQuery, SearchResult } from '../types.js';

export interface RetrievalEngineOptions {
  topK?: number;
  minSimilarity?: number;
}

export class RetrievalEngine {
  private readonly documents: Map<string, Document>;
  private readonly embeddings: Map<string, number[]>;
  private readonly options: RetrievalEngineOptions;

  constructor(options: RetrievalEngineOptions = {}) {
    this.documents = new Map();
    this.embeddings = new Map();
    this.options = {
      topK: options.topK ?? 10,
      minSimilarity: options.minSimilarity ?? 0.7,
    };
  }

  async index(documents: Document[]): Promise<void> {
    for (const document of documents) {
      this.documents.set(document.id, document);

      for (const chunk of document.chunks) {
        const embedding = await this.generateEmbedding(chunk.content);
        this.embeddings.set(chunk.id, embedding);
      }
    }
  }

  async keywordSearch(query: RetrievalQuery): Promise<SearchResult> {
    const startTime = Date.now();
    const topK = query.topK ?? this.options.topK;

    const results: Array<{ document: Document; score: number }> = [];

    for (const doc of this.documents.values()) {
      const docSearchResults = this.searchWithinDocument(query.query, doc);
      results.push(...docSearchResults);
    }

    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, topK);

    const queryTime = Date.now() - startTime;

    return {
      documents: topResults.map(r => this.toSearchResultDocument(r.document, r.score)),
      total: topResults.length,
      queryTime,
    };
  }

  async vectorSearch(query: RetrievalQuery): Promise<SearchResult> {
    if (!query.embedding) {
      return { documents: [], total: 0, queryTime: 0 };
    }

    const startTime = Date.now();
    const topK = query.topK ?? this.options.topK;
    const minSimilarity = query.minSimilarity ?? this.options.minSimilarity;

    const results: Array<{ document: Document; similarity: number }> = [];

    for (const doc of this.documents.values()) {
      for (const chunk of doc.chunks) {
        const chunkEmbedding = this.embeddings.get(chunk.id);

        if (chunkEmbedding) {
          const similarity = this.calculateCosineSimilarity(query.embedding, chunkEmbedding);
          const threshold = minSimilarity ?? 0;

          if (similarity >= threshold) {
            results.push({
              document: doc,
              similarity,
            });
          }
        }
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    const uniqueResults = this.deduplicateResults(results);
    const topResults = uniqueResults.slice(0, topK);

    const queryTime = Date.now() - startTime;

    return {
      documents: topResults.map(r => this.toSearchResultDocument(r.document, r.similarity)),
      total: topResults.length,
      queryTime,
    };
  }

  async search(query: RetrievalQuery): Promise<SearchResult> {
    const startTime = Date.now();
    const keywordResult = await this.keywordSearch(query);

    if (!query.embedding) {
      const totalTime = Date.now() - startTime;
      return {
        documents: keywordResult.documents,
        total: keywordResult.total,
        queryTime: totalTime,
      };
    }

    const vectorResult = await this.vectorSearch(query);

    const results = new Map<string, { document: Document; keywordScore: number; vectorScore: number }>();

    for (const doc of keywordResult.documents) {
      const storedDocument = this.documents.get(doc.id);
      if (!storedDocument) {
        continue;
      }

      results.set(doc.id, {
        document: storedDocument,
        keywordScore: doc.score || 0,
        vectorScore: 0,
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
        keywordScore: existing?.keywordScore || 0,
        vectorScore: doc.similarity || 0,
      });
    }

    const combinedResults = Array.from(results.values())
      .map(r => ({
        document: r.document,
        score: r.keywordScore * 0.3 + r.vectorScore * 0.7,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, query.topK ?? 10);

    const queryTime = Date.now() - startTime;

    return {
      documents: combinedResults.map(r => this.toSearchResultDocument(r.document, r.score)),
      total: combinedResults.length,
      queryTime,
    };
  }

  async delete(docId: string): Promise<void> {
    const doc = this.documents.get(docId);
    if (doc) {
      for (const chunk of doc.chunks) {
        this.embeddings.delete(chunk.id);
      }
      this.documents.delete(docId);
    }
  }

  async clear(): Promise<void> {
    this.documents.clear();
    this.embeddings.clear();
  }

  async hasDoc(docId: string): Promise<boolean> {
    return this.documents.has(docId);
  }

  async count(): Promise<number> {
    return this.documents.size;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = Array.from({ length: 32 }).fill(0) as number[];

    for (const word of words) {
      const wordHash = this.hashWord(word);
      const index = wordHash % embedding.length;
      embedding[index] = (embedding[index] ?? 0) + 1;
    }

    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));

    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }

    return embedding;
  }

  private hashWord(word: string): number {
    let hash = 0;
    for (const char of word) {
      hash = (hash << 5) - hash + (char.codePointAt(0) || 0);
      hash = hash & hash;
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

  private searchWithinDocument(query: string, document: Document): Array<{ document: Document; score: number }> {
    const results: Array<{ document: Document; score: number }> = [];
    const queryLower = query.toLowerCase();

    for (const chunk of document.chunks) {
      const contentLower = chunk.content.toLowerCase();
      let score = 0;

      if (contentLower.includes(queryLower)) {
        score += this.calculateKeywordMatch(query, contentLower);
      }

      for (const word of queryLower.split(/\s+/)) {
        if (contentLower.includes(word)) {
          score += 0.1;
        }
      }

      if (score > 0) {
        results.push({
          document,
          score,
        });
      }
    }

    return results;
  }

  private calculateKeywordMatch(query: string, content: string): number {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    const exactMatch = contentLower.includes(queryLower);
    const wordMatches = queryLower.split(/\s+/).filter(word => contentLower.includes(word)).length;

    if (exactMatch) {
      return 1;
    }

    return wordMatches / Math.max(queryLower.split(/\s+/).length, 1);
  }

  private deduplicateResults(
    results: Array<{ document: Document; similarity: number }>,
  ): Array<{ document: Document; similarity: number }> {
    const seen = new Set<string>();
    const unique: Array<{ document: Document; similarity: number }> = [];

    for (const result of results) {
      if (!seen.has(result.document.id)) {
        seen.add(result.document.id);
        unique.push(result);
      }
    }

    return unique;
  }

  private toSearchResultDocument(document: Document, score: number): SearchResult['documents'][number] {
    const firstChunk = document.chunks[0];
    const result: SearchResult['documents'][number] = {
      id: document.id,
      content: document.content,
      score,
      similarity: score,
    };

    if (firstChunk?.id) {
      result.chunkId = firstChunk.id;
    }

    return result;
  }
}
