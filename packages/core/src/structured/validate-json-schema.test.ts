import { describe, expect, it } from 'vitest';
import { validateJsonSchema } from './validate-json-schema.js';

describe('validateJsonSchema', () => {
  it('validates a simple object against a schema', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      },
      required: ['name']
    };

    const result = validateJsonSchema('{"name": "Alice", "age": 30}', schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'Alice', age: 30 });
    }
  });

  it('rejects missing required property', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      required: ['name']
    };

    const result = validateJsonSchema('{"age": 30}', schema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some(e => e.includes('missing required property'))).toBe(true);
    }
  });

  it('rejects invalid type', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    };

    const result = validateJsonSchema('{"name": 42}', schema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some(e => e.includes('expected string'))).toBe(true);
    }
  });

  it('validates nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        address: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            zip: { type: 'string' }
          },
          required: ['city']
        }
      }
    };

    const result = validateJsonSchema('{"address": {"city": "NYC", "zip": "10001"}}', schema);
    expect(result.success).toBe(true);
  });

  it('validates arrays', () => {
    const schema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    };

    const result = validateJsonSchema('{"items": ["a", "b", "c"]}', schema);
    expect(result.success).toBe(true);
  });

  it('rejects invalid array items', () => {
    const schema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { type: 'number' }
        }
      }
    };

    const result = validateJsonSchema('{"items": ["a", 2, 3]}', schema);
    expect(result.success).toBe(false);
  });

  it('validates with enum', () => {
    const schema = {
      type: 'object',
      properties: {
        color: { enum: ['red', 'green', 'blue'] }
      }
    };

    expect(validateJsonSchema('{"color": "red"}', schema).success).toBe(true);
    expect(validateJsonSchema('{"color": "yellow"}', schema).success).toBe(false);
  });

  it('validates with const', () => {
    const schema = {
      type: 'object',
      properties: {
        status: { const: 'active' }
      }
    };

    expect(validateJsonSchema('{"status": "active"}', schema).success).toBe(true);
    expect(validateJsonSchema('{"status": "inactive"}', schema).success).toBe(false);
  });

  it('validates with anyOf', () => {
    const schema = {
      type: 'object',
      properties: {
        value: {
          anyOf: [{ type: 'string' }, { type: 'number' }]
        }
      }
    };

    expect(validateJsonSchema('{"value": "hello"}', schema).success).toBe(true);
    expect(validateJsonSchema('{"value": 42}', schema).success).toBe(true);
    expect(validateJsonSchema('{"value": []}', schema).success).toBe(false);
  });

  it('validates with oneOf', () => {
    const schema = {
      type: 'object',
      properties: {
        value: {
          oneOf: [{ type: 'string' }, { type: 'number' }]
        }
      }
    };

    expect(validateJsonSchema('{"value": "hello"}', schema).success).toBe(true);
    expect(validateJsonSchema('{"value": 42}', schema).success).toBe(true);
    // Matching both should fail oneOf
    expect(
      validateJsonSchema('{"value": "hello"}', {
        type: 'object',
        properties: {
          value: { oneOf: [{ type: 'string' }, { type: 'string', minLength: 2 }] }
        }
      }).success
    ).toBe(false);
  });

  it('validates with allOf', () => {
    const schema = {
      allOf: [
        { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
        { type: 'object', properties: { age: { type: 'number' } }, required: ['age'] }
      ]
    };

    expect(validateJsonSchema('{"name": "Alice", "age": 30}', schema).success).toBe(true);
    expect(validateJsonSchema('{"name": "Alice"}', schema).success).toBe(false);
  });

  it('validates with not', () => {
    const schema = {
      type: 'object',
      properties: {
        value: {
          not: { type: 'string', minLength: 10 }
        }
      }
    };

    expect(validateJsonSchema('{"value": "hello"}', schema).success).toBe(true);
    expect(validateJsonSchema('{"value": "a very long string"}', schema).success).toBe(false);
  });

  it('rejects additional properties when additionalProperties is false', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      additionalProperties: false
    };

    const result = validateJsonSchema('{"name": "Alice", "extra": "bad"}', schema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some(e => e.includes('additional property'))).toBe(true);
    }
  });

  it('validates string minLength and maxLength', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 2, maxLength: 10 }
      }
    };

    expect(validateJsonSchema('{"name": "Al"}', schema).success).toBe(true);
    expect(validateJsonSchema('{"name": "A"}', schema).success).toBe(false);
    expect(validateJsonSchema('{"name": "A very long name here"}', schema).success).toBe(false);
  });

  it('validates string pattern', () => {
    const schema = {
      type: 'object',
      properties: {
        email: { type: 'string', pattern: String.raw`^[a-z]+@[a-z]+\.[a-z]+$` }
      }
    };

    expect(validateJsonSchema('{"email": "alice@example.com"}', schema).success).toBe(true);
    expect(validateJsonSchema('{"email": "not-an-email"}', schema).success).toBe(false);
  });

  it('validates with format specifiers', () => {
    const schema = {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        ip: { type: 'string', format: 'ipv4' },
        uri: { type: 'string', format: 'uri' },
        uuid: { type: 'string', format: 'uuid' },
        date: { type: 'string', format: 'date' }
      }
    };

    const result = validateJsonSchema(
      '{"email": "test@example.com", "ip": "192.168.1.1", "uri": "https://example.com", "uuid": "550e8400-e29b-41d4-a716-446655440000", "date": "2024-01-15"}',
      schema
    );
    expect(result.success).toBe(true);

    expect(validateJsonSchema('{"email": "invalid"}', schema).success).toBe(false);
    expect(validateJsonSchema('{"ip": "999.999.999.999"}', schema).success).toBe(false);
  });

  it('validates number constraints', () => {
    const schema = {
      type: 'object',
      properties: {
        age: { type: 'number', minimum: 0, maximum: 150 }
      }
    };

    expect(validateJsonSchema('{"age": 25}', schema).success).toBe(true);
    expect(validateJsonSchema('{"age": -1}', schema).success).toBe(false);
    expect(validateJsonSchema('{"age": 200}', schema).success).toBe(false);
  });

  it('validates exclusive number constraints', () => {
    const schema = {
      type: 'object',
      properties: {
        score: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 100 }
      }
    };

    expect(validateJsonSchema('{"score": 50}', schema).success).toBe(true);
    expect(validateJsonSchema('{"score": 0}', schema).success).toBe(false);
    expect(validateJsonSchema('{"score": 100}', schema).success).toBe(false);
  });

  it('validates array constraints', () => {
    const schema = {
      type: 'object',
      properties: {
        tags: { type: 'array', minItems: 1, maxItems: 5 }
      }
    };

    expect(validateJsonSchema('{"tags": ["a"]}', schema).success).toBe(true);
    expect(validateJsonSchema('{"tags": []}', schema).success).toBe(false);
    expect(validateJsonSchema('{"tags": ["a", "b", "c", "d", "e", "f"]}', schema).success).toBe(false);
  });

  it('rejects invalid JSON input', () => {
    const result = validateJsonSchema('not valid json', { type: 'object' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some(e => e.includes('no valid JSON'))).toBe(true);
    }
  });

  it('handles $ref to local $defs', () => {
    const schema = {
      $defs: {
        positiveInt: { type: 'integer', minimum: 1 }
      },
      type: 'object',
      properties: {
        count: { $ref: '#/$defs/positiveInt' }
      }
    };

    expect(validateJsonSchema('{"count": 5}', schema).success).toBe(true);
    expect(validateJsonSchema('{"count": 0}', schema).success).toBe(false);
  });

  it('rejects unsupported $ref', () => {
    const schema = {
      type: 'object',
      properties: {
        value: { $ref: 'http://example.com/schema' }
      }
    };

    const result = validateJsonSchema('{"value": 5}', schema);
    expect(result.success).toBe(false);
  });

  it('rejects circular $ref', () => {
    const schema = {
      $defs: {
        node: {
          type: 'object',
          properties: {
            child: { $ref: '#/$defs/node' }
          }
        }
      },
      $ref: '#/$defs/node'
    };

    const result = validateJsonSchema('{"child": {"child": {}}}', schema);
    expect(result.success).toBe(false);
  });

  it('handles a $ref not found in $defs', () => {
    const schema = {
      $defs: {},
      type: 'object',
      properties: {
        value: { $ref: '#/$defs/missing' }
      }
    };

    const result = validateJsonSchema('{"value": 5}', schema);
    expect(result.success).toBe(false);
  });

  it('handles integer type', () => {
    const schema = {
      type: 'object',
      properties: {
        count: { type: 'integer' }
      }
    };

    expect(validateJsonSchema('{"count": 5}', schema).success).toBe(true);
    expect(validateJsonSchema('{"count": 5.5}', schema).success).toBe(false);
  });

  it('rejects deeply nested JSON exceeding maxJsonDepth', () => {
    const deepNested = '{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":"deep"}}}}}}}}}}}';
    const schema = { type: 'object' };

    const result = validateJsonSchema(deepNested, schema, { maxJsonDepth: 5 });
    expect(result.success).toBe(false);
  });

  it('rejects JSON with too many keys exceeding maxJsonKeys', () => {
    const large = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`key${i}`, i]));
    const schema = { type: 'object' };

    const result = validateJsonSchema(JSON.stringify(large), schema, { maxJsonKeys: 10 });
    expect(result.success).toBe(false);
  });

  it('uses custom external validator', () => {
    const schema = { type: 'object' };

    const passingResult = validateJsonSchema('{"data": "ok"}', schema, {
      validator: () => true
    });
    expect(passingResult.success).toBe(true);

    const failingResult = validateJsonSchema('{"data": "ok"}', schema, {
      validator: () => false
    });
    expect(failingResult.success).toBe(false);
  });

  it('uses custom external validator with errors', () => {
    const schema = { type: 'object' };

    const result = validateJsonSchema('{"data": "ok"}', schema, {
      validator: () => ({ valid: false, errors: ['custom error'] })
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContain('custom error');
    }
  });

  it('handles validator that throws', () => {
    const schema = { type: 'object' };

    const result = validateJsonSchema('{"data": "ok"}', schema, {
      validator: () => {
        throw new Error('validator exploded');
      }
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some(e => e.includes('validator exploded'))).toBe(true);
    }
  });

  it('handles null/undefined values correctly', () => {
    const schema = { type: 'object' };
    const result = validateJsonSchema('{"value": null}', schema);
    expect(result.success).toBe(true);
  });

  it('validates with empty object schema', () => {
    const result = validateJsonSchema('{"anything": "goes"}', {});
    expect(result.success).toBe(true);
  });

  it('validates string date format', () => {
    const schema = {
      type: 'object',
      properties: {
        date: { type: 'string', format: 'date' }
      }
    };
    expect(validateJsonSchema('{"date": "2024-01-15"}', schema).success).toBe(true);
    expect(validateJsonSchema('{"date": "not-a-date"}', schema).success).toBe(false);
  });

  it('validates string date-time format', () => {
    const schema = {
      type: 'object',
      properties: {
        dt: { type: 'string', format: 'date-time' }
      }
    };
    expect(validateJsonSchema('{"dt": "2024-01-15T10:30:00Z"}', schema).success).toBe(true);
    expect(validateJsonSchema('{"dt": "2024-01-15T10:30:00+05:00"}', schema).success).toBe(true);
    expect(validateJsonSchema('{"dt": "invalid"}', schema).success).toBe(false);
  });

  it('validates string ipv6 format', () => {
    const schema = {
      type: 'object',
      properties: {
        ip: { type: 'string', format: 'ipv6' }
      }
    };
    expect(validateJsonSchema('{"ip": "::1"}', schema).success).toBe(true);
    expect(validateJsonSchema('{"ip": "2001:db8::1"}', schema).success).toBe(true);
    expect(validateJsonSchema('{"ip": "not-an-ip"}', schema).success).toBe(false);
  });

  it('handles null type correctly', () => {
    const schema = {
      type: 'object',
      properties: {
        value: { type: 'null' }
      }
    };

    expect(validateJsonSchema('{"value": null}', schema).success).toBe(true);
    expect(validateJsonSchema('{"value": 5}', schema).success).toBe(false);
  });
});
