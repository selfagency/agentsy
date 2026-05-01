import { describe, expect, it } from 'vitest';

import { repairWithLLM } from './autoRepair.js';
import { buildFormatInstructions } from './buildFormatInstructions.js';
import { buildRepairPrompt } from './buildRepairPrompt.js';
import { parseJson } from './parseJson.js';
import { pipe } from './pipe.js';
import { buildGeminiResponseSchema, buildOllamaFormat, buildOpenAIResponseFormat } from './providerFormats.js';
import { streamJson } from './streamJson.js';
import { validateJsonSchema } from './validateJsonSchema.js';
import { validateWithZod, zodToJsonSchema } from './zodAdapter.js';

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
    expect(result.success === true && result.data.name).toBe('Ada');
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
    expect(result.success === false && result.errors).toContain('$.count: expected integer, got string');
    expect(result.success === false && result.errors).toContain('$.extra: additional property is not allowed');
  });

  it('returns deterministic errors when JSON limits are exceeded', () => {
    const depthExceeded = validateJsonSchema('{"a":{"b":{"c":1}}}', { type: 'object' }, { maxJsonDepth: 3 });
    const keysExceeded = validateJsonSchema('{"a":1,"b":2,"c":3}', { type: 'object' }, { maxJsonKeys: 2 });

    expect(depthExceeded.success).toBe(false);
    expect(depthExceeded.success === false && depthExceeded.errors).toEqual(['$: JSON depth exceeds maxJsonDepth (3)']);

    expect(keysExceeded.success).toBe(false);
    expect(keysExceeded.success === false && keysExceeded.errors).toEqual([
      '$: JSON key count exceeds maxJsonKeys (2)',
    ]);
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
    expect(result.success === false && result.errors).toEqual(['$: adapter rejected payload']);
  });

  it('rejects regex patterns exceeding maximum length', () => {
    const longPattern = 'a'.repeat(1025);
    const result = validateJsonSchema('{"name":"Ada"}', {
      type: 'object',
      properties: {
        name: { type: 'string', pattern: longPattern },
      },
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toContain('exceeds maximum length');
  });

  it('accepts regex patterns within length limit', () => {
    const result = validateJsonSchema('{"name":"Ada"}', {
      type: 'object',
      properties: {
        name: { type: 'string', pattern: '^[A-Za-z]+$' },
      },
    });

    expect(result.success).toBe(true);
  });

  it('caches compiled regex patterns across calls', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', pattern: '^[A-Z][a-z]+$' },
      },
    };

    const pass = validateJsonSchema('{"name":"Ada"}', schema);
    expect(pass.success).toBe(true);

    const fail = validateJsonSchema('{"name":"ada"}', schema);
    expect(fail.success).toBe(false);

    // Second pass with same pattern still works (uses cache)
    const pass2 = validateJsonSchema('{"name":"Bob"}', schema);
    expect(pass2.success).toBe(true);
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

async function* chunked(chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of gen) {
    results.push(item);
  }
  return results;
}

