import { describe, expect, it } from 'vitest';

import { buildXmlToolSystemPrompt } from './buildXmlToolSystemPrompt.js';
import { buildNativeToolsArray } from './buildNativeToolsPayload.js';

const SEARCH_TOOL = {
  name: 'search_files',
  description: 'Search files',
  inputSchema: {
    properties: {
      query: { type: 'string', description: 'search term' },
      path: { type: 'string', description: 'directory to search' },
    },
    required: ['query'],
  },
};

describe('buildXmlToolSystemPrompt', () => {
  it('returns empty string when no tools are provided', () => {
    expect(buildXmlToolSystemPrompt([])).toBe('');
  });

  it('renders xml examples and rules for provided tools (default format)', () => {
    const prompt = buildXmlToolSystemPrompt([SEARCH_TOOL]);

    expect(prompt).toContain('# Tool Use');
    expect(prompt).toContain('<search_files>');
    expect(prompt).toContain('<query>search term</query>');
    expect(prompt).toContain('no markdown fences');
  });

  it('throws for tool names that start with a digit', () => {
    expect(() => buildXmlToolSystemPrompt([{ name: '1tool' }])).toThrow(/Invalid tool name/);
  });

  it('throws for tool names containing dots', () => {
    expect(() => buildXmlToolSystemPrompt([{ name: 'foo.bar' }])).toThrow(/Invalid tool name/);
  });

  it('accepts tool names with letters, digits, underscores, colons, and hyphens', () => {
    expect(() => buildXmlToolSystemPrompt([{ name: 'my_tool-v2:sub' }])).not.toThrow();
  });

  // ── format: 'none' ───────────────────────────────────────────────────────

  it("returns empty string for format 'none' regardless of tools", () => {
    expect(buildXmlToolSystemPrompt([SEARCH_TOOL], { format: 'none' })).toBe('');
  });

  it("returns empty string for format 'none' with empty tools array", () => {
    expect(buildXmlToolSystemPrompt([], { format: 'none' })).toBe('');
  });

  // ── format: 'hermes' (Qwen) ──────────────────────────────────────────────

  it("generates Hermes-style prompt for format 'hermes'", () => {
    const prompt = buildXmlToolSystemPrompt([SEARCH_TOOL], { format: 'hermes' });

    expect(prompt).toContain('function calling AI model');
    expect(prompt).toContain('<tools>');
    expect(prompt).toContain('"name": "search_files"');
    expect(prompt).toContain('<tool_call>');
    expect(prompt).toContain('"arguments"');
    expect(prompt).not.toContain('# Tool Use');
  });

  it('Hermes prompt includes tool JSON schema with description and required fields', () => {
    const prompt = buildXmlToolSystemPrompt([SEARCH_TOOL], { format: 'hermes' });

    expect(prompt).toContain('"search term"');
    expect(prompt).toContain('"required"');
    expect(prompt).toContain('"query"');
  });

  it('Hermes prompt schema includes additionalProperties: false', () => {
    const prompt = buildXmlToolSystemPrompt([SEARCH_TOOL], { format: 'hermes' });

    expect(prompt).toContain('"additionalProperties":false');
  });

  it('Hermes prompt schema includes enum values when present', () => {
    const prompt = buildXmlToolSystemPrompt(
      [
        {
          name: 'set_color',
          inputSchema: {
            properties: { color: { type: 'string', enum: ['red', 'green', 'blue'] } },
          },
        },
      ],
      { format: 'hermes' },
    );

    expect(prompt).toContain('"enum"');
    expect(prompt).toContain('"red"');
    expect(prompt).toContain('"green"');
    expect(prompt).toContain('"blue"');
  });

  it("Hermes prompt throws for invalid tool names just like 'xml' format", () => {
    expect(() => buildXmlToolSystemPrompt([{ name: 'bad.name' }], { format: 'hermes' })).toThrow(/Invalid tool name/);
  });

  it("Hermes prompt returns empty string for empty tools array", () => {
    expect(buildXmlToolSystemPrompt([], { format: 'hermes' })).toBe('');
  });
});

// ── buildNativeToolsArray ────────────────────────────────────────────────────

describe('buildNativeToolsArray', () => {
  it('converts XmlToolInfo to OpenAI-compatible tools array', () => {
    const result = buildNativeToolsArray([SEARCH_TOOL]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'function',
      function: {
        name: 'search_files',
        description: 'Search files',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'search term' },
            path: { type: 'string', description: 'directory to search' },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
    });
  });

  it('omits description field when tool has no description', () => {
    const result = buildNativeToolsArray([{ name: 'ping' }]);

    expect(result[0]?.function.description).toBeUndefined();
  });

  it('omits required field when inputSchema has no required array', () => {
    const result = buildNativeToolsArray([
      { name: 'ping', inputSchema: { properties: { x: { type: 'string' } } } },
    ]);

    expect(result[0]?.function.parameters.required).toBeUndefined();
  });

  it('omits required field for an empty required array', () => {
    const result = buildNativeToolsArray([
      { name: 'ping', inputSchema: { properties: {}, required: [] } },
    ]);

    expect(result[0]?.function.parameters.required).toBeUndefined();
  });

  it('handles empty tools array', () => {
    expect(buildNativeToolsArray([])).toEqual([]);
  });

  it('handles tool with no inputSchema', () => {
    const result = buildNativeToolsArray([{ name: 'list_tools', description: 'Lists tools' }]);

    expect(result[0]?.function.parameters).toEqual({ type: 'object', properties: {}, additionalProperties: false });
  });

  it('always includes additionalProperties: false in parameters', () => {
    const result = buildNativeToolsArray([SEARCH_TOOL]);

    expect(result[0]?.function.parameters.additionalProperties).toBe(false);
  });

  it('passes enum values through to property output', () => {
    const result = buildNativeToolsArray([
      {
        name: 'set_color',
        inputSchema: {
          properties: { color: { type: 'string', description: 'Color', enum: ['red', 'green', 'blue'] } },
          required: ['color'],
        },
      },
    ]);

    expect(result[0]?.function.parameters.properties['color']?.enum).toEqual(['red', 'green', 'blue']);
  });

  it('omits enum field when property has no enum', () => {
    const result = buildNativeToolsArray([SEARCH_TOOL]);

    expect(result[0]?.function.parameters.properties['query']?.enum).toBeUndefined();
  });

  it('converts multiple tools', () => {
    const result = buildNativeToolsArray([
      { name: 'tool_a', description: 'A' },
      { name: 'tool_b', description: 'B' },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]?.function.name).toBe('tool_a');
    expect(result[1]?.function.name).toBe('tool_b');
  });
});

