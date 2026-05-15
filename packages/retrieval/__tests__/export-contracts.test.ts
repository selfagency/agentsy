import { describe, expect, it } from 'vitest';
import * as retrievalExports from '../src/index';

function parseChunkingStrategy(
  strategy: (typeof retrievalExports.ChunkingStrategy)[keyof typeof retrievalExports.ChunkingStrategy],
): (typeof retrievalExports.ChunkingStrategy)[keyof typeof retrievalExports.ChunkingStrategy] {
  return strategy;
}

describe('retrieval/export-contracts', () => {
  describe('public API exports', () => {
    it('should export IndexingPipeline', () => {
      expect(retrievalExports.IndexingPipeline).toBeDefined();
      expect(typeof retrievalExports.IndexingPipeline).toBe('function');
    });

    it('should export RetrievalEngine', () => {
      expect(retrievalExports.RetrievalEngine).toBeDefined();
      expect(typeof retrievalExports.RetrievalEngine).toBe('function');
    });

    it('should export ChunkingStrategy type via const enum object', () => {
      expect(retrievalExports.ChunkingStrategy).toBeDefined();
      expect(retrievalExports.ChunkingStrategy.SEMANTIC).toBe('semantic');
      expect(retrievalExports.ChunkingStrategy.FIXED).toBe('fixed');
      expect(retrievalExports.ChunkingStrategy.AST).toBe('ast');
    });

    it('should export ChunkingStrategy type via type', () => {
      expect(retrievalExports.ChunkingStrategy).toBeDefined();
      type ChunkingStrategy = retrievalExports.ChunkingStrategy;
      const strategy: ChunkingStrategy = 'semantic';
      expect(strategy).toBe('semantic');
    });

    it('should export ChunkingStrategy type via type', () => {
      expect(retrievalExports.ChunkingStrategy).toBeDefined();
      type ChunkingStrategy = retrievalExports.ChunkingStrategy;
      const chunkingStrategy: ChunkingStrategy = parseChunkingStrategy('semantic');
      expect(chunkingStrategy).toBe('semantic');
    });

    describe('type exports', () => {
      it('should export Chunk type', () => {
        expect(retrievalExports._Chunk).toBeDefined();
      });

      it('should export ChunkMetadata type', () => {
        expect(retrievalExports._ChunkMetadata).toBeDefined();
      });

      it('should export DataSource type', () => {
        expect(retrievalExports._DataSource).toBeDefined();
      });

      it('should export RetrievalQuery type', () => {
        expect(retrievalExports._RetrievalQuery).toBeDefined();
      });

      it('should export Document type', () => {
        expect(retrievalExports._Document).toBeDefined();
      });

      it('should export SearchResult type', () => {
        expect(retrievalExports._SearchResult).toBeDefined();
      });
    });

    it('should export ChunkingStrategy type via type', () => {
      expect(retrievalExports.ChunkingStrategy).toBeDefined();
      type ChunkingStrategy = retrievalExports.ChunkingStrategy;
      const strategy: ChunkingStrategy = 'semantic';
      expect(strategy).toBe('semantic');
    });

    describe('IndexingPipeline API contract', () => {
      it('should instantiate IndexingPipeline without options', () => {
        const pipeline = new retrievalExports.IndexingPipeline();
        expect(pipeline).toBeInstanceOf(retrievalExports.IndexingPipeline);
      });

      it('should instantiate IndexingPipeline with options', () => {
        const pipeline = new retrievalExports.IndexingPipeline({
          chunkSize: 100,
          chunkOverlap: 20,
        });
        expect(pipeline).toBeInstanceOf(retrievalExports.IndexingPipeline);
      });

      it('should have chunk method', () => {
        const pipeline = new retrievalExports.IndexingPipeline();
        expect(typeof pipeline.chunk).toBe('function');
      });

      it('should have semanticChunk method', () => {
        const pipeline = new retrievalExports.IndexingPipeline();
        expect(typeof pipeline.semanticChunk).toBe('function');
      });

      it('should have fixedSizeChunk method', () => {
        const pipeline = new retrievalExports.IndexingPipeline();
        expect(typeof pipeline.fixedSizeChunk).toBe('function');
      });

      it('should have astChunk method', () => {
        const pipeline = new retrievalExports.IndexingPipeline();
        expect(typeof pipeline.astChunk).toBe('function');
      });

      it('should have index method', () => {
        const pipeline = new retrievalExports.IndexingPipeline();
        expect(typeof pipeline.index).toBe('function');
      });
    });

    describe('RetrievalEngine API contract', () => {
      it('should instantiate RetrievalEngine without options', () => {
        const engine = new retrievalExports.RetrievalEngine();
        expect(engine).toBeInstanceOf(retrievalExports.RetrievalEngine);
      });

      it('should instantiate RetrievalEngine with options', () => {
        const engine = new retrievalExports.RetrievalEngine({
          topK: 10,
          minSimilarity: 0.8,
        });
        expect(engine).toBeInstanceOf(retrievalExports.RetrievalEngine);
      });

      it('should have index method', () => {
        const engine = new retrievalExports.RetrievalEngine();
        expect(typeof engine.index).toBe('function');
      });

      it('should has index method returns Promise', async () => {
        const engine = new retrievalExports.RetrievalEngine();
        const result = engine.index([]);
        expect(result).toBeInstanceOf(Promise);
        await result;
      });

      it('should have keywordSearch method', () => {
        const engine = new retrievalExports.RetrievalEngine();
        expect(typeof engine.keywordSearch).toBe('function');
      });

      it('should have vectorSearch method', () => {
        const engine = new retrievalExports.RetrievalEngine();
        expect(typeof engine.vectorSearch).toBe('function');
      });

      it('should have search method (hybrid)', () => {
        const engine = new retrievalExports.RetrievalEngine();
        expect(typeof engine.search).toBe('function');
      });

      it('should have delete method', () => {
        const engine = new retrievalExports.RetrievalEngine();
        expect(typeof engine.delete).toBe('function');
      });

      it('should has delete method returns Promise', async () => {
        const engine = new retrievalExports.RetrievalEngine();
        const result = engine.delete('test-id');
        expect(result).toBeInstanceOf(Promise);
        await result;
      });

      it('should have clear method', () => {
        const engine = new retrievalExports.RetrievalEngine();
        expect(typeof engine.clear).toBe('function');
      });

      it('should has clear method returns Promise', async () => {
        const engine = new retrievalExports.RetrievalEngine();
        const result = engine.clear();
        expect(result).toBeInstanceOf(Promise);
        await result;
      });
    });

    describe('type usage validation', () => {
      it('should accept valid ChunkingStrategy values', () => {
        const strategies: (typeof retrievalExports.ChunkingStrategy)[keyof typeof retrievalExports.ChunkingStrategy][] =
          [
            retrievalExports.ChunkingStrategy.SEMANTIC,
            retrievalExports.ChunkingStrategy.FIXED,
            retrievalExports.ChunkingStrategy.AST,
          ];
        expect(strategies).toHaveLength(3);
      });

      it('should create typed Query object', () => {
        const query: retrievalExports.RetrievalQuery = {
          query: 'test query',
          topK: 10,
          minSimilarity: 0.8,
        };
        expect(query.query).toBe('test query');
      });
    });
  });
});