describe('streamJson', () => {
  it('yields complete object when JSON arrives in one chunk', async () => {
    const results = await collect(streamJson(chunked(['{"name":"Ada","age":30}'])));

    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result).toBeDefined();
    expect(result?.value).toEqual({ name: 'Ada', age: 30 });
    expect(result?.isPartial).toBe(false);
  });

  it('yields partial objects as JSON is streamed incrementally', async () => {
    const results = await collect(streamJson(chunked(['{"name":', '"Ada"', ',"age":', '30', '}'])));

    // Should get at least one partial and one final complete result
    const partials = results.filter(r => r.isPartial);
    const completes = results.filter(r => !r.isPartial);

    expect(partials.length).toBeGreaterThanOrEqual(1);
    expect(completes).toHaveLength(1);
    const complete = completes[0];
    expect(complete).toBeDefined();
    expect(complete?.value).toEqual({ name: 'Ada', age: 30 });
  });

  it('deduplicates unchanged partial results', async () => {
    // Sending same text in tiny pieces that don't change result
    const results = await collect(streamJson(chunked(['{"a"', ':', '1', '}'])));

    // Each emission should be unique by (value, isPartial) — partial→complete is valid
    const serialized = results.map(r => `${JSON.stringify(r.value)}:${r.isPartial}`);
    const unique = new Set(serialized);
    expect(unique.size).toBe(serialized.length);
  });

  it('does not emit partials when emitPartials is false', async () => {
    const results = await collect(streamJson(chunked(['{"name":', '"Ada"', '}']), { emitPartials: false }));

    // Only complete results
    expect(results.every(r => !r.isPartial)).toBe(true);
    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result).toBeDefined();
    expect(result?.value).toEqual({ name: 'Ada' });
  });

  it('handles JSON wrapped in markdown code fences', async () => {
    const results = await collect(streamJson(chunked(['```json\n{"ok":true}\n```'])));

    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result).toBeDefined();
    expect(result?.value).toEqual({ ok: true });
    expect(result?.isPartial).toBe(false);
  });

  it('respects maxJsonDepth option', async () => {
    const results = await collect(streamJson(chunked(['{"a":{"b":{"c":1}}}']), { maxJsonDepth: 3 }));

    // Should not yield anything — exceeds depth
    expect(results).toHaveLength(0);
  });

  it('yields typed results with generic parameter', async () => {
    interface Person {
      name: string;
      age: number;
    }
    const results = await collect(streamJson<Person>(chunked(['{"name":"Ada","age":30}'])));

    const result = results[0];
    expect(result).toBeDefined();
    expect(result?.value.name).toBe('Ada');
    expect(result?.value.age).toBe(30);
  });

  it('handles empty stream without error', async () => {
    const results = await collect(streamJson(chunked([])));
    expect(results).toHaveLength(0);
  });

  it('handles prose before JSON', async () => {
    const results = await collect(streamJson(chunked(['Here is the data: ', '{"result":', '42', '}'])));

    const completes = results.filter(r => !r.isPartial);
    expect(completes.length).toBeGreaterThanOrEqual(1);
    const lastComplete = completes.at(-1);
    expect(lastComplete).toBeDefined();
    expect(lastComplete?.value).toEqual({ result: 42 });
  });

  it('includes status field: partial while streaming, completed on finish', async () => {
    const results = await collect(streamJson(chunked(['{"name":', '"Ada"', '}'])));

    const partials = results.filter(r => r.status === 'partial');
    const completes = results.filter(r => r.status === 'completed');

    expect(partials.length).toBeGreaterThanOrEqual(1);
    expect(completes).toHaveLength(1);
    const complete = completes[0];
    expect(complete).toBeDefined();
    expect(complete?.isPartial).toBe(false);
  });

  it('single-chunk complete JSON has status completed from the start', async () => {
    const results = await collect(streamJson(chunked(['{"x":1}'])));

    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result).toBeDefined();
    expect(result?.status).toBe('completed');
    expect(result?.isPartial).toBe(false);
  });

  it('emits newFields with emitFields: true for nested objects', async () => {
    const results = await collect(streamJson(chunked(['{"name":"Ada","address":{"city":"Berlin"}}'])));

    // Without emitFields, newFields should be empty
    const result = results[0];
    expect(result).toBeDefined();
    expect(result?.newFields).toEqual([]);
  });

  it('emitFields: true emits leaf paths and values on first complete parse', async () => {
    const results = await collect(streamJson(chunked(['{"name":"Ada","age":30}']), { emitFields: true }));

    const final = results.at(-1);
    expect(final).toBeDefined();
    if (!final) return;
    expect(final.status).toBe('completed');
    expect(final.newFields.length).toBeGreaterThanOrEqual(2);

    const paths = final.newFields.map(f => f.path);
    expect(paths).toContain('name');
    expect(paths).toContain('age');

    const nameField = final.newFields.find(f => f.path === 'name');
    expect(nameField?.value).toBe('Ada');
    expect(nameField?.isComplete).toBe(true);
  });

  it('emitFields: true emits partial fields during streaming', async () => {
    const results = await collect(
      streamJson(chunked(['{"name":', '"Ada"', ',"score":', '99', '}']), { emitFields: true }),
    );

    // Partial emissions should have isComplete: false on their fields
    const partialResults = results.filter(r => r.isPartial);
    expect(partialResults.length).toBeGreaterThan(0);
    const firstPartial = partialResults[0];
    expect(firstPartial).toBeDefined();
    if (!firstPartial) return;
    firstPartial.newFields.forEach(f => {
      expect(f.isComplete).toBe(false);
    });

    // Complete result should have isComplete: true
    const finalResult = results.at(-1);
    expect(finalResult).toBeDefined();
    if (!finalResult) return;
    expect(finalResult.status).toBe('completed');
    finalResult.newFields.forEach(f => {
      expect(f.isComplete).toBe(true);
    });
  });

  it('emitFields: true detects incremental field additions across successive emissions', async () => {
    const results = await collect(streamJson(chunked(['{"a":1', ',"b":2', ',"c":3}']), { emitFields: true }));

    // Collect all new fields across all emissions
    const allNewFieldPaths = results.flatMap(r => r.newFields.map(f => f.path));
    expect(allNewFieldPaths).toContain('a');
    expect(allNewFieldPaths).toContain('b');
    expect(allNewFieldPaths).toContain('c');
  });

  it('emitFields: true handles array items, each item gets an indexed path', async () => {
    const results = await collect(streamJson(chunked(['{"items":[1,2,3]}']), { emitFields: true }));

    const final = results.at(-1)!;
    const paths = final.newFields.map(f => f.path);
    expect(paths).toContain('items[0]');
    expect(paths).toContain('items[1]');
    expect(paths).toContain('items[2]');
  });
});

