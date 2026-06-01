import { describe, expect, it } from 'vitest';

import type {
  Chunk,
  ChunkingStrategy,
  ChunkMetadata,
  DataSource,
  Document,
  RetrievalQuery,
  SearchResult
} from '../src/types';

describe('retrieval/types', () => {
  describe('ChunkingStrategy', () => {
    it('should accept valid chunking strategies', () => {
      const strategies: ChunkingStrategy[] = ['semantic', 'fixed', 'ast'];
      expect(strategies).toStrictEqual(['semantic', 'fixed', 'ast']);
    });
  });

  describe('Chunk', () => {
    it('should create a valid chunk with required fields', () => {
      const chunk: Chunk = {
        content: 'Test content',
        id: 'test-chunk-1',
        metadata: {
          endLine: 10,
          source: 'test.ts',
          startLine: 1,
          strategy: 'semantic'
        }
      };

      expect(chunk.id).toBe('test-chunk-1');
      expect(chunk.content).toBe('Test content');
      expect(chunk.metadata.strategy).toBe('semantic');
    });
  });

  describe('ChunkMetadata', () => {
    it('should create valid metadata with all fields', () => {
      const metadata: ChunkMetadata = {
        createdAt: new Date('2024-01-01'),
        endLine: 10,
        language: 'typescript',
        source: 'test.ts',
        startLine: 1,
        strategy: 'semantic',
        updatedAt: new Date('2024-01-02')
      };

      expect(metadata.source).toBe('test.ts');
      expect(metadata.startLine).toBe(1);
      expect(metadata.endLine).toBe(10);
      expect(metadata.strategy).toBe('semantic');
    });
  });

  describe('DataSource', () => {
    it('should create valid file data source', () => {
      const dataSource: DataSource = {
        content: 'File content',
        path: '/path/to/file.ts',
        type: 'file'
      };

      expect(dataSource.type).toBe('file');
      expect(dataSource.path).toBe('/path/to/file.ts');
      expect(dataSource.content).toBe('File content');
    });
  });

  describe('RetrievalQuery', () => {
    it('should create valid retrieval query with defaults', () => {
      const query: RetrievalQuery = {
        query: 'test query'
      };

      expect(query.query).toBe('test query');
      expect(query.topK).toBeUndefined();
      expect(query.minSimilarity).toBeUndefined();
    });

    it('should create valid retrieval query with parameters', () => {
      const query: RetrievalQuery = {
        minSimilarity: 0.8,
        query: 'test query',
        topK: 10
      };

      expect(query.query).toBe('test query');
      expect(query.topK).toBe(10);
      expect(query.minSimilarity).toBe(0.8);
    });
  });

  describe('Document', () => {
    it('should create valid document with required fields', () => {
      const document: Document = {
        chunks: [],
        content: 'Document content',
        id: 'doc-1'
      };

      expect(document.id).toBe('doc-1');
      expect(document.content).toBe('Document content');
      expect(document.chunks).toStrictEqual([]);
    });

    it('should create valid document with chunks', () => {
      const chunk: Chunk = {
        content: 'Chunk content',
        id: 'chunk-1',
        metadata: {
          endLine: 5,
          source: 'test.ts',
          startLine: 1,
          strategy: 'fixed'
        }
      };

      const document: Document = {
        chunks: [chunk],
        content: 'Document content',
        id: 'doc-1'
      };

      expect(document.chunks).toHaveLength(1);
      expect(document.chunks[0].id).toBe('chunk-1');
    });
  });

  describe('SearchResult', () => {
    it('should create valid search result with defaults', () => {
      const result: SearchResult = {
        documents: [],
        queryTime: 0,
        total: 0
      };

      expect(result.documents).toStrictEqual([]);
      expect(result.total).toBe(0);
      expect(result.queryTime).toBe(0);
    });

    it('should create valid search result with query time', () => {
      const document: Document = {
        chunks: [],
        content: 'Content',
        id: 'doc-1'
      };

      const result: SearchResult = {
        documents: [document],
        queryTime: 100,
        total: 1
      };

      expect(result.documents).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.queryTime).toBe(100);
    });
  });
});
