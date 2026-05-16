import { describe, expect, it, expectTypeOf } from "vitest";

import * as retrievalExports from "../src/index";

function parseChunkingStrategy(
  strategy: (typeof retrievalExports.ChunkingStrategy)[keyof typeof retrievalExports.ChunkingStrategy]
): (typeof retrievalExports.ChunkingStrategy)[keyof typeof retrievalExports.ChunkingStrategy] {
  return strategy;
}

describe("retrieval/export-contracts", () => {
  describe("public API exports", () => {
    it("should export IndexingPipeline", () => {
      expect(retrievalExports.IndexingPipeline).toBeDefined();
      expectTypeOf(retrievalExports.IndexingPipeline).toBeObject();
    });

    it("should export RetrievalEngine", () => {
      expect(retrievalExports.RetrievalEngine).toBeDefined();
      expectTypeOf(retrievalExports.RetrievalEngine).toBeObject();
    });

    it("should export ChunkingStrategy type via const enum object", () => {
      expect(retrievalExports.ChunkingStrategy).toBeDefined();
      expect(retrievalExports.ChunkingStrategy.SEMANTIC).toBe("semantic");
      expect(retrievalExports.ChunkingStrategy.FIXED).toBe("fixed");
      expect(retrievalExports.ChunkingStrategy.AST).toBe("ast");
    });

    it("should export ChunkingStrategy type via type", () => {
      expect(retrievalExports.ChunkingStrategy).toBeDefined();
      type ChunkingStrategy = retrievalExports.ChunkingStrategy;
      const strategy: ChunkingStrategy = "semantic";
      expect(strategy).toBe("semantic");
    });

    it("should export ChunkingStrategy type via type", () => {
      expect(retrievalExports.ChunkingStrategy).toBeDefined();
      type ChunkingStrategy = retrievalExports.ChunkingStrategy;
      const chunkingStrategy: ChunkingStrategy =
        parseChunkingStrategy("semantic");
      expect(chunkingStrategy).toBe("semantic");
    });

    describe("type exports", () => {
      it("should export Chunk type", () => {
        expect(retrievalExports._Chunk).toBeDefined();
      });

      it("should export ChunkMetadata type", () => {
        expect(retrievalExports._ChunkMetadata).toBeDefined();
      });

      it("should export DataSource type", () => {
        expect(retrievalExports._DataSource).toBeDefined();
      });

      it("should export RetrievalQuery type", () => {
        expect(retrievalExports._RetrievalQuery).toBeDefined();
      });

      it("should export Document type", () => {
        expect(retrievalExports._Document).toBeDefined();
      });

      it("should export SearchResult type", () => {
        expect(retrievalExports._SearchResult).toBeDefined();
      });
    });

    it("should export ChunkingStrategy type via type", () => {
      expect(retrievalExports.ChunkingStrategy).toBeDefined();
      type ChunkingStrategy = retrievalExports.ChunkingStrategy;
      const strategy: ChunkingStrategy = "semantic";
      expect(strategy).toBe("semantic");
    });

    describe("IndexingPipeline API contract", () => {
      it("should instantiate IndexingPipeline without options", () => {
        const pipeline = new retrievalExports.IndexingPipeline();
        expect(pipeline).toBeInstanceOf(retrievalExports.IndexingPipeline);
      });

      it("should instantiate IndexingPipeline with options", () => {
        const pipeline = new retrievalExports.IndexingPipeline({
          chunkOverlap: 20,
          chunkSize: 100,
        });
        expect(pipeline).toBeInstanceOf(retrievalExports.IndexingPipeline);
      });

      it("should have chunk method", () => {
        const pipeline = new retrievalExports.IndexingPipeline();
        expectTypeOf(pipeline.chunk).toBeFunction();
      });

      it("should have semanticChunk method", () => {
        const pipeline = new retrievalExports.IndexingPipeline();
        expectTypeOf(pipeline.semanticChunk).toBeFunction();
      });

      it("should have fixedSizeChunk method", () => {
        const pipeline = new retrievalExports.IndexingPipeline();
        expectTypeOf(pipeline.fixedSizeChunk).toBeFunction();
      });

      it("should have astChunk method", () => {
        const pipeline = new retrievalExports.IndexingPipeline();
        expectTypeOf(pipeline.astChunk).toBeFunction();
      });

      it("should have index method", () => {
        const pipeline = new retrievalExports.IndexingPipeline();
        expectTypeOf(pipeline.index).toBeFunction();
      });
    });

    describe("RetrievalEngine API contract", () => {
      it("should instantiate RetrievalEngine without options", () => {
        const engine = new retrievalExports.RetrievalEngine();
        expect(engine).toBeInstanceOf(retrievalExports.RetrievalEngine);
      });

      it("should instantiate RetrievalEngine with options", () => {
        const engine = new retrievalExports.RetrievalEngine({
          minSimilarity: 0.8,
          topK: 10,
        });
        expect(engine).toBeInstanceOf(retrievalExports.RetrievalEngine);
      });
    });
  });

  describe("RetrievalEngine methods", () => {
    it("should have index method", () => {
      const engine = new retrievalExports.RetrievalEngine();
      expectTypeOf(engine.index).toBeFunction();
    });

    it("should have keywordSearch method", () => {
      const engine = new retrievalExports.RetrievalEngine();
      expectTypeOf(engine.keywordSearch).toBeFunction();
    });

    it("should have vectorSearch method", () => {
      const engine = new retrievalExports.RetrievalEngine();
      expectTypeOf(engine.vectorSearch).toBeFunction();
    });

    it("should have search method (hybrid)", () => {
      const engine = new retrievalExports.RetrievalEngine();
      expectTypeOf(engine.search).toBeFunction();
    });

    it("should have delete method", () => {
      const engine = new retrievalExports.RetrievalEngine();
      expectTypeOf(engine.delete).toBeFunction();
    });

it("should have clear method", () => {
      const engine = new retrievalExports.RetrievalEngine();
      expectTypeOf(engine.clear).toBeFunction();
    });
  });

  describe("type usage validation", () => {
      it("should accept valid ChunkingStrategy values", () => {
        const strategies: (typeof retrievalExports.ChunkingStrategy)[keyof typeof retrievalExports.ChunkingStrategy][] =
          [
            retrievalExports.ChunkingStrategy.SEMANTIC,
            retrievalExports.ChunkingStrategy.FIXED,
            retrievalExports.ChunkingStrategy.AST,
          ];
        expect(strategies).toHaveLength(3);
      });

      it("should create typed Query object", () => {
        const query: retrievalExports.RetrievalQuery = {
          minSimilarity: 0.8,
          query: "test query",
          topK: 10,
        };
        expect(query.query).toBe("test query");
      });
    });
  });
});
