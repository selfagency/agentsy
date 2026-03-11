import { describe, expect, it } from 'vitest';

import {
  ThinkingParser,
  createXmlStreamFilter,
  dedupeXmlContextBlocksByTag,
  extractXmlToolCalls,
  stripXmlContextTags,
} from './index.js';

describe('scaffold exports', () => {
  it('provides core scaffolding exports', () => {
    const parser = new ThinkingParser();
    const filter = createXmlStreamFilter();

    expect(parser).toBeDefined();
    expect(filter.write('abc')).toBe('abc');
    expect(() => extractXmlToolCalls('', new Set<string>())).toThrow('not implemented');
  });
});

describe('ThinkingParser', () => {
  it('returns full chunk as regular content when no tags are configured', () => {
    const parser = new ThinkingParser();
    const [thinking, regular] = parser.addContent('Hello world');
    expect(thinking).toBe('');
    expect(regular).toBe('Hello world');
  });

  it('extracts thinking content between configured tags', () => {
    const parser = new ThinkingParser({ openingTag: '<think>', closingTag: '</think>' });
    const [thinking, regular] = parser.addContent('<think>internal thought</think>visible text');
    expect(thinking).toBe('internal thought');
    expect(regular).toBe('visible text');
  });

  it('returns chunk unchanged as regular content when no thinking tags are present', () => {
    const parser = new ThinkingParser({ openingTag: '<think>', closingTag: '</think>' });
    const [thinking, regular] = parser.addContent('no tags here');
    expect(thinking).toBe('');
    expect(regular).toBe('no tags here');
  });

  it('handles multiple thinking blocks in a single chunk', () => {
    const parser = new ThinkingParser({ openingTag: '<think>', closingTag: '</think>' });
    const [thinking, regular] = parser.addContent(
      'before<think>first</think>middle<think>second</think>after',
    );
    expect(thinking).toBe('firstsecond');
    expect(regular).toBe('beforemiddleafter');
  });

  it('treats unmatched opening tag as regular content', () => {
    const parser = new ThinkingParser({ openingTag: '<think>', closingTag: '</think>' });
    const [thinking, regular] = parser.addContent('text<think>no close tag');
    expect(thinking).toBe('');
    expect(regular).toBe('text<think>no close tag');
  });

  it('returns empty thinking and empty regular for empty input', () => {
    const parser = new ThinkingParser({ openingTag: '<think>', closingTag: '</think>' });
    const [thinking, regular] = parser.addContent('');
    expect(thinking).toBe('');
    expect(regular).toBe('');
  });
});

describe('createXmlStreamFilter', () => {
  it('passes through content when no scrub tags are configured', () => {
    const filter = createXmlStreamFilter();
    expect(filter.write('hello world')).toBe('hello world');
    expect(filter.write('')).toBe('');
    expect(filter.end()).toBe('');
  });

  it('throws when extraScrubTags are provided', () => {
    expect(() => createXmlStreamFilter({ extraScrubTags: new Set(['foo']) })).toThrow(
      'not implemented',
    );
  });

  it('throws when overrideScrubTags are provided', () => {
    expect(() => createXmlStreamFilter({ overrideScrubTags: new Set(['bar']) })).toThrow(
      'not implemented',
    );
  });

  it('does not throw when empty scrub tag sets are provided', () => {
    expect(() =>
      createXmlStreamFilter({ extraScrubTags: new Set(), overrideScrubTags: new Set() }),
    ).not.toThrow();
  });
});

describe('extractXmlToolCalls', () => {
  it('throws a not-implemented error', () => {
    expect(() => extractXmlToolCalls('<tool/>', new Set(['tool']))).toThrow('not implemented');
  });

  it('throws even for empty inputs', () => {
    expect(() => extractXmlToolCalls('', new Set())).toThrow('not implemented');
  });
});

describe('stripXmlContextTags', () => {
  it('returns input unchanged when there are no context tags', () => {
    expect(stripXmlContextTags('hello world')).toBe('hello world');
  });

  it('removes a simple <context> block', () => {
    expect(stripXmlContextTags('<context>some context</context>visible')).toBe('visible');
  });

  it('removes a <context> block with attributes', () => {
    expect(stripXmlContextTags('<context id="1">data</context>after')).toBe('after');
  });

  it('removes nested <context> blocks', () => {
    expect(
      stripXmlContextTags('<context>outer<context>inner</context>still outer</context>visible'),
    ).toBe('visible');
  });

  it('preserves text outside of context tags', () => {
    expect(stripXmlContextTags('before<context>ctx</context>after')).toBe('beforeafter');
  });

  it('returns empty string for input containing only context tags', () => {
    expect(stripXmlContextTags('<context>ctx</context>')).toBe('');
  });

  it('does not strip tags that only share a prefix with "context"', () => {
    expect(stripXmlContextTags('<contextual>text</contextual>')).toBe(
      '<contextual>text</contextual>',
    );
  });

  it('throws on unclosed <context> tag', () => {
    expect(() => stripXmlContextTags('<context>not closed')).toThrow('Unclosed');
  });

  it('throws on unmatched </context> closing tag', () => {
    expect(() => stripXmlContextTags('text</context>')).toThrow('Unmatched');
  });
});

describe('dedupeXmlContextBlocksByTag', () => {
  it('returns empty array for empty input', () => {
    expect(dedupeXmlContextBlocksByTag([])).toEqual([]);
  });

  it('passes through a single block unchanged', () => {
    expect(dedupeXmlContextBlocksByTag(['<foo>bar</foo>'])).toEqual(['<foo>bar</foo>']);
  });

  it('deduplicates blocks with the same root tag name', () => {
    const blocks = ['<foo>first</foo>', '<foo>second</foo>', '<bar>other</bar>'];
    const result = dedupeXmlContextBlocksByTag(blocks);
    expect(result).toEqual(['<foo>first</foo>', '<bar>other</bar>']);
  });

  it('keeps all blocks when all root tags are distinct', () => {
    const blocks = ['<a>1</a>', '<b>2</b>', '<c>3</c>'];
    expect(dedupeXmlContextBlocksByTag(blocks)).toEqual(blocks);
  });

  it('always keeps blocks without a recognisable opening tag', () => {
    const blocks = ['no tags here', '<foo>data</foo>', 'also no tags'];
    const result = dedupeXmlContextBlocksByTag(blocks);
    expect(result).toContain('no tags here');
    expect(result).toContain('also no tags');
  });

  it('handles blocks with attributes on the root tag', () => {
    const blocks = ['<foo id="1">first</foo>', '<foo id="2">second</foo>'];
    const result = dedupeXmlContextBlocksByTag(blocks);
    expect(result).toEqual(['<foo id="1">first</foo>']);
  });

  it('correctly extracts hyphenated tag names', () => {
    const blocks = ['<my-tag>first</my-tag>', '<my-tag>second</my-tag>'];
    const result = dedupeXmlContextBlocksByTag(blocks);
    expect(result).toEqual(['<my-tag>first</my-tag>']);
  });
});
