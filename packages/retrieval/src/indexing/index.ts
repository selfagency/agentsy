import type { Chunk, ChunkingStrategy, DataSource, Document } from '../types.d.ts';

export interface IndexingPipelineOptions {
  chunkSize?: number;
  semanticThreshold?: number;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export class IndexingPipeline {
  private chunkSize: number;
  private chunkOverlap: number;
  private semanticThreshold: number;
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
        throw new Error(`Unknown chunking strategy: ${strategy}`);
    }
  }

  async semanticChunk(content: string, sourcePath: string): Promise<Chunk[]> {
    this.currentStrategy = 'semantic';

    const chunks: Chunk[] = [];
    const sentences = content.split(/(?<=[.!?])\s+/);

    let currentChunk = '';
    let currentPosition = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]!;
      const testChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;

      if (testChunk.length <= this.chunkSize) {
        currentChunk = testChunk;
      } else {
        if (currentChunk) {
          chunks.push(this.createChunk(currentChunk, sourcePath, currentPosition, (pos: number) => {
            const contentText = content.slice(0, pos);
            if (contentText.split) {
              return contentText.split('\n').length;
            }
            return 1;
          }));
          currentPosition += currentChunk.length;
        }
        currentChunk = sentence!;
      }
    }

    if (currentChunk) {
      chunks.push(this.createChunk(currentChunk, sourcePath, currentPosition, (pos: number) => {
        const contentText = content.slice(0, pos);
        if (contentText.split) {
          return contentText.split('\n').length;
        }
        return 1;
      }));
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

  private calculateLineNumber(wordIndex: number, wordOffset: number, lineStartIndices: number[]): number {
    const index = wordOffset + lineStartIndices[wordIndex]!;
    return index > 0 ? index : 1;
  }

  async astChunk(content: string, sourcePath: string): Promise<Chunk[]> {
    this.currentStrategy = 'ast';

    const chunks: Chunk[] = [];

    function splitByBlock(code: string): string[] {
      const blocks: string[] = [];
      let currentBlock = '';
      let braceDepth = 0;
      let parenDepth = 0;
      let inFunction = false;

      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const nextChar = code[i + 1];

        if (char === '{') {
          braceDepth++;
        } else if (char === '}') {
          braceDepth--;
        } else if (char === '(') {
          parenDepth++;
        } else if (char === ')') {
          parenDepth--;
        }

        currentBlock += char;

        const isFunctionKeyword = /function\b/.test(code.slice(i - 8, i + 1));
        const isAsyncFunction = code.slice(i - 5, i + 1).includes('async') && nextChar === ' ';
        const isClassKeyword = code.slice(i - 5, i + 1).includes('class');
        const isArrowFunction = parenDepth === 1 && nextChar === '=>';
        const isExport = code.slice(i - 6, i + 1).includes('export');

        if ((isFunctionKeyword || isAsyncFunction || isClassKeyword) && !inFunction) {
          inFunction = true;
        }

        if (inFunction && braceDepth === 0 && parenDepth === 0 && (char === '\n' || char === ';')) {
          if (isExport || currentBlock.trim().length > 50) {
            blocks.push(currentBlock.trim());
            currentBlock = '';
            inFunction = false;
          }
        }
      }

      if (currentBlock.trim()) {
        blocks.push(currentBlock.trim());
      }

      return blocks.length > 0 ? blocks : [code];
    }

    const blocks = splitByBlock(content);
    let position = 0;

    for (const block of blocks) {
      if (block.trim()) {
chunks.push(this.createChunk(block, sourcePath, position, (pos: number) => {
          return this.getCodePosition(content, pos);
        }));
        position += block.length;
      }
    }

    return chunks;
  }

  private createChunk(content: string, sourcePath: string, startIdxOrPosition: number, calculateLine?: (pos: number) => number): Chunk {
    const contentHash = hashString(content);
    const lines = content.split('\n');
    const lineCount = lines.length;

    const startLine = typeof startIdxOrPosition === 'number'
      ? startIdxOrPosition
      : calculateLine
        ? calculateLine(startIdxOrPosition)
        : 1;

    return {
      id: `chunk-${contentHash}`,
      content,
      metadata: {
        source: sourcePath || 'unknown',
        startLine,
        endLine: lineCount + 1,
        strategy: this.currentStrategy,
        language: this.detectLanguage(sourcePath || 'unknown')
      }
    };
  }

  private detectLanguage(filePath: string): string {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      return 'typescript';
    }
    if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
      return 'javascript';
    }
    if (filePath.endsWith('.py')) {
      return 'python';
    }
    return 'text';
  }

  private countNewlines(text: string, position: number): number {
    let count = 0;
    for (let i = 0; i < position && i < text.length; i++) {
      if (text[i] === '\n') {
        count++;
      }
    }
    return count + 1;
  }

  private getCodePosition(text: string, position: number): number {
    if (position <= 0) {
      return 1;
    }
    return text.slice(0, position).split('\n').length;
  }

  public index(chunks: Chunk[]): Document {
    const content = chunks.map(chunk => chunk.content).join(' ');
    const docId = hashString(content);
    const result: Document = {
      id: `doc-${docId}`,
      content,
      chunks,
      metadata: {
        chunkCount: chunks.length,
        indexedAt: new Date().toISOString()
      }
    };

    return result;
  }
}