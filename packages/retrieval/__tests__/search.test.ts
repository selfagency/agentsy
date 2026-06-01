import { beforeEach, describe, expect, it } from 'vitest';

import { RetrievalEngine } from '../src/search';
import type { Document, RetrievalQuery } from '../src/types';

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
    it('should index documents successfully', () => {
      engine.index(sampleDocuments);

      expect(engine.hasDoc('doc-1')).toBeTruthy();
      expect(engine.hasDoc('doc-2')).toBeTruthy();
      expect(engine.hasDoc('doc-3')).toBeTruthy();
    });

    it('should return number of indexed documents', () => {
      engine.index(sampleDocuments);
      const count = engine.count();

      expect(count).toBe(sampleDocuments.length);
    });

    it('should handle empty document list', () => {
      engine.index([]);
      const count = engine.count();

      expect(count).toBe(0);
    });
  });

  describe('keywordSearch', () => {
    beforeEach(() => {
      engine.index(sampleDocuments);
    });

    it('should search documents by keyword', () => {
      const query: RetrievalQuery = {
        query: 'JavaScript'
      };

      const result = engine.keywordSearch(query);

      expect(result.documents).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
    });

    it('should return documents matching search query', () => {
      const query: RetrievalQuery = {
        query: 'Python'
      };

      const result = engine.keywordSearch(query);

      expect(result.documents.length).toBeGreaterThan(0);
      expect(result.documents[0].content).toContain('Python');
    });

    it('should respect topK parameter', () => {
      const query: RetrievalQuery = {
        query: 'language',
        topK: 1
      };

      const result = engine.keywordSearch(query);

      expect(result.documents.length).toBeLessThanOrEqual(1);
    });

    it('should return empty results for non-existent query', () => {
      const query: RetrievalQuery = {
        query: 'nonexistentterm12345'
      };

      const result = engine.keywordSearch(query);

      expect(result.documents).toStrictEqual([]);
      expect(result.total).toBe(0);
    });

    it('should include query time in results', () => {
      const query: RetrievalQuery = {
        query: 'development'
      };

      const result = engine.keywordSearch(query);

      expect(result.queryTime).toBeDefined();
      expect(result.queryTime).toBeGreaterThanOrEqual(0);
    });

    it('should sort results by relevance', () => {
      const query: RetrievalQuery = {
        query: 'JavaScript'
      };

      const result = engine.keywordSearch(query);

      for (let i = 0; i < result.documents.length - 1; i++) {
        expect(result.documents[i]?.score ?? 0).toBeDefined();
        expect(result.documents[i + 1]?.score ?? 0).toBeDefined();
        expect(result.documents[i]?.score ?? 0).toBeGreaterThanOrEqual(result.documents[i + 1]?.score ?? 0);
      }
    });
  });

  describe('vectorSearch', () => {
    beforeEach(() => {
      engine.index(sampleDocuments);
    });

    it('should perform vector search when embeddings provided', () => {
      const query: RetrievalQuery = {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        query: 'programming language'
      };

      const result = engine.vectorSearch(query);

      expect(result.documents).toBeDefined();
    });

    it('should filter by minimum similarity threshold', () => {
      const query: RetrievalQuery = {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        minSimilarity: 0.9,
        query: 'test query'
      };

      const result = engine.vectorSearch(query);

      for (const doc of result.documents) {
        expect(doc.similarity).toBeGreaterThanOrEqual(0.9);
      }
    });

    it('should return results with similarity scores', () => {
      const query: RetrievalQuery = {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        query: 'development'
      };

      const result = engine.vectorSearch(query);

      for (const doc of result.documents) {
        expect(doc.similarity).toBeDefined();
        expect(doc.similarity).toBeGreaterThanOrEqual(0);
        expect(doc.similarity).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('search with hybrid approach', () => {
    beforeEach(() => {
      engine.index(sampleDocuments);
    });

    it('should combine keyword and vector search results', () => {
      const query: RetrievalQuery = {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        query: 'JavaScript code'
      };

      const result = engine.search(query);

      expect(result.documents).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should return query time for hybrid search', () => {
      const query: RetrievalQuery = {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        query: 'data science'
      };

      const result = engine.search(query);

      expect(result.queryTime).toBeDefined();
      expect(result.queryTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      engine.index(sampleDocuments);
    });

    it('should remove indexed document', () => {
      engine.delete('doc-1');

      expect(engine.hasDoc('doc-1')).toBeFalsy();
      expect(engine.hasDoc('doc-2')).toBeTruthy();
    });

    it('should handle deletion of non-existent document', () => {
      expect(() => {
        engine.delete('non-existent');
      }).not.toThrow();
    });

    it('should update document count after deletion', () => {
      const initialCount = engine.count();
      engine.delete('doc-1');
      const finalCount = engine.count();

      expect(finalCount).toBe(initialCount - 1);
    });
  });

  describe('clear', () => {
    it('should remove all indexed documents', () => {
      engine.index(sampleDocuments);
      expect(engine.count()).toBe(sampleDocuments.length);

      engine.clear();

      expect(engine.count()).toBe(0);
    });
  });
});
