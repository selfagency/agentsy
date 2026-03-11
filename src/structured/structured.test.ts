import { describe, expect, it } from 'vitest';

import { buildFormatInstructions } from './buildFormatInstructions.js';
import { buildRepairPrompt } from './buildRepairPrompt.js';
import { parseJson } from './parseJson.js';
import { pipe } from './pipe.js';
import { validateJsonSchema } from './validateJsonSchema.js';

describe('parseJson', () => {
  it('extracts JSON from markdown fences and prose', () => {
    const input = 'Here is your result:\n```json\n{"ok":true}\n```';
    expect(parseJson(input)).toEqual({ ok: true });
  });

  it('chooses most comprehensive JSON object when multiple objects are present', () => {
    const input = '{"a":1}\nthen\n{"a":1,"b":{"c":2}}';
    expect(parseJson(input)).toEqual({ a: 1, b: { c: 2 } });
  });

  it('repairs incomplete JSON when enabled', () => {
    const input = 'prefix {"a":[1,2,3}';
    expect(parseJson(input, { repairIncomplete: true })).toEqual({ a: [1, 2, 3] });
  });

  it('returns null when parsed JSON exceeds maxJsonDepth', () => {
    expect(parseJson('{"a":{"b":{"c":1}}}', { maxJsonDepth: 3 })).toBeNull();
  });

  it('returns null when parsed JSON exceeds maxJsonKeys', () => {
    expect(parseJson('{"a":1,"b":2,"c":3}', { maxJsonKeys: 2 })).toBeNull();
  });
});

describe('validateJsonSchema', () => {
  it('returns success for valid payloads', () => {
    const result = validateJsonSchema<{ name: string }>('{"name":"Ada"}', {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
      additionalProperties: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Ada');
    }
  });

  it('returns deterministic errors for invalid payloads', () => {
    const result = validateJsonSchema('{"count":"1","extra":true}', {
      type: 'object',
      required: ['count'],
      properties: {
        count: { type: 'integer' },
      },
      additionalProperties: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContain('$.count: expected integer, got string');
      expect(result.errors).toContain('$.extra: additional property is not allowed');
    }
  });

  it('returns deterministic errors when JSON limits are exceeded', () => {
    const depthExceeded = validateJsonSchema('{"a":{"b":{"c":1}}}', { type: 'object' }, { maxJsonDepth: 3 });
    const keysExceeded = validateJsonSchema('{"a":1,"b":2,"c":3}', { type: 'object' }, { maxJsonKeys: 2 });

    expect(depthExceeded.success).toBe(false);
    if (!depthExceeded.success) {
      expect(depthExceeded.errors).toEqual(['$: JSON depth exceeds maxJsonDepth (3)']);
    }

    expect(keysExceeded.success).toBe(false);
    if (!keysExceeded.success) {
      expect(keysExceeded.errors).toEqual(['$: JSON key count exceeds maxJsonKeys (2)']);
    }
  });

  it('uses external validator adapter when provided', () => {
    const result = validateJsonSchema(
      '{"name":"Ada"}',
      { type: 'object' },
      {
        validator: () => ({ valid: false, errors: ['$: adapter rejected payload'] }),
      },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(['$: adapter rejected payload']);
    }
  });
});

describe('prompt helpers', () => {
  it('buildFormatInstructions includes schema and JSON-only guidance', () => {
    const out = buildFormatInstructions({ type: 'object', properties: { x: { type: 'number' } } });
    expect(out).toContain('valid JSON instance');
    expect(out).toContain('"x"');
  });

  it('buildRepairPrompt includes failed output, error, and schema context', () => {
    const out = buildRepairPrompt({
      failedOutput: '{"x":',
      error: 'Unexpected end of JSON input',
      schema: { type: 'object', properties: { x: { type: 'number' } } },
      originalPrompt: 'Return x',
    });

    expect(out).toContain('Unexpected end of JSON input');
    expect(out).toContain('Failed output');
    expect(out).toContain('Original prompt');
    expect(out).toContain('Required JSON Schema');
  });
});

describe('pipe', () => {
  it('composes parsers left-to-right', () => {
    const parseAndRead = pipe(
      (input: string) => parseJson(input),
      value => (value as { n: number }).n,
      n => n * 2,
    );

    expect(parseAndRead('{"n":4}')).toBe(8);
  });
});