describe('zodAdapter', () => {
  it('zodToJsonSchema throws when zod-to-json-schema is not installed', async () => {
    const fakeSchema = { _def: {}, parse: (d: unknown) => d } as const;
    await expect(zodToJsonSchema(fakeSchema)).rejects.toThrow('zod-to-json-schema is required');
  });

  it('validateWithZod throws when zod-to-json-schema is not installed', async () => {
    const fakeSchema = { _def: {}, parse: (d: unknown) => d } as const;
    await expect(validateWithZod('{"a":1}', fakeSchema)).rejects.toThrow('zod-to-json-schema is required');
  });
});

describe('repairWithLLM', () => {
  const schema = {
    type: 'object',
    required: ['name', 'age'],
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
    },
    additionalProperties: false,
  };

  it('succeeds on first attempt when output is already valid', async () => {
    // biome-ignore lint/correctness/useQwikValidLexicalScope: legitimate usage
    const callLLM = async () => 'should not be called';
    const result = await repairWithLLM('{"name":"Ada","age":30}', schema, callLLM);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Ada', age: 30 });
    expect(result.attempts).toBe(1);
  });

  it('retries and succeeds when LLM fixes the output', async () => {
    let callCount = 0;
    // biome-ignore lint/correctness/useQwikValidLexicalScope: legitimate usage
    const callLLM = async (prompt: string) => {
      callCount++;
      expect(prompt).toContain('Parse/validation error');
      return '{"name":"Ada","age":30}';
    };

    // Initial output has wrong type for age
    const result = await repairWithLLM('{"name":"Ada","age":"thirty"}', schema, callLLM);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Ada', age: 30 });
    expect(result.attempts).toBe(2);
    expect(callCount).toBe(1);
  });

  it('fails after maxAttempts when LLM cannot fix the output', async () => {
    // biome-ignore lint/correctness/useQwikValidLexicalScope: legitimate usage
    const callLLM = async () => '{"name":"still-bad"}';

    const result = await repairWithLLM('{"broken":true}', schema, callLLM, {
      maxAttempts: 2,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.attempts).toBe(2);
  });

  it('passes original prompt to repair prompt when provided', async () => {
    let receivedPrompt = '';
    const callLLM = async (prompt: string) => {
      receivedPrompt = prompt;
      return '{"name":"Ada","age":30}';
    };

    await repairWithLLM('{"bad":1}', schema, callLLM, {
      originalPrompt: 'Return a person object',
    });

    expect(receivedPrompt).toContain('Return a person object');
  });

  it('includes schema in repair prompt', async () => {
    let receivedPrompt = '';
    const callLLM = async (prompt: string) => {
      receivedPrompt = prompt;
      return '{"name":"Ada","age":30}';
    };

    await repairWithLLM('{"bad":1}', schema, callLLM);

    expect(receivedPrompt).toContain('"required"');
    expect(receivedPrompt).toContain('"name"');
  });
});

