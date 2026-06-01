import { describe, expect, expectTypeOf, it } from 'vitest';
import type { RetrievalQuery } from '../src/index';
import {
  _Chunk,
  _ChunkMetadata,
  _DataSource,
  _Document,
  _RetrievalQuery,
  _SearchResult,
  ChunkingStrategy,
  IndexingPipeline,
  RetrievalEngine
} from '../src/index';

function parseChunkingStrategy(
  strategy: (typeof ChunkingStrategy)[keyof typeof ChunkingStrategy]
): (typeof ChunkingStrategy)[keyof typeof ChunkingStrategy] {
  return strategy;
}

describe('retrieval/export-contracts', () => {
  describe('public API exports', () => {
    it('should export IndexingPipeline', () => {
      expect(IndexingPipeline).toBeDefined();
      expectTypeOf(IndexingPipeline).toBeObject();
    });

    it('should export RetrievalEngine', () => {
      expect(RetrievalEngine).toBeDefined();
      expectTypeOf(RetrievalEngine).toBeObject();
    });

    it('should export ChunkingStrategy type via const enum object', () => {
      expect(ChunkingStrategy).toBeDefined();
      expect(ChunkingStrategy.SEMANTIC).toBe('semantic');
      expect(ChunkingStrategy.FIXED).toBe('fixed');
      expect(ChunkingStrategy.AST).toBe('ast');
    });

    it('should export ChunkingStrategy type via type', () => {
      expect(ChunkingStrategy).toBeDefined();
      type ChunkingStrategyType = typeof ChunkingStrategy;
      const strategy: ChunkingStrategyType = 'semantic';
      expect(strategy).toBe('semantic');
    });

    it('should export ChunkingStrategy type via type', () => {
      expect(ChunkingStrategy).toBeDefined();
      type ChunkingStrategyType = typeof ChunkingStrategy;
      const chunkingStrategy: ChunkingStrategyType = parseChunkingStrategy('semantic');
      expect(chunkingStrategy).toBe('semantic');
    });

    describe('type exports', () => {
      it('should export Chunk type', () => {
        expect(_Chunk).toBeDefined();
      });

      it('should export ChunkMetadata type', () => {
        expect(_ChunkMetadata).toBeDefined();
      });

      it('should export DataSource type', () => {
        expect(_DataSource).toBeDefined();
      });

      it('should export RetrievalQuery type', () => {
        expect(_RetrievalQuery).toBeDefined();
      });

      it('should export Document type', () => {
        expect(_Document).toBeDefined();
      });

      it('should export SearchResult type', () => {
        expect(_SearchResult).toBeDefined();
      });
    });

    it('should export ChunkingStrategy type via type', () => {
      expect(ChunkingStrategy).toBeDefined();
      type ChunkingStrategyType = typeof ChunkingStrategy;
      const strategy: ChunkingStrategyType = 'semantic';
      expect(strategy).toBe('semantic');
    });

    describe('IndexingPipeline API contract', () => {
      it('should instantiate IndexingPipeline without options', () => {
        const pipeline = new IndexingPipeline();
        expect(pipeline).toBeInstanceOf(IndexingPipeline);
      });

      it('should instantiate IndexingPipeline with options', () => {
        const pipeline = new IndexingPipeline({
          chunkOverlap: 20,
          chunkSize: 100
        });
        expect(pipeline).toBeInstanceOf(IndexingPipeline);
      });

      it('should have chunk method', () => {
        const pipeline = new IndexingPipeline();
        expectTypeOf(pipeline.chunk).toBeFunction();
      });

      it('should have semanticChunk method', () => {
        const pipeline = new IndexingPipeline();
        expectTypeOf(pipeline.semanticChunk).toBeFunction();
      });

      it('should have fixedSizeChunk method', () => {
        const pipeline = new IndexingPipeline();
        expectTypeOf(pipeline.fixedSizeChunk).toBeFunction();
      });

      it('should have astChunk method', () => {
        const pipeline = new IndexingPipeline();
        expectTypeOf(pipeline.astChunk).toBeFunction();
      });

      it('should have index method', () => {
        const pipeline = new IndexingPipeline();
        expectTypeOf(pipeline.index).toBeFunction();
      });
    });

    describe('RetrievalEngine API contract', () => {
      it('should instantiate RetrievalEngine without options', () => {
        const engine = new RetrievalEngine();
        expect(engine).toBeInstanceOf(RetrievalEngine);
      });

      it('should instantiate RetrievalEngine with options', () => {
        const engine = new RetrievalEngine({
          minSimilarity: 0.8,
          topK: 10
        });
        expect(engine).toBeInstanceOf(RetrievalEngine);
      });
    });
  });

  describe('RetrievalEngine methods', () => {
    it('should have index method', () => {
      const engine = new RetrievalEngine();
      expectTypeOf(engine.index).toBeFunction();
    });

    it('should have keywordSearch method', () => {
      const engine = new RetrievalEngine();
      expectTypeOf(engine.keywordSearch).toBeFunction();
    });

    it('should have vectorSearch method', () => {
      const engine = new RetrievalEngine();
      expectTypeOf(engine.vectorSearch).toBeFunction();
    });

    it('should have search method (hybrid)', () => {
      const engine = new RetrievalEngine();
      expectTypeOf(engine.search).toBeFunction();
    });

    it('should have delete method', () => {
      const engine = new RetrievalEngine();
      expectTypeOf(engine.delete).toBeFunction();
    });

    it('should have clear method', () => {
      const engine = new RetrievalEngine();
      expectTypeOf(engine.clear).toBeFunction();
    });
  });

  describe('type usage validation', () => {
    it('should accept valid ChunkingStrategy values', () => {
      const strategies: (typeof ChunkingStrategy)[keyof typeof ChunkingStrategy][] = [
        ChunkingStrategy.SEMANTIC,
        ChunkingStrategy.FIXED,
        ChunkingStrategy.AST
      ];
      expect(strategies).toHaveLength(3);
    });

    it('should create typed Query object', () => {
      const query: RetrievalQuery = {
        minSimilarity: 0.8,
        query: 'test query',
        topK: 10
      };
      expect(query.query).toBe('test query');
    });
  });
});
