import { describe, it, expect, beforeEach } from 'vitest';
import { RetrievalEngine } from '../src/search';
import type { RetrievalQuery, Document } from '../src/types';

describe('RetrievalEngine', () => {
  let engine: RetrievalEngine;
  let sampleDocuments: Document[];

  beforeEach(() => {
    engine = new RetrievalEngine();

    sampleDocuments = [
      {
        id: 'doc-1',
        content: 'JavaScript is a versatile programming language used for web development.',
        chunks: [
          {
            id: 'chunk-1',
            content: 'JavaScript is a versatile programming language',
            metadata: { source: 'doc-1', startLine: 1, endLine: 5, strategy: 'semantic' }
          },
          {
            id: 'chunk-2',
            content: 'used for web development',
            metadata: { source: 'doc-1', startLine: 6, endLine: 10, strategy: 'semantic' }
          }
        ]
      },
      {
        id: 'doc-2',
        content: 'Python is popular for data science and machine learning applications.',
        chunks: [
          {
            id: 'chunk-3',
            content: 'Python is popular for data science',
            metadata: { source: 'doc-2', startLine: 1, endLine: 5, strategy: 'semantic' }
          },
          {
            id: 'chunk-4',
            content: 'and machine learning applications',
            metadata: { source: 'doc-2', startLine: 6, endLine: 10, strategy: 'semantic' }
          }
        ]
      },
      {
        id: 'doc-3',
        content: 'TypeScript adds static typing to JavaScript for better tooling.',
        chunks: [
          {
            id: 'chunk-5',
            content: 'TypeScript adds static typing to JavaScript',
            metadata: { source: 'doc-3', startLine: 1, endLine: 5, strategy: 'semantic' }
          },
          {
            id: 'chunk-6',
            content: 'for better tooling',
            metadata: { source: 'doc-3', startLine: 6, endLine: 10, strategy: 'semantic' }
          }
        ]
      }
    ];
  });

  describe('constructor', () => {
    it('should create engine with default options', () => {
      const defaultEngine = new RetrievalEngine();
      expect(defaultEngine).toBeInstanceOf(RetrievalEngine);
    });

    it('should create engine with custom options', () => {
      const customEngine = new RetrievalEngine({
        topK: 20,
        minSimilarity: 0.75
      });

      expect(customEngine).toBeInstanceOf(RetrievalEngine);
    });
  });

  describe('index', () => {
    it('should index documents successfully', async () => {
      await engine.index(sampleDocuments);

      expect(await engine.hasDoc('doc-1')).toBe(true);
      expect(await engine.hasDoc('doc-2')).toBe(true);
      expect(await engine.hasDoc('doc-3')).toBe(true);
    });

    it('should return number of indexed documents', async () => {
      await engine.index(sampleDocuments);
      const count = await engine.count();

      expect(count).toBe(sampleDocuments.length);
    });

    it('should handle empty document list', async () => {
      await engine.index([]);
      const count = await engine.count();

      expect(count).toBe(0);
    });
  });

  describe('keywordSearch', () => {
    beforeEach(async () => {
      await engine.index(sampleDocuments);
    });

    it('should search documents by keyword', async () => {
      const query: RetrievalQuery = {
        query: 'JavaScript'
      };

      const result = await engine.keywordSearch(query);

      expect(result.documents).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
    });

    it('should return documents matching search query', async () => {
      const query: RetrievalQuery = {
        query: 'Python'
      };

      const result = await engine.keywordSearch(query);

      expect(result.documents.length).toBeGreaterThan(0);
      expect(result.documents[0].content).toContain('Python');
    });

    it('should respect topK parameter', async () => {
      const query: RetrievalQuery = {
        query: 'language',
        topK: 1
      };

      const result = await engine.keywordSearch(query);

      expect(result.documents.length).toBeLessThanOrEqual(1);
    });

    it('should return empty results for non-existent query', async () => {
      const query: RetrievalQuery = {
        query: 'nonexistentterm12345'
      };

      const result = await engine.keywordSearch(query);

      expect(result.documents).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should include query time in results', async () => {
      const query: RetrievalQuery = {
        query: 'development'
      };

      const result = await engine.keywordSearch(query);

      expect(result.queryTime).toBeDefined();
      expect(result.queryTime).toBeGreaterThanOrEqual(0);
    });

    it('should sort results by relevance', async () => {
      const query: RetrievalQuery = {
        query: 'JavaScript'
      };

      const result = await engine.keywordSearch(query);

      for (let i = 0; i < result.documents.length - 1; i++) {
        expect(result.documents[i]?.score).toBeDefined();
        expect(result.documents[i + 1]?.score).toBeDefined();
        expect(result.documents[i]?.score).toBeGreaterThanOrEqual(result.documents[i + 1]?.score);
      }
    });
  });

  describe('vectorSearch', () => {
    beforeEach(async () => {
      await engine.index(sampleDocuments);
    });

    it('should perform vector search when embeddings provided', async () => {
      const query: RetrievalQuery = {
        query: 'programming language',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5]
      };

      const result = await engine.vectorSearch(query);

      expect(result.documents).toBeDefined();
    });

    it('should filter by minimum similarity threshold', async () => {
      const query: RetrievalQuery = {
        query: 'test query',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        minSimilarity: 0.9
      };

      const result = await engine.vectorSearch(query);

      result.documents.forEach(doc => {
        expect(doc.similarity).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should return results with similarity scores', async () => {
      const query: RetrievalQuery = {
        query: 'development',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5]
      };

      const result = await engine.vectorSearch(query);

      result.documents.forEach(doc => {
        expect(doc.similarity).toBeDefined();
        expect(doc.similarity).toBeGreaterThanOrEqual(0);
        expect(doc.similarity).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('search with hybrid approach', () => {
    beforeEach(async () => {
      await engine.index(sampleDocuments);
    });

    it('should combine keyword and vector search results', async () => {
      const query: RetrievalQuery = {
        query: 'JavaScript code',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5]
      };

      const result = await engine.search(query);

      expect(result.documents).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should return query time for hybrid search', async () => {
      const query: RetrievalQuery = {
        query: 'data science',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5]
      };

      const result = await engine.search(query);

      expect(result.queryTime).toBeDefined();
      expect(result.queryTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await engine.index(sampleDocuments);
    });

    it('should remove indexed document', async () => {
      await engine.delete('doc-1');

      expect(await engine.hasDoc('doc-1')).toBe(false);
      expect(await engine.hasDoc('doc-2')).toBe(true);
    });

    it('should handle deletion of non-existent document', async () => {
      await expect(engine.delete('non-existent')).resolves.not.toThrow();
    });

    it('should update document count after deletion', async () => {
      const initialCount = await engine.count();
      await engine.delete('doc-1');
      const finalCount = await engine.count();

      expect(finalCount).toBe(initialCount - 1);
    });
  });

  describe('clear', () => {
    it('should remove all indexed documents', async () => {
      await engine.index(sampleDocuments);
      expect(await engine.count()).toBe(sampleDocuments.length);

      await engine.clear();

      expect(await engine.count()).toBe(0);
    });
  });
});
