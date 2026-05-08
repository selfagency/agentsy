import { describe, expect, it } from 'vitest';

import { formatXmlLikeResponseForDisplay } from './formatXmlLikeResponseForDisplay.js';
import { sanitizeNonStreamingModelOutput } from './sanitizeNonStreamingModelOutput.js';

describe('formatXmlLikeResponseForDisplay', () => {
  it('formats xml-like blocks as markdown headings', () => {
    expect(formatXmlLikeResponseForDisplay('<note>important</note>')).toBe('**Note**\nimportant');
  });

  it('returns original text when no xml tags are found', () => {
    expect(formatXmlLikeResponseForDisplay('plain text')).toBe('plain text');
  });
});

describe('sanitizeNonStreamingModelOutput', () => {
  it('strips context tags and formats remaining xml-like blocks', () => {
    const input = '<user_info>secret</user_info><note>hello</note>';
    expect(sanitizeNonStreamingModelOutput(input)).toBe('**Note**\nhello');
  });
});
