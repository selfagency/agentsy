/**
 * Integration: structured output + formatting + context utilities
 *
 * Tests parsing, validation, repair prompts, and display formatting
 * across @agentsy/core/structured, @agentsy/core/formatting, and @agentsy/core/context.
 */
import { describe, expect, it } from 'vitest';

import { dedupeXmlContextBlocksByTag, splitLeadingXmlContextBlocks, stripXmlContextTags } from '@agentsy/core/context';
import {
  appendToBlockquote,
  formatXmlLikeResponseForDisplay,
  sanitizeNonStreamingModelOutput,
} from '@agentsy/core/formatting';
import { buildRepairPrompt, parseJson, validateJsonSchema } from '@agentsy/core/structured';

// ---------------------------------------------------------------------------
// parseJson
// ---------------------------------------------------------------------------

describe('parseJson', () => {
  it('parses a plain JSON object string', () => {
    const result = parseJson<{ name: string }>('{"name":"Alice"}');
    expect(result).toEqual({ name: 'Alice' });
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const input = '```json\n{"value":42}\n```';
    const result = parseJson<{ value: number }>(input);
    expect(result).toEqual({ value: 42 });
  });

  it('parses JSON embedded in surrounding prose (selectMostComprehensive=false)', () => {
    const input = 'Sure! Here it is: {"status":"ok"} — hope that helps.';
    const result = parseJson<{ status: string }>(input);
    expect(result).toEqual({ status: 'ok' });
  });

  it('returns null for non-JSON text', () => {
    const result = parseJson('just plain text with no json');
    expect(result).toBeNull();
  });

  it('handles nested objects and arrays', () => {
    const json = '{"items":[1,2,3],"meta":{"total":3}}';
    const result = parseJson<{ items: number[]; meta: { total: number } }>(json);
    expect(result?.items).toEqual([1, 2, 3]);
    expect(result?.meta.total).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// validateJsonSchema
// ---------------------------------------------------------------------------

describe('validateJsonSchema', () => {
  const schema = {
    type: 'object',
    required: ['name', 'age'],
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
  };

  it('returns no errors for a valid object', () => {
    const result = validateJsonSchema('{"name":"Bob","age":30}', schema);
    expect(result.success).toBe(true);
  });

  it('reports missing required fields', () => {
    const result = validateJsonSchema('{"name":"Bob"}', schema);
    expect(result.success).toBe(false);
    expect(!result.success && result.errors.some(e => e.includes('age'))).toBe(true);
  });

  it('reports type mismatches', () => {
    const result = validateJsonSchema('{"name":"Bob","age":"thirty"}', schema);
    expect(result.success).toBe(false);
  });

  it('returns no errors for an empty schema (any value allowed)', () => {
    const result = validateJsonSchema('{"anything":true}', {});
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildRepairPrompt
// ---------------------------------------------------------------------------

describe('buildRepairPrompt', () => {
  it('includes the parse error in the output', () => {
    const prompt = buildRepairPrompt({
      failedOutput: '{broken json',
      error: 'Unexpected end of JSON input',
    });

    expect(prompt).toContain('Unexpected end of JSON input');
    expect(prompt).toContain('{broken json');
  });

  it('includes the JSON schema when provided', () => {
    const schema = { type: 'object', required: ['id'] };
    const prompt = buildRepairPrompt({
      failedOutput: '{}',
      error: 'Missing required field: id',
      schema,
    });

    expect(prompt).toContain('"id"');
  });

  it('includes the original prompt when provided', () => {
    const prompt = buildRepairPrompt({
      failedOutput: '{}',
      error: 'err',
      originalPrompt: 'Return a user object',
    });

    expect(prompt).toContain('Return a user object');
  });
});

// ---------------------------------------------------------------------------
// formatXmlLikeResponseForDisplay
// ---------------------------------------------------------------------------

describe('formatXmlLikeResponseForDisplay', () => {
  it('converts XML-like blocks to bold markdown titles + content', () => {
    const input = '<analysis>The code looks good.</analysis>';
    const out = formatXmlLikeResponseForDisplay(input);

    expect(out).toContain('**Analysis**');
    expect(out).toContain('The code looks good.');
  });

  it('passes through plain text without XML', () => {
    const input = 'No XML here at all.';
    const out = formatXmlLikeResponseForDisplay(input);
    expect(out).toBe(input);
  });

  it('converts snake_case tag names to title-cased words', () => {
    const input = '<code_review>Looks good.</code_review>';
    const out = formatXmlLikeResponseForDisplay(input);
    expect(out).toContain('**Code review**');
  });
});

// ---------------------------------------------------------------------------
// sanitizeNonStreamingModelOutput
// ---------------------------------------------------------------------------

describe('sanitizeNonStreamingModelOutput', () => {
  it('strips context tags and formats display XML in one pass', () => {
    const input = '<context>hidden info</context><analysis>visible content</analysis>';
    const out = sanitizeNonStreamingModelOutput(input);

    expect(out).not.toContain('hidden info');
    expect(out).toContain('**Analysis**');
    expect(out).toContain('visible content');
  });

  it('passes through plain text unchanged', () => {
    const input = 'Just a plain answer.';
    expect(sanitizeNonStreamingModelOutput(input)).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// appendToBlockquote
// ---------------------------------------------------------------------------

describe('appendToBlockquote', () => {
  it('prefixes each line with "> "', () => {
    const out = appendToBlockquote('line one\nline two', true);
    expect(out).toBe('> line one\n> line two');
  });

  it('handles a single line', () => {
    expect(appendToBlockquote('single', true)).toBe('> single');
  });
});

// ---------------------------------------------------------------------------
// stripXmlContextTags (@agentsy/core/context)
// ---------------------------------------------------------------------------

describe('stripXmlContextTags', () => {
  it('removes context-tagged blocks from text', () => {
    const out = stripXmlContextTags('<context>this is private</context>visible');
    expect(out).toBe('visible');
  });

  it('passes text with no tags through unchanged', () => {
    expect(stripXmlContextTags('no tags here')).toBe('no tags here');
  });
});

// ---------------------------------------------------------------------------
// splitLeadingXmlContextBlocks (@agentsy/core/context)
// ---------------------------------------------------------------------------

describe('splitLeadingXmlContextBlocks', () => {
  it('separates leading XML blocks from trailing non-XML content', () => {
    const input = '<environment_info>meta info</environment_info>actual response here';
    const { contextBlocks, remaining } = splitLeadingXmlContextBlocks(input);

    expect(contextBlocks.length).toBeGreaterThan(0);
    expect(remaining.trim()).toBe('actual response here');
  });

  it('returns empty contextBlocks when text starts with prose', () => {
    const { contextBlocks, remaining } = splitLeadingXmlContextBlocks('just text <b>here</b>');
    expect(contextBlocks).toHaveLength(0);
    expect(remaining).toBe('just text <b>here</b>');
  });
});

// ---------------------------------------------------------------------------
// dedupeXmlContextBlocksByTag (@agentsy/core/context)
// ---------------------------------------------------------------------------

describe('dedupeXmlContextBlocksByTag', () => {
  it('removes duplicate context blocks with the same tag name', () => {
    const blocks = ['<memory>first</memory>', '<memory>second</memory>'];

    const out = dedupeXmlContextBlocksByTag(blocks);
    // Only one <memory> block should remain
    const count = out.filter(b => b.includes('<memory>')).length;
    expect(count).toBe(1);
  });

  it('passes through text with no duplicate tags', () => {
    const blocks = ['<ctx>unique</ctx>'];
    const out = dedupeXmlContextBlocksByTag(blocks);
    expect(out.join('')).toContain('unique');
  });
});
