import { describe, expect, it } from 'vitest';

import { repairWithLLM } from './autoRepair.js';
import { buildFormatInstructions } from './buildFormatInstructions.js';
import { buildRepairPrompt } from './buildRepairPrompt.js';
import { parseJson } from './parseJson.js';
import { pipe } from './pipe.js';
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

  it('rejects regex patterns exceeding maximum length', () => {
    const longPattern = 'a'.repeat(1025);
    const result = validateJsonSchema('{"name":"Ada"}', {
      type: 'object',
      properties: {
        name: { type: 'string', pattern: longPattern },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('exceeds maximum length');
    }
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

describe('streamJson', () => {
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

  it('yields complete object when JSON arrives in one chunk', async () => {
    const results = await collect(streamJson(chunked(['{"name":"Ada","age":30}'])));

    expect(results).toHaveLength(1);
    expect(results[0]!.value).toEqual({ name: 'Ada', age: 30 });
    expect(results[0]!.isPartial).toBe(false);
  });

  it('yields partial objects as JSON is streamed incrementally', async () => {
    const results = await collect(
      streamJson(chunked(['{"name":', '"Ada"', ',"age":', '30', '}'])),
    );

    // Should get at least one partial and one final complete result
    const partials = results.filter(r => r.isPartial);
    const completes = results.filter(r => !r.isPartial);

    expect(partials.length).toBeGreaterThanOrEqual(1);
    expect(completes).toHaveLength(1);
    expect(completes[0]!.value).toEqual({ name: 'Ada', age: 30 });
  });

  it('deduplicates unchanged partial results', async () => {
    // Sending same text in tiny pieces that don't change result
    const results = await collect(
      streamJson(chunked(['{"a"', ':', '1', '}'])),
    );

    // Each emission should be unique by (value, isPartial) — partial→complete is valid
    const serialized = results.map(r => `${JSON.stringify(r.value)}:${r.isPartial}`);
    const unique = new Set(serialized);
    expect(unique.size).toBe(serialized.length);
  });

  it('does not emit partials when emitPartials is false', async () => {
    const results = await collect(
      streamJson(chunked(['{"name":', '"Ada"', '}' ]), { emitPartials: false }),
    );

    // Only complete results
    expect(results.every(r => !r.isPartial)).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0]!.value).toEqual({ name: 'Ada' });
  });

  it('handles JSON wrapped in markdown code fences', async () => {
    const results = await collect(
      streamJson(chunked(['```json\n{"ok":true}\n```'])),
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.value).toEqual({ ok: true });
    expect(results[0]!.isPartial).toBe(false);
  });

  it('respects maxJsonDepth option', async () => {
    const results = await collect(
      streamJson(chunked(['{"a":{"b":{"c":1}}}']), { maxJsonDepth: 3 }),
    );

    // Should not yield anything — exceeds depth
    expect(results).toHaveLength(0);
  });

  it('yields typed results with generic parameter', async () => {
    interface Person { name: string; age: number }
    const results = await collect(
      streamJson<Person>(chunked(['{"name":"Ada","age":30}'])),
    );

    expect(results[0]!.value.name).toBe('Ada');
    expect(results[0]!.value.age).toBe(30);
  });

  it('handles empty stream without error', async () => {
    const results = await collect(streamJson(chunked([])));
    expect(results).toHaveLength(0);
  });

  it('handles prose before JSON', async () => {
    const results = await collect(
      streamJson(chunked(['Here is the data: ', '{"result":', '42', '}'])),
    );

    const completes = results.filter(r => !r.isPartial);
    expect(completes.length).toBeGreaterThanOrEqual(1);
    expect(completes[completes.length - 1]!.value).toEqual({ result: 42 });
  });
});

describe('zodAdapter', () => {
  it('zodToJsonSchema throws when zod-to-json-schema is not installed', async () => {
    const fakeSchema = { _def: {}, parse: (d: unknown) => d } as const;
    await expect(zodToJsonSchema(fakeSchema)).rejects.toThrow('zod-to-json-schema is required');
  });

  it('validateWithZod throws when zod-to-json-schema is not installed', async () => {
    const fakeSchema = { _def: {}, parse: (d: unknown) => d } as const;
    await expect(validateWithZod('{"a":1}', fakeSchema)).rejects.toThrow(
      'zod-to-json-schema is required',
    );
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
    const callLLM = async () => 'should not be called';
    const result = await repairWithLLM('{"name":"Ada","age":30}', schema, callLLM);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Ada', age: 30 });
    expect(result.attempts).toBe(1);
  });

  it('retries and succeeds when LLM fixes the output', async () => {
    let callCount = 0;
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
