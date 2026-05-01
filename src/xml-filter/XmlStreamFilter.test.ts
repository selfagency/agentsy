import { describe, expect, it, vi } from 'vitest';

import { createXmlStreamFilter } from './XmlStreamFilter.js';

/** Helper: write chunk then end(); returns concatenated result. */
function run(filter: ReturnType<typeof createXmlStreamFilter>, chunk: string): string {
  return filter.write(chunk) + filter.end();
}

describe('createXmlStreamFilter', () => {
  // --- Basic passthrough ---

  it('passes through plain text unchanged', () => {
    const filter = createXmlStreamFilter();
    expect(run(filter, 'hello world')).toBe('hello world');
  });

  it('passes through non-scrubbed XML tags with their content', () => {
    const filter = createXmlStreamFilter();
    const out = run(filter, '<response>visible content</response>');
    expect(out).toContain('visible content');
    expect(out).toContain('<response>');
    expect(out).toContain('</response>');
  });

  it('passes through self-closing non-scrubbed tags', () => {
    const filter = createXmlStreamFilter();
    const out = run(filter, 'before<br />after');
    expect(out).toContain('before');
    expect(out).toContain('after');
    expect(out).toContain('<br');
  });

  it('passes through tag attributes on passthrough tags', () => {
    const filter = createXmlStreamFilter();
    const out = run(filter, '<span class="highlight">text</span>');
    expect(out).toContain('class="highlight"');
    expect(out).toContain('text');
  });

  // --- Scrubbing default tags ---

  it('scrubs default scrub tag and its content', () => {
    const filter = createXmlStreamFilter();
    const out = run(filter, 'before<context>secret</context>after');
    expect(out).toContain('before');
    expect(out).toContain('after');
    expect(out).not.toContain('secret');
    expect(out).not.toContain('<context>');
  });

  it('scrubs toolCall tag (default scrub set)', () => {
    const filter = createXmlStreamFilter();
    const out = run(filter, 'text<toolCall>{"name":"x"}</toolCall>more');
    expect(out).toContain('text');
    expect(out).toContain('more');
    expect(out).not.toContain('name');
    expect(out).not.toContain('<toolCall>');
  });

  it('scrubs system wrapper tags completely', () => {
    const filter = createXmlStreamFilter();
    const out = run(filter, '<system>instructions</system>visible');
    expect(out).toContain('visible');
    expect(out).not.toContain('instructions');
    expect(out).not.toContain('<system>');
  });

  // --- extraScrubTags ---

  it('scrubs extra tags specified via extraScrubTags', () => {
    const filter = createXmlStreamFilter({ extraScrubTags: new Set(['secret']) });
    const out = run(filter, 'public<secret>hidden</secret>public');
    expect(out).not.toContain('hidden');
    expect(out).toMatch(/public.*public/);
  });

  it('still scrubs defaults when extraScrubTags are added', () => {
    const filter = createXmlStreamFilter({ extraScrubTags: new Set(['custom']) });
    const out = run(filter, '<context>gone</context><custom>also gone</custom>kept');
    expect(out).toContain('kept');
    expect(out).not.toContain('gone');
    expect(out).not.toContain('also gone');
  });

  // --- End flush ---

  it('write() buffers trailing text; end() flushes it', () => {
    const filter = createXmlStreamFilter();
    const fromWrite = filter.write('hello');
    const fromEnd = filter.end();
    // Saxophone buffers text that may be the start of a tag; end() flushes it
    expect(fromWrite + fromEnd).toBe('hello');
  });

  // --- CDATA sections ---

  it('passes through CDATA sections outside scrubbed tags', () => {
    const filter = createXmlStreamFilter();
    const out = run(filter, '<![CDATA[raw & content]]>');
    expect(out).toBe('<![CDATA[raw & content]]>');
  });

  it('suppresses CDATA sections inside scrubbed tags', () => {
    const filter = createXmlStreamFilter();
    const out = run(filter, '<context><![CDATA[hidden]]></context>visible');
    expect(out).toContain('visible');
    expect(out).not.toContain('hidden');
    expect(out).not.toContain('CDATA');
  });

  it('passes through CDATA adjacent to scrubbed content', () => {
    const filter = createXmlStreamFilter();
    const out = run(filter, 'before<context>gone</context><![CDATA[kept]]>after');
    expect(out).toContain('<![CDATA[kept]]>');
    expect(out).not.toContain('gone');
  });

  // --- XML comments ---

  it('passes through XML comments outside scrubbed tags', () => {
    const filter = createXmlStreamFilter();
    const out = run(filter, '<!-- a comment -->text');
    expect(out).toContain('<!-- a comment -->');
    expect(out).toContain('text');
  });

  it('suppresses XML comments inside scrubbed tags', () => {
    const filter = createXmlStreamFilter();
    const out = run(filter, '<context><!-- hidden comment -->secret</context>visible');
    expect(out).toContain('visible');
    expect(out).not.toContain('hidden comment');
  });

  it('passes through comments interleaved with normal content', () => {
    const filter = createXmlStreamFilter();
    const out = run(filter, 'a<!-- note -->b');
    expect(out).toContain('<!-- note -->');
    expect(out).toContain('a');
    expect(out).toContain('b');
  });

  // --- Pathological nesting depth ---

  it('emits onWarning when nesting depth exceeds maxXmlNestingDepth', () => {
    const onWarning = vi.fn<(message: string) => void>();
    const filter = createXmlStreamFilter({ maxXmlNestingDepth: 2, onWarning });

    // depth 1: <a>, depth 2: <b>, depth 3: <c> — exceeds limit of 2
    run(filter, '<a><b><c>too deep</c></b></a>');

    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('maxXmlNestingDepth'),
      expect.objectContaining({ maxXmlNestingDepth: 2 }),
    );
  });

  it('suppresses content that exceeds maxXmlNestingDepth', () => {
    const filter = createXmlStreamFilter({ maxXmlNestingDepth: 2 });

    // depth 1: <outer>, depth 2: <inner>, depth 3: <deep> — triggers suppression
    const out = filter.write('<outer><inner><deep>hidden</deep></inner></outer>');
    filter.end();

    expect(out).not.toContain('hidden');
  });

  it('respects maxXmlNestingDepth of 0 (unlimited — no warning ever)', () => {
    const onWarning = vi.fn<(message: string) => void>();
    const filter = createXmlStreamFilter({ maxXmlNestingDepth: 0, onWarning });

    // Even very deep nesting should not trigger a warning
    const deep = '<a>'.repeat(200) + 'content' + '</a>'.repeat(200);
    const out = run(filter, deep);

    expect(onWarning).not.toHaveBeenCalled();
    expect(out).toContain('content');
  });

  // --- Large documents ---

  it('handles a large document with many non-scrubbed tags', () => {
    const filter = createXmlStreamFilter();

    // 500 non-scrubbed elements
    const parts: string[] = [];
    for (let i = 0; i < 500; i++) {
      parts.push(`<item>value${i}</item>`);
    }
    const doc = parts.join('');
    const out = run(filter, doc);

    expect(out).toContain('value0');
    expect(out).toContain('value499');
  });

  it('handles large content streamed chunk by chunk', () => {
    const filter = createXmlStreamFilter();

    const collected: string[] = [];
    const chunk = '<p>paragraph content here</p>';

    for (let i = 0; i < 100; i++) {
      collected.push(filter.write(chunk));
    }
    collected.push(filter.end());

    const out = collected.join('');
    expect(out.split('paragraph content here').length - 1).toBe(100);
  });

  it('scrubs large amounts of sensitive content efficiently', () => {
    const filter = createXmlStreamFilter();

    const sensitiveBlock = '<context>' + 'secret '.repeat(1000) + '</context>';
    // Collect all output — write(sensitiveBlock) emits buffered 'before' text
    const p1 = filter.write('before');
    const p2 = filter.write(sensitiveBlock);
    const p3 = filter.write('after');
    const tail = filter.end();

    const out = p1 + p2 + p3 + tail;
    expect(out).not.toContain('secret');
    expect(out).toContain('before');
    expect(out).toContain('after');
  });

  // --- Streaming across chunks ---

  it('handles a scrub tag split across multiple write() calls', () => {
    const filter = createXmlStreamFilter();

    // Tag split across chunks
    const p1 = filter.write('<con');
    const p2 = filter.write('text>secret</con');
    const p3 = filter.write('text>visible');
    const tail = filter.end();

    const out = p1 + p2 + p3 + tail;
    expect(out).not.toContain('secret');
    expect(out).toContain('visible');
  });

  it('accumulates output across multiple writes for non-scrubbed content', () => {
    const filter = createXmlStreamFilter();

    const p1 = filter.write('<result>hello ');
    const p2 = filter.write('world</result>');
    const tail = filter.end();

    const out = p1 + p2 + tail;
    expect(out).toContain('hello world');
  });

  // --- Privacy tag enforcement ---

  it('warns and enforces privacy tags when overrideScrubTags omits them', () => {
    const onWarning = vi.fn<(message: string, context?: Record<string, unknown>) => void>();
    const filter = createXmlStreamFilter({
      overrideScrubTags: new Set(['custom']),
      enforcePrivacyTags: true,
      onWarning,
    });

    // userMemory is a PRIVACY_TAG_NAME — must still be scrubbed even when not in override
    const out = run(filter, '<userMemory>private</userMemory>visible');
    expect(out).not.toContain('private');
    expect(out).toContain('visible');
    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('Privacy-sensitive'),
      expect.objectContaining({ missingPrivacyTags: expect.any(Array) }),
    );
  });

  it('allows disabling privacy tag enforcement via enforcePrivacyTags: false', () => {
    const onWarning = vi.fn<(message: string, context?: Record<string, unknown>) => void>();
    const filter = createXmlStreamFilter({
      overrideScrubTags: new Set(['custom']),
      enforcePrivacyTags: false,
      onWarning,
    });

    // With privacy enforcement disabled, userMemory is NOT in the override so it passes through
    const out = run(filter, '<userMemory>visible content</userMemory>');
    expect(out).toContain('visible content');
    expect(onWarning).not.toHaveBeenCalled();
  });
});
