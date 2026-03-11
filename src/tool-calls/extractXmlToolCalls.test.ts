import { describe, expect, it } from 'vitest';

import { extractXmlToolCalls } from './extractXmlToolCalls.js';

describe('extractXmlToolCalls', () => {
  it('extracts a single bare XML tool call with parameters', () => {
    const text = '<search_files><query>foo bar</query><path>/src</path></search_files>';
    const result = extractXmlToolCalls(text, new Set(['search_files']));

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'search_files',
      parameters: { query: 'foo bar', path: '/src' },
      format: 'bare-xml',
    });
  });

  it('extracts multiple sequential tool calls in order', () => {
    const text = '<read_file><path>a.ts</path></read_file><read_file><path>b.ts</path></read_file>';
    const result = extractXmlToolCalls(text, new Set(['read_file']));

    expect(result).toHaveLength(2);
    expect(result[0]?.parameters.path).toBe('a.ts');
    expect(result[1]?.parameters.path).toBe('b.ts');
  });

  it('ignores tags not in known tools set', () => {
    const text = '<unknown_tool><x>y</x></unknown_tool><search_files><query>q</query></search_files>';
    const result = extractXmlToolCalls(text, new Set(['search_files']));

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('search_files');
  });

  it('strips markdown XML fences and leading prose before extraction', () => {
    const text = 'I will search for that.\n```xml\n<search_files><query>hello</query></search_files>\n```';
    const result = extractXmlToolCalls(text, new Set(['search_files']));

    expect(result).toHaveLength(1);
    expect(result[0]?.parameters.query).toBe('hello');
  });

  it('handles tool calls with no parameters', () => {
    const text = '<list_tools></list_tools>';
    const result = extractXmlToolCalls(text, new Set(['list_tools']));

    expect(result).toEqual([{ name: 'list_tools', parameters: {}, format: 'bare-xml' }]);
  });

  it('tolerates attributes/newlines/space-before-close variations', () => {
    const text = '<search_files id="1"\n><query>x</query></search_files >';
    const result = extractXmlToolCalls(text, new Set(['search_files']));

    expect(result).toHaveLength(1);
    expect(result[0]?.parameters.query).toBe('x');
  });

  it('extracts JSON-wrapped toolCall payload', () => {
    const text = '<toolCall>{"name":"semantic_search","arguments":{"query":"test"}}</toolCall>';
    const result = extractXmlToolCalls(text, new Set(['semantic_search']));

    expect(result).toEqual([
      {
        name: 'semantic_search',
        parameters: { query: 'test' },
        format: 'json-wrapped',
      },
    ]);
  });

  it('extracts JSON-wrapped tool_call payload', () => {
    const text = '<tool_call>{"name":"read_file","arguments":{"path":"a.ts"}}</tool_call>';
    const result = extractXmlToolCalls(text, new Set(['read_file']));

    expect(result).toEqual([
      {
        name: 'read_file',
        parameters: { path: 'a.ts' },
        format: 'json-wrapped',
      },
    ]);
  });

  it('returns empty array for malformed wrapped JSON', () => {
    const text = '<toolCall>{"name":</toolCall>';
    const result = extractXmlToolCalls(text, new Set(['semantic_search']));
    expect(result).toEqual([]);
  });

  it('returns empty array when known tools set is empty', () => {
    const text = '<search_files><query>x</query></search_files>';
    const result = extractXmlToolCalls(text, new Set());
    expect(result).toEqual([]);
  });
});