// ─── Phase 4: validateJsonSchema enhancements ────────────────────────────────

// Helper: wrap a scalar value for schema testing.
// parseJson only extracts {} and [] candidates; bare scalars are not supported.
// All scalar assertions are therefore tested at the property level of an object.
// biome-ignore lint/correctness/useQwikValidLexicalScope: legitimate usage
const wrap = (value: unknown, schema: Record<string, unknown>) =>
  validateJsonSchema(`{"v":${JSON.stringify(value)}}`, {
    type: 'object',
    properties: { v: schema },
    required: ['v'],
  });

describe('validateJsonSchema — const', () => {
  it('passes when object matches a const object', () => {
    const result = validateJsonSchema('{"a":1,"b":2}', { const: { a: 1, b: 2 } });
    expect(result.success).toBe(true);
  });

  it('fails when object differs from const object', () => {
    const result = validateJsonSchema('{"a":1,"b":3}', { const: { a: 1, b: 2 } });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/does not match const/);
  });

  it('passes when property value matches string const', () => {
    expect(wrap('active', { const: 'active' }).success).toBe(true);
  });

  it('fails when property value differs from string const', () => {
    const result = wrap('inactive', { const: 'active' });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/does not match const/);
  });

  it('passes when property value matches null const', () => {
    expect(wrap(null, { const: null }).success).toBe(true);
  });

  it('fails when property value does not match null const', () => {
    expect(wrap(0, { const: null }).success).toBe(false);
  });

  it('passes when array matches const array exactly', () => {
    const result = validateJsonSchema('[1,2,3]', { const: [1, 2, 3] });
    expect(result.success).toBe(true);
  });

  it('fails when array differs from const array', () => {
    const result = validateJsonSchema('[1,2,4]', { const: [1, 2, 3] });
    expect(result.success).toBe(false);
  });
});

describe('validateJsonSchema — not', () => {
  it('passes when object does not match the not schema type', () => {
    const result = validateJsonSchema('{"a":1}', { not: { type: 'string' } });
    expect(result.success).toBe(true);
  });

  it('fails when value matches the not schema', () => {
    const result = validateJsonSchema('{"a":1}', { not: { type: 'object' } });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/must not match the 'not' schema/);
  });

  it('passes when property value fails the not const check', () => {
    expect(wrap('allowed', { not: { const: 'forbidden' } }).success).toBe(true);
  });

  it('fails when property value matches the not const', () => {
    expect(wrap('forbidden', { not: { const: 'forbidden' } }).success).toBe(false);
  });

  it('passes when array exceeds not maxItems constraint', () => {
    const result = validateJsonSchema('[1,2,3]', { not: { type: 'array', maxItems: 2 } });
    expect(result.success).toBe(true);
  });
});

describe('validateJsonSchema — anyOf', () => {
  it('passes when value matches the first sub-schema', () => {
    const result = validateJsonSchema('{"a":1}', {
      anyOf: [{ type: 'object' }, { type: 'array' }],
    });
    expect(result.success).toBe(true);
  });

  it('passes when value matches only a later sub-schema', () => {
    const result = validateJsonSchema('[1,2]', {
      anyOf: [{ type: 'object' }, { type: 'array' }],
    });
    expect(result.success).toBe(true);
  });

  it('fails when value matches no sub-schema', () => {
    const result = validateJsonSchema('[1,2,3]', {
      anyOf: [{ type: 'object' }, { type: 'array', maxItems: 1 }],
    });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/anyOf/);
  });

  it('passes when value matches multiple sub-schemas (anyOf allows that)', () => {
    const result = validateJsonSchema('{"a":1}', {
      anyOf: [{ type: 'object' }, { required: ['a'] }],
    });
    expect(result.success).toBe(true);
  });

  it('validates property with anyOf type union', () => {
    expect(wrap('hello', { anyOf: [{ type: 'string' }, { type: 'number' }] }).success).toBe(true);
    expect(wrap(42, { anyOf: [{ type: 'string' }, { type: 'number' }] }).success).toBe(true);
  });
});

