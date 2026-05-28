import { describe, expect, it } from 'vitest';

import { dedupeXmlContextBlocksByTag } from './dedupe-xml-context.js';

describe('dedupeXmlContextBlocksByTag', () => {
  it('handles nested tags of the same name and returns the outermost block', () => {
    const xmlBlocks = ['<a><a>inner</a>outer</a>', '<b>other</b>', '<a>latest</a>'];

    const out = dedupeXmlContextBlocksByTag(xmlBlocks);
    // Expect the earliest-occurring latest-by-tag ordering preserved: b then a
    expect(out).toStrictEqual(['<b>other</b>', '<a>latest</a>']);
  });

  it('extracts full nested content for a deeply nested tag', () => {
    const xmlBlocks = ['<x><x><x>deep</x></x>outer</x>'];
    const out = dedupeXmlContextBlocksByTag(xmlBlocks);
    expect(out).toStrictEqual(['<x><x><x>deep</x></x>outer</x>']);
  });

  it('handles triple-nested tags of the same name correctly', () => {
    const xmlBlocks = ['<ctx><ctx>middle<ctx>inner</ctx>middle</ctx>outer</ctx>'];
    const out = dedupeXmlContextBlocksByTag(xmlBlocks);
    // Should extract the entire outermost tag
    expect(out).toStrictEqual(['<ctx><ctx>middle<ctx>inner</ctx>middle</ctx>outer</ctx>']);
  });

  it('deduplicates multiple tags with nested content, keeping latest for each tag', () => {
    const xmlBlocks = [
      '<tag1><tag1>nested1</tag1>outer1</tag1>',
      '<tag2>content2</tag2>',
      '<tag1>latest1</tag1>',
      '<tag2><tag2>nested2</tag2>outer2</tag2>'
    ];
    const out = dedupeXmlContextBlocksByTag(xmlBlocks);
    // tag1 latest: <tag1>latest1</tag1>
    // tag2 latest: <tag2><tag2>nested2</tag2>outer2</tag2> (because it appears after tag2 in processing order)
    expect(out).toHaveLength(2);
    expect(out).toContain('<tag1>latest1</tag1>');
    expect(out).toContain('<tag2><tag2>nested2</tag2>outer2</tag2>');
  });

  it('handles tags with attributes and nested self-references', () => {
    const xmlBlocks = ['<myTag attr="val"><myTag>inner</myTag>outer</myTag>'];
    const out = dedupeXmlContextBlocksByTag(xmlBlocks);
    expect(out).toStrictEqual(['<myTag attr="val"><myTag>inner</myTag>outer</myTag>']);
  });

  it('returns empty array when no valid tags are found', () => {
    const xmlBlocks = ['no tags here', 'plain text'];
    const out = dedupeXmlContextBlocksByTag(xmlBlocks);
    expect(out).toStrictEqual([]);
  });

  it('handles self-closing tags correctly', () => {
    const xmlBlocks = ['<tag1/>', '<tag2>content</tag2>'];
    const out = dedupeXmlContextBlocksByTag(xmlBlocks);
    // Self-closing tags won't match the regex pattern, so only tag2 should appear
    expect(out).toStrictEqual(['<tag2>content</tag2>']);
  });

  it('processes blocks in reverse order, keeping latest occurrences', () => {
    const xmlBlocks = ['<old>first</old>', '<new>second</new>', '<old>updated</old>'];
    const out = dedupeXmlContextBlocksByTag(xmlBlocks);
    // Should keep the latest (from the end): old=updated, new=second
    expect(out).toStrictEqual(['<new>second</new>', '<old>updated</old>']);
  });
});
