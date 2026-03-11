import { parseJson, type ParseJsonOptions } from './parseJson.js';

type JsonSchema = Record<string, unknown>;

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function validateNode(value: unknown, schema: JsonSchema, path: string, errors: string[]): void {
  const schemaType = typeof schema.type === 'string' ? schema.type : undefined;
  const valueType = typeOf(value);

  if (schemaType) {
    const isTypeMatch =
      (schemaType === 'object' && valueType === 'object' && value !== null && !Array.isArray(value)) ||
      (schemaType === 'array' && Array.isArray(value)) ||
      (schemaType === 'string' && typeof value === 'string') ||
      (schemaType === 'number' && typeof value === 'number') ||
      (schemaType === 'integer' && typeof value === 'number' && Number.isInteger(value)) ||
      (schemaType === 'boolean' && typeof value === 'boolean');

    if (!isTypeMatch) {
      errors.push(`${path}: expected ${schemaType}, got ${valueType}`);
      return;
    }
  }

  if (Array.isArray(schema.enum) && !schema.enum.some(item => Object.is(item, value))) {
    errors.push(`${path}: value is not in enum`);
  }

  if (typeof value === 'string') {
    if (typeof schema.pattern === 'string') {
      try {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          errors.push(`${path}: string does not match pattern ${schema.pattern}`);
        }
      } catch {
        errors.push(`${path}: schema pattern is not a valid regular expression: ${schema.pattern}`);
      }
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`${path}: number is below minimum ${schema.minimum}`);
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push(`${path}: number is above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`${path}: array has fewer than ${schema.minItems} items`);
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      errors.push(`${path}: array has more than ${schema.maxItems} items`);
    }

    const itemSchema = schema.items;
    if (itemSchema && typeof itemSchema === 'object' && !Array.isArray(itemSchema)) {
      for (let i = 0; i < value.length; i++) {
        validateNode(value[i], itemSchema as JsonSchema, `${path}[${i}]`, errors);
      }
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const objectValue = value as Record<string, unknown>;
    const required = Array.isArray(schema.required)
      ? schema.required.filter(item => typeof item === 'string')
      : [];

    for (const key of required) {
      if (!(key in objectValue)) {
        errors.push(`${path}.${key}: missing required property`);
      }
    }

    const properties =
      schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
        ? (schema.properties as Record<string, unknown>)
        : {};

    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in objectValue && childSchema && typeof childSchema === 'object' && !Array.isArray(childSchema)) {
        validateNode(objectValue[key], childSchema as JsonSchema, `${path}.${key}`, errors);
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(objectValue)) {
        if (!(key in properties)) {
          errors.push(`${path}.${key}: additional property is not allowed`);
        }
      }
    }
  }
}

export function validateJsonSchema<T = unknown>(
  text: string,
  schema: Record<string, unknown>,
  options: ParseJsonOptions = {},
): { success: true; data: T } | { success: false; errors: string[] } {
  const parsed = parseJson(text, options);
  if (parsed === null) {
    return { success: false, errors: ['$: no valid JSON found in input'] };
  }

  const errors: string[] = [];
  validateNode(parsed, schema, '$', errors);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: parsed as T };
}