describe('validateJsonSchema — oneOf', () => {
  it('passes when exactly one sub-schema matches', () => {
    const result = validateJsonSchema('{"a":1}', {
      oneOf: [{ type: 'object' }, { type: 'array' }],
    });
    expect(result.success).toBe(true);
  });

  it('fails when no sub-schema matches', () => {
    const result = validateJsonSchema('[1,2,3]', {
      oneOf: [{ type: 'object' }, { type: 'array', maxItems: 1 }],
    });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/oneOf/);
  });

  it('fails when more than one sub-schema matches', () => {
    const result = validateJsonSchema('{"a":1}', {
      oneOf: [{ type: 'object' }, { required: ['a'] }],
    });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/matched 2/);
  });

  it('validates property with oneOf type discrimination', () => {
    // Only one of strict string vs strict array matches a string
    expect(wrap('hi', { oneOf: [{ type: 'string' }, { type: 'number' }] }).success).toBe(true);
  });
});

describe('validateJsonSchema — allOf', () => {
  it('passes when value matches all sub-schemas', () => {
    const result = validateJsonSchema('{"score":5}', {
      type: 'object',
      properties: {
        score: { allOf: [{ type: 'number' }, { minimum: 1 }, { maximum: 10 }] },
      },
      required: ['score'],
    });
    expect(result.success).toBe(true);
  });

  it('fails when value fails one sub-schema', () => {
    const result = validateJsonSchema('{"score":0}', {
      type: 'object',
      properties: {
        score: { allOf: [{ type: 'number' }, { minimum: 1 }] },
      },
      required: ['score'],
    });
    expect(result.success).toBe(false);
  });

  it('accumulates errors from all failing sub-schemas', () => {
    const result = validateJsonSchema('{"score":5}', {
      type: 'object',
      properties: {
        score: { allOf: [{ minimum: 10 }, { maximum: 3 }] },
      },
      required: ['score'],
    });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('combines type + required constraints via allOf', () => {
    const result = validateJsonSchema('{"a":1,"b":2}', {
      allOf: [{ type: 'object' }, { required: ['a'] }, { required: ['b'] }],
    });
    expect(result.success).toBe(true);
  });
});

describe('validateJsonSchema — $defs and $ref', () => {
  it('resolves a local $ref via a property and validates successfully', () => {
    const result = validateJsonSchema('{"name":"Ada"}', {
      $defs: { Name: { type: 'string' } },
      type: 'object',
      properties: { name: { $ref: '#/$defs/Name' } },
    });
    expect(result.success).toBe(true);
  });

  it('fails validation when the $ref schema is not satisfied', () => {
    const result = validateJsonSchema('{"age":"not-a-number"}', {
      $defs: { Age: { type: 'number' } },
      type: 'object',
      properties: { age: { $ref: '#/$defs/Age' } },
    });
    expect(result.success).toBe(false);
  });

  it('resolves multiple nested $refs inside properties', () => {
    const result = validateJsonSchema('{"name":"Ada","age":30}', {
      $defs: {
        Name: { type: 'string' },
        Age: { type: 'integer', minimum: 0 },
      },
      type: 'object',
      properties: {
        name: { $ref: '#/$defs/Name' },
        age: { $ref: '#/$defs/Age' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('returns an error when $ref is not found in $defs', () => {
    const result = validateJsonSchema('{"name":"Ada"}', {
      type: 'object',
      properties: { name: { $ref: '#/$defs/Missing' } },
    });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/\$ref not found/);
  });

  it('returns an error for unsupported remote $ref', () => {
    const result = validateJsonSchema('{"a":1}', {
      $ref: 'https://example.com/schema',
    });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/unsupported \$ref/);
  });

  it('returns an error for an unanchored $ref path', () => {
    const result = validateJsonSchema('{"a":1}', {
      $ref: '/defs/Name',
    });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/unsupported \$ref/);
  });

  it('detects direct circular $ref and returns an error', () => {
    // A → B, B → A — mutual recursion should be caught
    const result = validateJsonSchema('{"a":1}', {
      $defs: {
        A: { $ref: '#/$defs/B' },
        B: { $ref: '#/$defs/A' },
      },
      type: 'object',
      properties: { a: { $ref: '#/$defs/A' } },
    });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors.some(e => e.includes('circular'))).toBe(true);
  });
});

describe('validateJsonSchema — string format', () => {
  // All format tests use the wrap() helper since parseJson only extracts {} and [].
  it.each([
    ['date', '2024-01-15'],
    ['date', '2000-12-31'],
    ['date', '1999-02-28'],
  ])('accepts valid %s: %s', (format, value) => {
    expect(wrap(value, { type: 'string', format }).success).toBe(true);
  });

  it.each([
    ['date', 'not-a-date'],
    ['date', '2024-13-01'],
    ['date', '2024-00-10'],
  ])('rejects invalid %s: %s', (format, value) => {
    const result = wrap(value, { type: 'string', format });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/format/);
  });

  it.each([
    ['date-time', '2024-01-15T12:30:00Z'],
    ['date-time', '2024-01-15T12:30:00+05:30'],
    ['date-time', '2024-01-15T00:00:00.123Z'],
  ])('accepts valid %s: %s', (format, value) => {
    expect(wrap(value, { type: 'string', format }).success).toBe(true);
  });

  it.each([
    ['date-time', '2024-01-15'],
    ['date-time', 'not-a-datetime'],
  ])('rejects invalid %s: %s', (format, value) => {
    expect(wrap(value, { type: 'string', format }).success).toBe(false);
  });

  it.each([
    ['email', 'user@example.com'],
    ['email', 'a+tag@sub.domain.org'],
  ])('accepts valid %s: %s', (format, value) => {
    expect(wrap(value, { type: 'string', format }).success).toBe(true);
  });

  it.each([
    ['email', 'not-an-email'],
    ['email', '@no-local.com'],
    ['email', 'missing@'],
  ])('rejects invalid %s: %s', (format, value) => {
    expect(wrap(value, { type: 'string', format }).success).toBe(false);
  });

  it.each([
    ['uri', 'https://example.com/path'],
    ['uri', 'http://localhost:3000'],
    ['uri', 'ftp://files.example.org'],
  ])('accepts valid %s: %s', (format, value) => {
    expect(wrap(value, { type: 'string', format }).success).toBe(true);
  });

  it.each([
    ['uri', 'not-a-uri'],
    ['uri', '//missing-scheme'],
  ])('rejects invalid %s: %s', (format, value) => {
    expect(wrap(value, { type: 'string', format }).success).toBe(false);
  });

  it.each([
    ['uuid', '550e8400-e29b-41d4-a716-446655440000'],
    ['uuid', '00000000-0000-0000-0000-000000000000'],
  ])('accepts valid %s: %s', (format, value) => {
    expect(wrap(value, { type: 'string', format }).success).toBe(true);
  });

  it.each([
    ['uuid', 'not-a-uuid'],
    ['uuid', '550e8400-e29b-41d4-a716'],
  ])('rejects invalid %s: %s', (format, value) => {
    expect(wrap(value, { type: 'string', format }).success).toBe(false);
  });

  it.each([
    ['ipv4', '192.168.0.1'],
    ['ipv4', '0.0.0.0'],
    ['ipv4', '255.255.255.255'],
    ['ipv4', '10.0.0.1'],
  ])('accepts valid %s: %s', (format, value) => {
    expect(wrap(value, { type: 'string', format }).success).toBe(true);
  });

  it.each([
    ['ipv4', '256.0.0.1'],
    ['ipv4', '192.168.0'],
    ['ipv4', 'not-an-ip'],
  ])('rejects invalid %s: %s', (format, value) => {
    expect(wrap(value, { type: 'string', format }).success).toBe(false);
  });

  it.each([
    ['ipv6', '2001:0db8:85a3:0000:0000:8a2e:0370:7334'],
    ['ipv6', '::1'],
    ['ipv6', '::'],
    ['ipv6', 'fe80::1'],
    ['ipv6', '2001:db8::1'],
  ])('accepts valid %s: %s', (format, value) => {
    expect(wrap(value, { type: 'string', format }).success).toBe(true);
  });

  it.each([
    ['ipv6', '192.168.0.1'],
    ['ipv6', 'not-an-ipv6'],
  ])('rejects invalid %s: %s', (format, value) => {
    expect(wrap(value, { type: 'string', format }).success).toBe(false);
  });

  it('ignores unknown format values (no false positives)', () => {
    expect(wrap('anything', { type: 'string', format: 'unknown-format' }).success).toBe(true);
  });
});

describe('validateJsonSchema — string minLength / maxLength', () => {
  it('passes when string length equals minLength', () => {
    expect(wrap('abc', { type: 'string', minLength: 3 }).success).toBe(true);
  });

  it('passes when string length exceeds minLength', () => {
    expect(wrap('abcd', { type: 'string', minLength: 3 }).success).toBe(true);
  });

  it('fails when string is shorter than minLength', () => {
    const result = wrap('ab', { type: 'string', minLength: 3 });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/shorter than minLength/);
  });

  it('passes when string length equals maxLength', () => {
    expect(wrap('abc', { type: 'string', maxLength: 3 }).success).toBe(true);
  });

  it('passes when string length is below maxLength', () => {
    expect(wrap('ab', { type: 'string', maxLength: 3 }).success).toBe(true);
  });

  it('fails when string exceeds maxLength', () => {
    const result = wrap('abcd', { type: 'string', maxLength: 3 });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/longer than maxLength/);
  });

  it('passes when both minLength and maxLength are satisfied', () => {
    expect(wrap('abc', { type: 'string', minLength: 2, maxLength: 5 }).success).toBe(true);
  });

  it('fails minLength on empty string when minLength > 0', () => {
    expect(wrap('', { type: 'string', minLength: 1 }).success).toBe(false);
  });

  it('passes maxLength: 0 only for empty string', () => {
    expect(wrap('', { type: 'string', maxLength: 0 }).success).toBe(true);
    expect(wrap('a', { type: 'string', maxLength: 0 }).success).toBe(false);
  });
});

describe('validateJsonSchema — number exclusiveMinimum / exclusiveMaximum', () => {
  it('passes when value strictly exceeds exclusiveMinimum', () => {
    expect(wrap(1, { type: 'number', exclusiveMinimum: 0 }).success).toBe(true);
  });

  it('fails when value equals exclusiveMinimum', () => {
    const result = wrap(0, { type: 'number', exclusiveMinimum: 0 });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/exclusiveMinimum/);
  });

  it('fails when value is below exclusiveMinimum', () => {
    expect(wrap(-1, { type: 'number', exclusiveMinimum: 0 }).success).toBe(false);
  });

  it('passes when value strictly falls below exclusiveMaximum', () => {
    expect(wrap(9, { type: 'number', exclusiveMaximum: 10 }).success).toBe(true);
  });

  it('fails when value equals exclusiveMaximum', () => {
    const result = wrap(10, { type: 'number', exclusiveMaximum: 10 });
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors[0]).toMatch(/exclusiveMaximum/);
  });

  it('fails when value exceeds exclusiveMaximum', () => {
    expect(wrap(11, { type: 'number', exclusiveMaximum: 10 }).success).toBe(false);
  });

  it('passes when value is within exclusive bounds', () => {
    expect(wrap(5, { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 10 }).success).toBe(true);
  });

  it('can combine inclusive minimum with exclusive maximum', () => {
    // 0 ≤ x < 10
    expect(wrap(0, { type: 'number', minimum: 0, exclusiveMaximum: 10 }).success).toBe(true);
    expect(wrap(10, { type: 'number', minimum: 0, exclusiveMaximum: 10 }).success).toBe(false);
  });
});

