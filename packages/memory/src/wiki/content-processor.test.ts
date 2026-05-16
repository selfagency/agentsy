import { describe, expect, it } from 'vitest';

import { createContentProcessor } from './content-processor.js';

describe('ContentProcessor', () => {
  it('normalizes line endings and whitespace', () => {
    const processor = createContentProcessor();
    expect(processor.normalize('  a\r\n b\n')).toBe('a\n b');
  });

  it('extracts markdown code blocks without stripping content', () => {
    const processor = createContentProcessor();
    const blocks = processor.extractCodeBlocks('```ts\nconst a = 1;\n```\ntext');
    expect(blocks).toStrictEqual(['```ts\nconst a = 1;\n```']);
  });

  it('detects supported formats', () => {
    const processor = createContentProcessor();
    expect(processor.detectFormat('{"a":1}')).toBe('json');
    expect(processor.detectFormat('# Title')).toBe('markdown');
    expect(processor.detectFormat('const x = 1;')).toBe('code');
    expect(processor.detectFormat('plain text')).toBe('text');
  });
});
