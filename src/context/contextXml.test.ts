import { describe, expect, it } from 'vitest';

import { dedupeXmlContextBlocksByTag, splitLeadingXmlContextBlocks, stripXmlContextTags } from './index.js';
import { createXmlStreamFilter } from '../xml-filter/index.js';

describe('createXmlStreamFilter', () => {
  it('strips context tags across chunk boundaries', () => {
    const filter = createXmlStreamFilter();
    const a = filter.write('<environment_info>secret');
    const b = filter.write('</environment_info>');
    const c = filter.write('<code>actual content</code>');
    expect(a + b + c).toBe('<code>actual content</code>');
  });

  it('passes through non-context tags', () => {
    const filter = createXmlStreamFilter();
    const out = filter.write('<code>print("hi")</code>');
    expect(out + filter.end()).toContain('print("hi")');
  });

  it('does not duplicate previous output between write calls', () => {
    const filter = createXmlStreamFilter();
    const first = filter.write('<code>first</code>');
    const second = filter.write('<code>second</code>');
    const end = filter.end();

    expect(first).toBe('<code>first</code>');
    expect(second).not.toContain('first');
    expect(second).toContain('second');
    expect(end).toBe('');
  });

  it('enforces privacy tags when overrideScrubTags omits them', () => {
    const warnings: Array<{ message: string; context?: Record<string, unknown> }> = [];
    const filter = createXmlStreamFilter({
      overrideScrubTags: new Set(['environment_info']),
      onWarning: (message, context) => {
        if (context === undefined) {
          warnings.push({ message });
          return;
        }
        warnings.push({ message, context });
      },
    });

    const out = filter.write('<user_info>secret</user_info><code>safe</code>') + filter.end();
    expect(out).toBe('<code>safe</code>');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain('Privacy-sensitive tags omitted');
  });

  it('allows unsafe override when enforcePrivacyTags is false', () => {
    const filter = createXmlStreamFilter({
      overrideScrubTags: new Set(['environment_info']),
      enforcePrivacyTags: false,
    });

    const out = filter.write('<user_info>secret</user_info><code>safe</code>') + filter.end();
    expect(out).toBe('<user_info>secret</user_info><code>safe</code>');
  });
});

describe('stripXmlContextTags', () => {
  it('removes context tags from complete text', () => {
    const result = stripXmlContextTags('<environment_info>private</environment_info>public');
    expect(result).toBe('public');
  });

  it('strips toolCall wrappers from model output', () => {
    const result = stripXmlContextTags(
      'Before.<toolCall> {"name": "semantic_search", "arguments": {"query": "test"}} </toolCall>After.',
    );
    expect(result).toBe('Before.After.');
  });
});

describe('splitLeadingXmlContextBlocks', () => {
  it('extracts only leading XML context blocks', () => {
    const input = '<user_info>u1</user_info><workspace_info>w1</workspace_info>hello';
    const result = splitLeadingXmlContextBlocks(input);
    expect(result.contextBlocks).toEqual(['<user_info>u1</user_info>', '<workspace_info>w1</workspace_info>']);
    expect(result.remaining).toBe('hello');
  });

  it('does not elevate mid-message XML into context blocks', () => {
    const input = 'hello <user_info>not-context</user_info>';
    const result = splitLeadingXmlContextBlocks(input);
    expect(result.contextBlocks).toEqual([]);
    expect(result.remaining).toBe('hello <user_info>not-context</user_info>');
  });
});

describe('dedupeXmlContextBlocksByTag', () => {
  it('keeps latest occurrence per tag and preserves output order', () => {
    const blocks = [
      '<environment_info>old-env</environment_info>',
      '<workspace_info>w1</workspace_info>',
      '<environment_info>new-env</environment_info>',
      '<user_info>u1</user_info>',
    ];

    const deduped = dedupeXmlContextBlocksByTag(blocks);
    expect(deduped).toEqual([
      '<workspace_info>w1</workspace_info>',
      '<environment_info>new-env</environment_info>',
      '<user_info>u1</user_info>',
    ]);
  });
});
