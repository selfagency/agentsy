import { describe, expect, it } from 'vitest';
import type {
  Chunk,
  ChunkMetadata,
  ChunkingStrategy,
  DataSource,
  Document,
  RetrievalQuery,
  SearchResult,
} from '../src/types';

describe('retrieval/types', () => {
  describe('ChunkingStrategy', () => {
    it('should accept valid chunking strategies', () => {
      const strategies: ChunkingStrategy[] = ['semantic', 'fixed', 'ast'];
      expect(strategies).toEqual(['semantic', 'fixed', 'ast']);
    });
  });

  describe('Chunk', () => {
    it('should create a valid chunk with required fields', () => {
      const chunk: Chunk = {
        id: 'test-chunk-1',
        content: 'Test content',
        metadata: {
          source: 'test.ts',
          startLine: 1,
          endLine: 10,
          strategy: 'semantic',
        },
      };

      expect(chunk.id).toBe('test-chunk-1');
      expect(chunk.content).toBe('Test content');
      expect(chunk.metadata.strategy).toBe('semantic');
    });
  });

  describe('ChunkMetadata', () => {
    it('should create valid metadata with all fields', () => {
      const metadata: ChunkMetadata = {
        source: 'test.ts',
        startLine: 1,
        endLine: 10,
        strategy: 'semantic',
        language: 'typescript',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
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
        type: 'file',
        path: '/path/to/file.ts',
        content: 'File content',
      };

      expect(dataSource.type).toBe('file');
      expect(dataSource.path).toBe('/path/to/file.ts');
      expect(dataSource.content).toBe('File content');
    });
  });

  describe('RetrievalQuery', () => {
    it('should create valid retrieval query with defaults', () => {
      const query: RetrievalQuery = {
        query: 'test query',
      };

      expect(query.query).toBe('test query');
      expect(query.topK).toBeUndefined();
      expect(query.minSimilarity).toBeUndefined();
    });

    it('should create valid retrieval query with parameters', () => {
      const query: RetrievalQuery = {
        query: 'test query',
        topK: 10,
        minSimilarity: 0.8,
      };

      expect(query.query).toBe('test query');
      expect(query.topK).toBe(10);
      expect(query.minSimilarity).toBe(0.8);
    });
  });

  describe('Document', () => {
    it('should create valid document with required fields', () => {
      const document: Document = {
        id: 'doc-1',
        content: 'Document content',
        chunks: [],
      };

      expect(document.id).toBe('doc-1');
      expect(document.content).toBe('Document content');
      expect(document.chunks).toEqual([]);
    });

    it('should create valid document with chunks', () => {
      const chunk: Chunk = {
        id: 'chunk-1',
        content: 'Chunk content',
        metadata: {
          source: 'test.ts',
          startLine: 1,
          endLine: 5,
          strategy: 'fixed',
        },
      };

      const document: Document = {
        id: 'doc-1',
        content: 'Document content',
        chunks: [chunk],
      };

      expect(document.chunks).toHaveLength(1);
      expect(document.chunks[0].id).toBe('chunk-1');
    });
  });

  describe('SearchResult', () => {
    it('should create valid search result with defaults', () => {
      const result: SearchResult = {
        documents: [],
        total: 0,
        queryTime: 0,
      };

      expect(result.documents).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.queryTime).toBe(0);
    });

    it('should create valid search result with query time', () => {
      const document: Document = {
        id: 'doc-1',
        content: 'Content',
        chunks: [],
      };

      const result: SearchResult = {
        documents: [document],
        total: 1,
        queryTime: 100,
      };

      expect(result.documents).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.queryTime).toBe(100);
    });
  });
});
