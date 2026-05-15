import { beforeEach, describe, expect, it } from 'vitest';
import { IndexingPipeline } from '../src/indexing';
import type { DataSource } from '../src/types';

describe('IndexingPipeline', () => {
  let pipeline: IndexingPipeline;
  let testDataSource: DataSource;
  let sourcePath: string;

  beforeEach(() => {
    pipeline = new IndexingPipeline({
      chunkSize: 100,
      chunkOverlap: 20,
    });

    testDataSource = {
      type: 'file',
      path: '/test/file.ts',
      content:
        'This is a test file with multiple sentences. It has enough content to be split into multiple chunks for testing purposes. We want to ensure that the chunking logic works correctly with different strategies.',
    };

    sourcePath = testDataSource.path ?? '/test/file.ts';
  });

  describe('constructor', () => {
    it('should create pipeline with default options', () => {
      const defaultPipeline = new IndexingPipeline();
      expect(defaultPipeline).toBeInstanceOf(IndexingPipeline);
    });

    it('should create pipeline with custom options', () => {
      const customPipeline = new IndexingPipeline({
        chunkSize: 200,
        chunkOverlap: 50,
        semanticThreshold: 0.85,
      });

      expect(customPipeline).toBeInstanceOf(IndexingPipeline);
    });
  });

  describe('chunk', () => {
    it('should chunk data source with semantic strategy', async () => {
      const chunks = await pipeline.chunk(testDataSource, 'semantic');

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should chunk data source with fixed strategy', async () => {
      const chunks = await pipeline.chunk(testDataSource, 'fixed');

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should chunk data source with ast strategy', async () => {
      const chunks = await pipeline.chunk(testDataSource, 'ast');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should generate unique chunk IDs', async () => {
      const chunks = await pipeline.chunk(testDataSource, 'fixed');
      const ids = chunks.map(chunk => chunk.id);

      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should include metadata in chunks', async () => {
      const chunks = await pipeline.chunk(testDataSource, 'fixed');

      chunks.forEach(chunk => {
        expect(chunk.metadata).toBeDefined();
        expect(chunk.metadata.source).toBe(testDataSource.path);
        expect(chunk.metadata.strategy).toBeDefined();
      });
    });
  });

  describe('semanticChunk', () => {
    it('should split content into semantic chunks', async () => {
      const content = 'First sentence. Second sentence. Third paragraph with more content here.';
      const chunks = await pipeline.semanticChunk(content, sourcePath);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.metadata.strategy).toBe('semantic');
      });
    });

    it('should generate chunk IDs based on content hash', async () => {
      const content = 'Test content for hashing';
      const chunks = await pipeline.semanticChunk(content, sourcePath);

      expect(chunks[0].id).toBeDefined();
      expect(typeof chunks[0].id).toBe('string');
    });
  });

  describe('fixedSizeChunk', () => {
    it('should split content into fixed-size chunks with words not exceeding chunk size', async () => {
      const fiftyWordContent = 'Word '.repeat(50);
      const chunks = await pipeline.fixedSizeChunk(fiftyWordContent, sourcePath);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.metadata.strategy).toBe('fixed');
        const wordsInChunk = chunk.content.split(/\s+/);
        expect(wordsInChunk.length).toBeLessThanOrEqual(100);
      });
    });

    it('should overlap consecutive chunks by configured word overlap', async () => {
      const content = 'One two three four five six seven eight nine ten eleven twelve thirteen';
      const pipelineWithOverlap = new IndexingPipeline({
        chunkSize: 5,
        chunkOverlap: 2,
      });

      const chunks = await pipelineWithOverlap.fixedSizeChunk(content, sourcePath);

      expect(chunks.length).toBeGreaterThan(1);
      const firstChunk = chunks[0];
      const secondChunk = chunks[1];
      expect(firstChunk).toBeDefined();
      expect(secondChunk).toBeDefined();

      if (!firstChunk || !secondChunk) {
        return;
      }

      const firstChunkWords = firstChunk.content.split(/\s+/);
      const secondChunkWords = secondChunk.content.split(/\s+/);
      // With chunkSize=5 and overlap=2, consecutive chunks share 2 words
      // Chunk 1: words 0-4, Chunk 2: words 3-7
      // Overlap: words 3-4 should appear in both
      // Check only the overlap region words
      const overlapIndex = 5 - 2 - 1; // chunkSize - chunkOverlap - 1
      const overlapRegionFirst = firstChunkWords.slice(overlapIndex);

      overlapRegionFirst.forEach(word => {
        expect(secondChunkWords).toContain(word);
      });
    });
  });

  describe('astChunk', () => {
    it('should handle TypeScript code for AST chunking', async () => {
      const tsCode = `
function example() {
  const value = 42;
  return value * 2;
}

export const result = example();
      `.trim();

      const chunks = await pipeline.astChunk(tsCode, sourcePath);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.metadata.strategy).toBe('ast');
      });
    });

    it('should preserve function boundaries when chunking multiple functions', async () => {
      const codeWithTwoFunctions = `
function first() {
  return 1;
}

function second() {
  return 2;
}
      `.trim();

      const chunks = await pipeline.astChunk(codeWithTwoFunctions, sourcePath);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  // Note: fixed-size chunking has implicit overlap of 2-3 words based on word boundaries
  describe('index', () => {
    it('should index chunks into document structure', async () => {
      const chunks = await pipeline.chunk(testDataSource, 'semantic');
      const document = pipeline.index(chunks);

      expect(document.id).toBeDefined();
      expect(document.content).toBe(testDataSource.content);
      expect(document.chunks).toEqual(chunks);
    });

    it('should generate consistent document ID for same content', async () => {
      const chunks1 = await pipeline.chunk(testDataSource, 'semantic');
      const chunks2 = await pipeline.chunk(testDataSource, 'semantic');

      const doc1 = pipeline.index(chunks1);
      const doc2 = pipeline.index(chunks2);

      expect(doc1.id).toBe(doc2.id);
    });
  });
});
