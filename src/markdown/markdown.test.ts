import { describe, expect, it } from 'vitest';

import { appendToBlockquote } from './appendToBlockquote.js';

describe('appendToBlockquote', () => {
  it('returns empty string for empty input', () => {
    expect(appendToBlockquote('', true)).toBe('');
  });

  it('prefixes with > when at line start', () => {
    expect(appendToBlockquote('hello', true)).toBe('> hello');
  });

  it('does not prefix when not at line start', () => {
    expect(appendToBlockquote('hello', false)).toBe('hello');
  });

  it('handles multiline with LF', () => {
    expect(appendToBlockquote('a\nb', true)).toBe('> a\n> b');
  });

  it('handles CRLF line endings', () => {
    expect(appendToBlockquote('a\r\nb', true)).toBe('> a\r\n> b');
  });

  it('handles mixed line endings', () => {
    expect(appendToBlockquote('a\r\nb\nc', true)).toBe('> a\r\n> b\n> c');
  });

  it('handles CRLF without orphaned \\r', () => {
    const result = appendToBlockquote('line1\r\nline2', false);
    // \r stays paired with \n — result is \r\n> which is correct CRLF + blockquote prefix
    expect(result).toBe('line1\r\n> line2');
  });
});
