import type { Chunk, ChunkingStrategy, DataSource, Document } from '../types.js';

export interface IndexingPipelineOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  semanticThreshold?: number;
}

function hashString(str: string): string {
  let hash = 0;
  for (const char of str) {
    const charCode = char.codePointAt(0) || 0;
    hash = (hash << 5) - hash + charCode;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export class IndexingPipeline {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;
  private readonly semanticThreshold: number;
  private currentStrategy: ChunkingStrategy;

  constructor(options: IndexingPipelineOptions = {}) {
    this.chunkSize = options.chunkSize ?? 100;
    this.chunkOverlap = options.chunkOverlap ?? 0;
    this.semanticThreshold = options.semanticThreshold ?? 0.7;
    this.currentStrategy = 'semantic';
  }

  async chunk(source: DataSource, strategy: ChunkingStrategy = 'semantic'): Promise<Chunk[]> {
    const sourcePath = source.path ?? 'unknown';
    const content = source.content ?? '';
    switch (strategy) {
      case 'semantic':
        return this.semanticChunk(content, sourcePath);
      case 'fixed':
        return this.fixedSizeChunk(content, sourcePath);
      case 'ast':
        return this.astChunk(content, sourcePath);
      default:
        throw new Error(`Unknown chunking strategy: ${String(strategy)}`);
    }
  }

  async semanticChunk(content: string, sourcePath: string): Promise<Chunk[]> {
    this.currentStrategy = 'semantic';
    const chunks: Chunk[] = [];
    const sentences = content.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    let currentPosition = 0;

    for (const sentence of sentences) {
      const testChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      if (testChunk.length <= this.chunkSize) {
        currentChunk = testChunk;
      } else {
        if (currentChunk) {
          chunks.push(
            this.createChunk(currentChunk, sourcePath, currentPosition, (pos: number) => {
              return content.slice(0, pos).split('\n').length;
            }),
          );
          currentPosition += currentChunk.length;
        }
        currentChunk = sentence;
      }
    }

    if (currentChunk) {
      chunks.push(
        this.createChunk(currentChunk, sourcePath, currentPosition, (pos: number) => {
          return content.slice(0, pos).split('\n').length;
        }),
      );
    }
    return chunks;
  }

  async fixedSizeChunk(content: string, sourcePath: string): Promise<Chunk[]> {
    this.currentStrategy = 'fixed';
    const chunks: Chunk[] = [];
    const words = content.split(/\s+/);
    let currentChunk = '';
    let currentWordCount = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i]!;
      const testChunk = currentChunk ? `${currentChunk} ${word}` : word;
      if (currentWordCount < this.chunkSize) {
        currentChunk = testChunk;
        currentWordCount++;
      } else {
        if (currentChunk) {
          chunks.push(this.createChunk(currentChunk, sourcePath, i - currentWordCount));
        }
        currentChunk = word;
        currentWordCount = 1;
      }
    }

    if (currentChunk) {
      chunks.push(this.createChunk(currentChunk, sourcePath, words.length - currentWordCount + 1));
    }
    return chunks;
  }

  async astChunk(content: string, sourcePath: string): Promise<Chunk[]> {
    this.currentStrategy = 'ast';
    const chunks: Chunk[] = [];
    const blocks = this.splitByBlock(content);
    let position = 0;

    for (const block of blocks) {
      if (block.trim()) {
        chunks.push(
          this.createChunk(block, sourcePath, position, (pos: number) => {
            return this.getCodePosition(content, pos);
          }),
        );
        position += block.length;
      }
    }
    return chunks;
  }

  private splitByBlock(code: string): string[] {
    const blocks: string[] = [];
    let currentBlock = '';
    let braceDepth = 0;
    let parenDepth = 0;
    let inFunction = false;

    for (let i = 0; i < code.length; i++) {
      const char = code[i]!;
      const nextChar = code[i + 1] ?? '';

      if (char === '{') braceDepth++;
      else if (char === '}') braceDepth--;
      else if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;

      currentBlock += char;

      const splitDecision = this.evaluateSplit(code, i, nextChar, braceDepth, parenDepth, inFunction, currentBlock);
      inFunction = splitDecision.newInFunction;

      if (splitDecision.shouldSplit) {
        blocks.push(currentBlock.trim());
        currentBlock = '';
        inFunction = false;
      }
    }

    if (currentBlock.trim()) blocks.push(currentBlock.trim());
    return blocks.length > 0 ? blocks : [code];
  }

  private evaluateSplit(
    code: string,
    i: number,
    nextChar: string,
    braceDepth: number,
    parenDepth: number,
    inFunction: boolean,
    currentBlock: string,
  ): { shouldSplit: boolean; newInFunction: boolean } {
    const isFunction = /function\b/.test(code.slice(i - 8, i + 1));
    const isAsync = code.slice(i - 5, i + 1).includes('async') && nextChar === ' ';
    const isClass = code.slice(i - 5, i + 1).includes('class');
    const isExport = code.slice(i - 6, i + 1).includes('export');

    let newInFunction = inFunction;
    if ((isFunction || isAsync || isClass) && !inFunction) {
      newInFunction = true;
    }

    const char = code[i]!;
    const shouldSplit =
      newInFunction &&
      braceDepth === 0 &&
      parenDepth === 0 &&
      (char === '\n' || char === ';') &&
      (isExport || currentBlock.trim().length > 50);

    return { shouldSplit, newInFunction };
  }

  private createChunk(
    content: string,
    sourcePath: string,
    startIdxOrPosition: number,
    calculateLine?: (pos: number) => number,
  ): Chunk {
    const contentHash = hashString(content);
    const startLine = calculateLine ? calculateLine(startIdxOrPosition) : Math.max(1, startIdxOrPosition);

    return {
      id: `chunk-${contentHash}`,
      content,
      metadata: {
        source: sourcePath,
        startLine,
        endLine: startLine + content.split('\n').length - 1,
        strategy: this.currentStrategy,
        language: this.detectLanguage(sourcePath),
      },
    };
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'py':
        return 'python';
      default:
        return 'text';
    }
  }

  private getCodePosition(text: string, position: number): number {
    return position <= 0 ? 1 : text.slice(0, position).split('\n').length;
  }

  public index(chunks: Chunk[]): Document {
    const content = chunks.map(c => c.content).join(' ');
    return {
      id: `doc-${hashString(content)}`,
      content,
      chunks,
      metadata: {
        chunkCount: chunks.length,
        indexedAt: new Date().toISOString(),
      },
    };
  }
}
