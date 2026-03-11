import { parseJson, DEFAULT_MAX_JSON_DEPTH, DEFAULT_MAX_JSON_KEYS, type ParseJsonOptions } from './parseJson.js';

type JsonSchema = Record<string, unknown>;

const REGEX_CACHE_MAX = 256;
const regexCache = new Map<string, RegExp>();

function getCachedRegex(pattern: string): RegExp {
  let regex = regexCache.get(pattern);
  if (regex) return regex;

  regex = new RegExp(pattern);
  if (regexCache.size >= REGEX_CACHE_MAX) {
    // Evict oldest entry (first inserted)
    const firstKey = regexCache.keys().next().value;
    if (firstKey !== undefined) regexCache.delete(firstKey);
  }
  regexCache.set(pattern, regex);
  return regex;
}

export type JsonSchemaValidator = (
  data: unknown,
  schema: Record<string, unknown>,
) =>
  | boolean
  | {
      valid: boolean;
      errors?: string[];
    };

export interface ValidateJsonSchemaOptions extends ParseJsonOptions {
  validator?: JsonSchemaValidator;
  /**
   * Reserved for future use. Intended to limit how long an external
   * `validator` may run before validation is aborted.
   *
   * **Not currently enforced** — synchronous validators cannot be timed out
   * in single-threaded JavaScript without Worker threads. Callers should
   * ensure their validator function completes promptly.
   */
  validatorTimeoutMs?: number;
}

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
      // Guard against ReDoS: reject patterns exceeding a safe length.
      // This is a heuristic — patterns over 1024 chars are likely adversarial.
      const MAX_PATTERN_LENGTH = 1024;
      if (schema.pattern.length > MAX_PATTERN_LENGTH) {
        errors.push(
          `${path}: schema pattern exceeds maximum length (${MAX_PATTERN_LENGTH}); skipping validation`,
        );
      } else {
        try {
          const regex = getCachedRegex(schema.pattern);
          if (!regex.test(value)) {
            errors.push(`${path}: string does not match pattern ${schema.pattern}`);
          }
        } catch {
          errors.push(`${path}: schema pattern is not a valid regular expression: ${schema.pattern}`);
        }
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

/**
 * Parses JSON from text and validates it against a JSON Schema.
 *
 * @returns A discriminated union: `{ success: true; data: T }` on success,
 *          or `{ success: false; errors: string[] }` on failure.
 *          Never throws — all error conditions are captured in the `errors` array.
 */
export function validateJsonSchema<T = unknown>(
  text: string,
  schema: Record<string, unknown>,
  options: ValidateJsonSchemaOptions = {},
): { success: true; data: T } | { success: false; errors: string[] } {
  const maxJsonDepth = options.maxJsonDepth ?? DEFAULT_MAX_JSON_DEPTH;
  const maxJsonKeys = options.maxJsonKeys ?? DEFAULT_MAX_JSON_KEYS;

  // First, attempt to parse with the effective limits so candidate selection respects them.
  const parsedWithLimits = parseJson(text, {
    ...options,
    maxJsonDepth,
    maxJsonKeys,
  });

  // If no JSON is found under those limits, fall back to an unlimited parse
  // to surface deterministic limit errors on the "best" candidate, if any.
  const parsed =
    parsedWithLimits !== null
      ? parsedWithLimits
      : parseJson(text, {
          ...options,
          maxJsonDepth: 0,
          maxJsonKeys: 0,
        });

  if (parsed === null) {
    return { success: false, errors: ['$: no valid JSON found in input'] };
  }

  const limitErrors: string[] = [];

  let keyCount = 0;
  function walkForLimits(node: unknown, depth: number): void {
    if (limitErrors.length > 0) {
      return;
    }

    if (maxJsonDepth > 0 && depth > maxJsonDepth) {
      limitErrors.push(`$: JSON depth exceeds maxJsonDepth (${maxJsonDepth})`);
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        walkForLimits(item, depth + 1);
      }
      return;
    }

    if (node && typeof node === 'object') {
      const entries = Object.entries(node as Record<string, unknown>);
      keyCount += entries.length;
      if (maxJsonKeys > 0 && keyCount > maxJsonKeys) {
        limitErrors.push(`$: JSON key count exceeds maxJsonKeys (${maxJsonKeys})`);
        return;
      }

      for (const [, child] of entries) {
        walkForLimits(child, depth + 1);
      }
    }
  }

  walkForLimits(parsed, 1);
  if (limitErrors.length > 0) {
    return { success: false, errors: limitErrors };
  }

  const errors: string[] = [];
  validateNode(parsed, schema, '$', errors);

  if (options.validator) {
    try {
      const validated = options.validator(parsed, schema);
      if (typeof validated === 'boolean') {
        if (!validated) {
          return { success: false, errors: ['$: external validator failed'] };
        }
      } else if (!validated.valid) {
        return {
          success: false,
          errors: validated.errors && validated.errors.length > 0 ? validated.errors : ['$: external validator failed'],
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, errors: [`$: external validator threw: ${message}`] };
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: parsed as T };
}