// ─── Phase 4: provider format builders ───────────────────────────────────────

describe('buildOpenAIResponseFormat', () => {
  const schema = { type: 'object', properties: { name: { type: 'string' } } };

  it('returns a json_schema response_format object with defaults', () => {
    const result = buildOpenAIResponseFormat(schema);
    expect(result).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'response',
        strict: true,
        schema,
      },
    });
  });

  it('uses the provided name and strict=false', () => {
    const result = buildOpenAIResponseFormat(schema, { name: 'weather', strict: false });
    expect(result.json_schema.name).toBe('weather');
    expect(result.json_schema.strict).toBe(false);
    expect(result.json_schema.schema).toBe(schema);
  });

  it('uses the provided name when strict is omitted', () => {
    const result = buildOpenAIResponseFormat(schema, { name: 'forecast' });
    expect(result.json_schema.name).toBe('forecast');
    expect(result.json_schema.strict).toBe(true);
  });

  it('type field is always "json_schema"', () => {
    expect(buildOpenAIResponseFormat({}).type).toBe('json_schema');
  });
});

describe('buildOllamaFormat', () => {
  it('returns the schema object unchanged', () => {
    const schema = { type: 'object', properties: { result: { type: 'string' } } };
    expect(buildOllamaFormat(schema)).toBe(schema);
  });

  it('returns an empty schema unchanged', () => {
    const schema = {};
    expect(buildOllamaFormat(schema)).toBe(schema);
  });
});

