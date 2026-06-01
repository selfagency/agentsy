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

  /* ── toSearchableText ── */

  it('toSearchableText formats JSON content compactly', () => {
    const processor = createContentProcessor();
    const result = processor.toSearchableText('{"name": "Alice", "age": 30}');
    expect(result).toBe('{"name":"Alice","age":30}');
  });

  it('toSearchableText returns raw content for invalid JSON', () => {
    const processor = createContentProcessor();
    const result = processor.toSearchableText('{invalid json}');
    // doesn't look like JSON (doesn't start with { and end with } properly)
    // Actually {invalid json} — starts with { and ends with } so looksLikeJson returns true
    // JSON.parse throws so it returns normalizeWhitespace
    expect(result).toBe('{invalid json}');
  });

  it('toSearchableText strips code blocks from non-JSON content', () => {
    const processor = createContentProcessor();
    const result = processor.toSearchableText('Some text ```ts\nconst x = 1;\n``` more text');
    expect(result).not.toContain('```');
    expect(result).toContain('Some text');
    expect(result).toContain('more text');
  });

  it('toSearchableText replaces special characters with spaces', () => {
    const processor = createContentProcessor();
    const result = processor.toSearchableText('`code` *bold* #hash >quote _italic_');
    expect(result).not.toContain('`');
    expect(result).not.toContain('*');
    expect(result).not.toContain('#');
    expect(result).not.toContain('>');
    expect(result).not.toContain('_');
  });

  /* ── extractEntities ── */

  it('extractEntities filters out short words', () => {
    const processor = createContentProcessor();
    const result = processor.extractEntities('A B CD EFG Hijk LmnoP');
    // Only words of length >= 3: EFG (3), Hijk (4), LmnoP (5)
    expect(result).toContain('EFG');
    expect(result).toContain('Hijk');
    expect(result).toContain('LmnoP');
    expect(result).not.toContain('A');
    expect(result).not.toContain('B');
    expect(result).not.toContain('CD');
  });

  it('extractEntities deduplicates results', () => {
    const processor = createContentProcessor();
    const result = processor.extractEntities('Alice Bob Alice Bob Charlie');
    expect(result).toStrictEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('extractEntities returns empty array when no matches', () => {
    const processor = createContentProcessor();
    const result = processor.extractEntities('a b');
    expect(result).toStrictEqual([]);
  });

  /* ── detectFormat edge cases ── */

  it('detectFormat returns json for array syntax', () => {
    const processor = createContentProcessor();
    expect(processor.detectFormat('[1, 2, 3]')).toBe('json');
  });

  it('detectFormat returns text for empty content', () => {
    const processor = createContentProcessor();
    expect(processor.detectFormat('')).toBe('text');
  });

  it('detectFormat returns markdown for bullet list', () => {
    const processor = createContentProcessor();
    expect(processor.detectFormat('- item\n- item')).toBe('markdown');
  });

  it('detectFormat returns markdown for numbered list', () => {
    const processor = createContentProcessor();
    expect(processor.detectFormat('1. first\n2. second')).toBe('markdown');
  });

  /* ── extractCodeBlocks ── */

  it('extractCodeBlocks returns empty array when no code blocks', () => {
    const processor = createContentProcessor();
    const blocks = processor.extractCodeBlocks('just plain text');
    expect(blocks).toStrictEqual([]);
  });

  it('extractCodeBlocks handles multiple code blocks', () => {
    const processor = createContentProcessor();
    const blocks = processor.extractCodeBlocks('```ts\na\n```\ntext\n```py\nb\n```');
    expect(blocks).toStrictEqual(['```ts\na\n```', '```py\nb\n```']);
  });
});
