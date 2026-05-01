import { describe, expect, it } from 'vitest';

import { extractXmlToolCalls } from './extractXmlToolCalls.js';

// Helper to extract and verify tool calls
function extract(xmlText: string, knownTools: string[]) {
  return extractXmlToolCalls(xmlText, new Set(knownTools));
}

describe('extractXmlToolCalls', () => {
  it('extracts a single bare XML tool call with parameters', () => {
    const xmlText = '<search_files><query>foo bar</query><path>/src</path></search_files>';
    const result = extract(xmlText, ['search_files']);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'search_files',
      parameters: { query: 'foo bar', path: '/src' },
      format: 'bare-xml',
    });
  });

  it('extracts multiple sequential tool calls in order', () => {
    const xmlText = '<read_file><path>a.ts</path></read_file><read_file><path>b.ts</path></read_file>';
    const result = extract(xmlText, ['read_file']);

    expect(result).toHaveLength(2);
    expect(result[0]?.parameters.path).toBe('a.ts');
    expect(result[1]?.parameters.path).toBe('b.ts');
  });

  it('ignores tags not in known tools set', () => {
    const xmlText = '<unknown_tool><x>y</x></unknown_tool><search_files><query>q</query></search_files>';
    const result = extract(xmlText, ['search_files']);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('search_files');
  });

  it('strips markdown XML fences and leading prose before extraction', () => {
    const xmlText = 'I will search for that.\n```xml\n<search_files><query>hello</query></search_files>\n```';
    const result = extract(xmlText, ['search_files']);

    expect(result).toHaveLength(1);
    expect(result[0]?.parameters.query).toBe('hello');
  });

  it('handles tool calls with no parameters', () => {
    const xmlText = '<list_tools></list_tools>';
    const result = extract(xmlText, ['list_tools']);

    expect(result).toEqual([{ name: 'list_tools', parameters: {}, format: 'bare-xml' }]);
  });

  it('tolerates attributes/newlines/space-before-close variations', () => {
    const xmlText = '<search_files id="1"\n><query>x</query></search_files >';
    const result = extract(xmlText, ['search_files']);

    expect(result).toHaveLength(1);
    expect(result[0]?.parameters.query).toBe('x');
  });

  it('extracts JSON-wrapped toolCall payload', () => {
    const xmlText = '<toolCall>{"name":"semantic_search","arguments":{"query":"test"}}</toolCall>';
    const result = extract(xmlText, ['semantic_search']);

    expect(result).toEqual([
      {
        name: 'semantic_search',
        parameters: { query: 'test' },
        format: 'json-wrapped',
      },
    ]);
  });

  it('extracts JSON-wrapped tool_call payload', () => {
    const xmlText = '<tool_call>{"name":"read_file","arguments":{"path":"a.ts"}}</tool_call>';
    const result = extract(xmlText, ['read_file']);

    expect(result).toEqual([
      {
        name: 'read_file',
        parameters: { path: 'a.ts' },
        format: 'json-wrapped',
      },
    ]);
  });

  it('returns empty array for malformed wrapped JSON', () => {
    const result = extract('<toolCall>{"name":</toolCall>', ['semantic_search']);
    expect(result).toEqual([]);
  });

  it('returns empty array when known tools set is empty', () => {
    const xmlText = '<search_files><query>x</query></search_files>';
    const result = extract(xmlText, []);
    expect(result).toEqual([]);
  });

  // ── Qwen / Hermes-style ──────────────────────────────────────────────────

  it('extracts Hermes-style tool_call with reasoning preamble (Qwen3)', () => {
    const xmlText =
      '<think>\nI need to search for the file.\n</think>\n<tool_call>\n{"name":"search_files","arguments":{"query":"hello","path":"/src"}}\n</tool_call>';
    const result = extract(xmlText, ['search_files']);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'search_files',
      parameters: { query: 'hello', path: '/src' },
      format: 'json-wrapped',
    });
  });

  it('skips think block and still finds bare-xml tool call (Qwen3 mixed output)', () => {
    const xmlText = '<think>reasoning text</think>\n<read_file><path>a.ts</path></read_file>';
    const result = extract(xmlText, ['read_file']);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'read_file', parameters: { path: 'a.ts' }, format: 'bare-xml' });
  });

  it('extracts multiple Hermes tool_call blocks in sequence (Qwen3)', () => {
    const xmlText =
      '<tool_call>{"name":"read_file","arguments":{"path":"a.ts"}}</tool_call>\n' +
      '<tool_call>{"name":"read_file","arguments":{"path":"b.ts"}}</tool_call>';
    const result = extract(xmlText, ['read_file']);

    expect(result).toHaveLength(2);
    expect(result[0]?.parameters.path).toBe('a.ts');
    expect(result[1]?.parameters.path).toBe('b.ts');
  });

  // ── Bare JSON fallback (Qwen2.5Coder) ────────────────────────────────────

  it('falls back to bare JSON object when model ignores XML prompt (Qwen2.5Coder)', () => {
    const xmlText = '{"name":"search_files","arguments":{"query":"hello world"}}';
    const result = extract(xmlText, ['search_files']);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'search_files',
      parameters: { query: 'hello world' },
      format: 'json-wrapped',
    });
  });

  it('falls back to bare JSON array of tool calls', () => {
    const xmlText =
      '[{"name":"read_file","arguments":{"path":"a.ts"}},{"name":"read_file","arguments":{"path":"b.ts"}}]';
    const result = extract(xmlText, ['read_file']);

    expect(result).toHaveLength(2);
    expect(result[0]?.parameters.path).toBe('a.ts');
    expect(result[1]?.parameters.path).toBe('b.ts');
  });

  it('bare JSON fallback accepts "parameters" key as alias for "arguments"', () => {
    const xmlText = '{"name":"search_files","parameters":{"query":"test"}}';
    const result = extract(xmlText, ['search_files']);

    expect(result).toHaveLength(1);
    expect(result[0]?.parameters).toEqual({ query: 'test' });
  });

  it('bare JSON fallback silently ignores unknown tool names', () => {
    const result = extract('{"name":"unknown_tool","arguments":{"x":"y"}}', ['known_tool']);
    expect(result).toEqual([]);
  });

  it('bare JSON fallback returns empty array for malformed JSON', () => {
    const result = extract('{"name":', ['search_files']);
    expect(result).toEqual([]);
  });
});