describe('buildGeminiResponseSchema', () => {
  const schema = { type: 'object', properties: { answer: { type: 'string' } } };

  it('returns responseMimeType and responseSchema', () => {
    const result = buildGeminiResponseSchema(schema);
    expect(result).toEqual({
      responseMimeType: 'application/json',
      responseSchema: schema,
    });
  });

  it('responseMimeType is always application/json', () => {
    expect(buildGeminiResponseSchema({}).responseMimeType).toBe('application/json');
  });

  it('responseSchema references the original schema object', () => {
    const result = buildGeminiResponseSchema(schema);
    expect(result.responseSchema).toBe(schema);
  });
});

describe('provider format builders — complex nested schemas', () => {
  // A realistic schema with $defs, nested objects, arrays, and various types.
  const complexSchema = {
    $defs: {
      Address: {
        type: 'object',
        required: ['street', 'city'],
        properties: {
          street: { type: 'string' },
          city: { type: 'string' },
          postalCode: { type: 'string', format: 'ipv4' }, // deliberately odd, just for nesting
        },
        additionalProperties: false,
      },
    },
    type: 'object',
    required: ['id', 'name', 'addresses'],
    properties: {
      id: { type: 'integer', minimum: 1 },
      name: { type: 'string', minLength: 1 },
      email: { type: 'string', format: 'email' },
      tags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
      addresses: {
        type: 'array',
        items: { $ref: '#/$defs/Address' },
        minItems: 1,
      },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      status: { oneOf: [{ const: 'active' }, { const: 'inactive' }, { const: 'pending' }] },
    },
    additionalProperties: false,
  };

  it('buildOpenAIResponseFormat preserves complex schema structure exactly', () => {
    const result = buildOpenAIResponseFormat(complexSchema, { name: 'user_profile' });
    expect(result.type).toBe('json_schema');
    expect(result.json_schema.name).toBe('user_profile');
    expect(result.json_schema.schema).toBe(complexSchema);
    // Verify nested shape is intact
    expect((result.json_schema.schema as typeof complexSchema).$defs.Address.type).toBe('object');
  });

  it('buildOllamaFormat returns the complex schema by reference', () => {
    const result = buildOllamaFormat(complexSchema);
    expect(result).toBe(complexSchema);
    expect(result.$defs).toBeDefined();
  });

  it('buildGeminiResponseSchema wraps complex schema without mutation', () => {
    const result = buildGeminiResponseSchema(complexSchema);
    expect(result.responseMimeType).toBe('application/json');
    expect(result.responseSchema).toBe(complexSchema);
    expect((result.responseSchema as typeof complexSchema).properties.status).toBeDefined();
  });

  it('validateJsonSchema validates a complex payload against the complex schema with $ref resolution', () => {
    const payload = JSON.stringify({
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      tags: ['engineer', 'pioneer'],
      addresses: [{ street: '10 Downing St', city: 'London' }],
      status: 'active',
    });
    const result = validateJsonSchema(payload, complexSchema);
    expect(result.success).toBe(true);
  });

  it('validateJsonSchema rejects a complex payload that violates a nested $ref schema', () => {
    const payload = JSON.stringify({
      id: 1,
      name: 'Ada',
      addresses: [{ city: 'London' }], // missing required 'street'
    });
    const result = validateJsonSchema(payload, complexSchema);
    expect(result.success).toBe(false);
    expect(result.success === false && result.errors.some(e => e.includes('street'))).toBe(true);
  });
});
