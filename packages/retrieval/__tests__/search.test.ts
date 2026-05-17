import { describe, it, expect, beforeEach } from 'vitest';

import { RetrievalEngine } from '../src/search';
import type { RetrievalQuery, Document } from '../src/types';

describe(RetrievalEngine, () => {
  let engine: RetrievalEngine;
  let sampleDocuments: Document[];

  beforeEach(() => {
    engine = new RetrievalEngine();

    sampleDocuments = [
      {
        chunks: [
          {
            content: 'JavaScript is a versatile programming language',
            id: 'chunk-1',
            metadata: {
              endLine: 5,
              source: 'doc-1',
              startLine: 1,
              strategy: 'semantic'
            }
          },
          {
            content: 'used for web development',
            id: 'chunk-2',
            metadata: {
              endLine: 10,
              source: 'doc-1',
              startLine: 6,
              strategy: 'semantic'
            }
          }
        ],
        content: 'JavaScript is a versatile programming language used for web development.',
        id: 'doc-1'
      },
      {
        chunks: [
          {
            content: 'Python is popular for data science',
            id: 'chunk-3',
            metadata: {
              endLine: 5,
              source: 'doc-2',
              startLine: 1,
              strategy: 'semantic'
            }
          },
          {
            content: 'and machine learning applications',
            id: 'chunk-4',
            metadata: {
              endLine: 10,
              source: 'doc-2',
              startLine: 6,
              strategy: 'semantic'
            }
          }
        ],
        content: 'Python is popular for data science and machine learning applications.',
        id: 'doc-2'
      },
      {
        chunks: [
          {
            content: 'TypeScript adds static typing to JavaScript',
            id: 'chunk-5',
            metadata: {
              endLine: 5,
              source: 'doc-3',
              startLine: 1,
              strategy: 'semantic'
            }
          },
          {
            content: 'for better tooling',
            id: 'chunk-6',
            metadata: {
              endLine: 10,
              source: 'doc-3',
              startLine: 6,
              strategy: 'semantic'
            }
          }
        ],
        content: 'TypeScript adds static typing to JavaScript for better tooling.',
        id: 'doc-3'
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
        minSimilarity: 0.75,
        topK: 20
      });

      expect(customEngine).toBeInstanceOf(RetrievalEngine);
    });
  });

  describe('index', () => {
    it('should index documents successfully', async () => {
      await engine.index(sampleDocuments);

      await expect(engine.hasDoc('doc-1')).resolves.toBeTruthy();
      await expect(engine.hasDoc('doc-2')).resolves.toBeTruthy();
      await expect(engine.hasDoc('doc-3')).resolves.toBeTruthy();
    });

    it('should return number of indexed documents', async () => {
      await engine.index(sampleDocuments);
      const count = engine.count();

      expect(count).toBe(sampleDocuments.length);
    });

    it('should handle empty document list', async () => {
      await engine.index([]);
      const count = engine.count();

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

      const result = engine.keywordSearch(query);

      expect(result.documents).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
    });

    it('should return documents matching search query', async () => {
      const query: RetrievalQuery = {
        query: 'Python'
      };

      const result = engine.keywordSearch(query);

      expect(result.documents.length).toBeGreaterThan(0);
      expect(result.documents[0].content).toContain('Python');
    });

    it('should respect topK parameter', async () => {
      const query: RetrievalQuery = {
        query: 'language',
        topK: 1
      };

      const result = engine.keywordSearch(query);

      expect(result.documents.length).toBeLessThanOrEqual(1);
    });

    it('should return empty results for non-existent query', async () => {
      const query: RetrievalQuery = {
        query: 'nonexistentterm12345'
      };

      const result = engine.keywordSearch(query);

      expect(result.documents).toStrictEqual([]);
      expect(result.total).toBe(0);
    });

    it('should include query time in results', async () => {
      const query: RetrievalQuery = {
        query: 'development'
      };

      const result = engine.keywordSearch(query);

      expect(result.queryTime).toBeDefined();
      expect(result.queryTime).toBeGreaterThanOrEqual(0);
    });

    it('should sort results by relevance', async () => {
      const query: RetrievalQuery = {
        query: 'JavaScript'
      };

      const result = engine.keywordSearch(query);

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
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        query: 'programming language'
      };

      const result = engine.vectorSearch(query);

      expect(result.documents).toBeDefined();
    });

    it('should filter by minimum similarity threshold', async () => {
      const query: RetrievalQuery = {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        minSimilarity: 0.9,
        query: 'test query'
      };

      const result = engine.vectorSearch(query);

      result.documents.forEach(doc => {
        expect(doc.similarity).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should return results with similarity scores', async () => {
      const query: RetrievalQuery = {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        query: 'development'
      };

      const result = engine.vectorSearch(query);

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
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        query: 'JavaScript code'
      };

      const result = await engine.search(query);

      expect(result.documents).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should return query time for hybrid search', async () => {
      const query: RetrievalQuery = {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        query: 'data science'
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
      engine.delete('doc-1');

      await expect(engine.hasDoc('doc-1')).resolves.toBeFalsy();
      await expect(engine.hasDoc('doc-2')).resolves.toBeTruthy();
    });

    it('should handle deletion of non-existent document', () => {
      expect(() => {
        engine.delete('non-existent');
      }).not.toThrow();
    });

    it('should update document count after deletion', async () => {
      const initialCount = engine.count();
      engine.delete('doc-1');
      const finalCount = engine.count();

      expect(finalCount).toBe(initialCount - 1);
    });
  });

  describe('clear', () => {
    it('should remove all indexed documents', async () => {
      await engine.index(sampleDocuments);
      await expect(engine.count()).resolves.toBe(sampleDocuments.length);

      engine.clear();

      await expect(engine.count()).resolves.toBe(0);
    });
  });
});
