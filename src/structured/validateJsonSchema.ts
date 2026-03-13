import { parseJson, DEFAULT_MAX_JSON_DEPTH, DEFAULT_MAX_JSON_KEYS, type ParseJsonOptions } from './parseJson.js';

type JsonSchema = Record<string, unknown>;

const REGEX_CACHE_MAX = 256;
const regexCache = new Map<string, RegExp>();

function getCachedRegex(pattern: string): RegExp {
  const existing = regexCache.get(pattern);
  if (existing !== undefined) {
    // Refresh insertion order for true LRU behavior
    regexCache.delete(pattern);
    regexCache.set(pattern, existing);
    return existing;
  }

  const regex = new RegExp(pattern);
  if (regexCache.size >= REGEX_CACHE_MAX) {
    // Evict least-recently-used entry (first in Map = oldest access)
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

interface ResolveContext {
  defs: Record<string, JsonSchema>;
  resolving: Set<string>;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keysA = Object.keys(aObj);
    const keysB = Object.keys(bObj);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      if (!Object.hasOwn(bObj, k) || !deepEqual(aObj[k], bObj[k])) return false;
    }
    return true;
  }
  return false;
}

// Simple format validation patterns (pragmatic; not full RFC compliance).
const FORMAT_PATTERNS: Record<string, string> = {
  date: '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$',
  'date-time':
    '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])T([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(\\.\\d+)?(Z|[+-]([01]\\d|2[0-3]):[0-5]\\d)$',
  email: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$',
  uri: '^[a-zA-Z][a-zA-Z0-9+\\-.]*:',
  uuid: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
  ipv4: '^(25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)(?:\\.(25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)){3}$',
  ipv6:
    '^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$' +
    '|^([0-9a-fA-F]{1,4}:){1,7}:$' +
    '|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$' +
    '|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$' +
    '|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$' +
    '|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$' +
    '|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$' +
    '|^[0-9a-fA-F]{1,4}:(:[0-9a-fA-F]{1,4}){1,6}$' +
    '|^:(:[0-9a-fA-F]{1,4}){1,7}$' +
    '|^::$',
};

function validateNode(
  value: unknown,
  schema: JsonSchema,
  path: string,
  errors: string[],
  context?: ResolveContext,
): void {
  // $ref: resolve local #/$defs/... references only (no remote $ref — SSRF risk).
  if (typeof schema.$ref === 'string') {
    const ref = schema.$ref;
    const match = /^#\/\$defs\/([^/]+)$/.exec(ref);
    if (match === null || match[1] === undefined) {
      errors.push(`${path}: unsupported $ref (only local #/$defs/... references are supported): ${ref}`);
      return;
    }
    const defName = match[1];
    if (context?.resolving.has(defName) === true) {
      errors.push(`${path}: circular $ref detected: ${ref}`);
      return;
    }
    const defSchema = context !== undefined && Object.hasOwn(context.defs, defName) ? context.defs[defName] : undefined;
    if (defSchema === undefined) {
      errors.push(`${path}: $ref not found in $defs: ${ref}`);
      return;
    }
    const newResolving = new Set(context!.resolving);
    newResolving.add(defName);
    validateNode(value, defSchema, path, errors, { defs: context!.defs, resolving: newResolving });
    return;
  }

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

  if (Array.isArray(schema.enum) && !schema.enum.some(item => deepEqual(item, value))) {
    errors.push(`${path}: value is not in enum`);
  }

  // const: value must deeply equal the schema constant.
  if ('const' in schema && !deepEqual(value, schema.const)) {
    errors.push(`${path}: value does not match const`);
  }

  // not: sub-schema must NOT match.
  if (schema.not && typeof schema.not === 'object' && !Array.isArray(schema.not)) {
    const notErrors: string[] = [];
    validateNode(value, schema.not as JsonSchema, path, notErrors, context);
    if (notErrors.length === 0) {
      errors.push(`${path}: value must not match the 'not' schema`);
    }
  }

  // anyOf: at least one sub-schema must match.
  if (Array.isArray(schema.anyOf)) {
    const matched = schema.anyOf.some(subSchema => {
      if (!subSchema || typeof subSchema !== 'object' || Array.isArray(subSchema)) return false;
      const subErrors: string[] = [];
      validateNode(value, subSchema as JsonSchema, path, subErrors, context);
      return subErrors.length === 0;
    });
    if (!matched) {
      errors.push(`${path}: value does not match any of the 'anyOf' schemas`);
    }
  }

  // oneOf: exactly one sub-schema must match.
  if (Array.isArray(schema.oneOf)) {
    const matchCount = schema.oneOf.reduce((count: number, subSchema) => {
      if (!subSchema || typeof subSchema !== 'object' || Array.isArray(subSchema)) return count;
      const subErrors: string[] = [];
      validateNode(value, subSchema as JsonSchema, path, subErrors, context);
      return subErrors.length === 0 ? count + 1 : count;
    }, 0);
    if (matchCount !== 1) {
      errors.push(`${path}: value must match exactly one of the 'oneOf' schemas (matched ${matchCount})`);
    }
  }

  // allOf: all sub-schemas must match.
  if (Array.isArray(schema.allOf)) {
    for (const subSchema of schema.allOf) {
      if (!subSchema || typeof subSchema !== 'object' || Array.isArray(subSchema)) continue;
      validateNode(value, subSchema as JsonSchema, path, errors, context);
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.pattern === 'string') {
      // Guard against ReDoS: reject patterns exceeding a safe length.
      // This is a heuristic — patterns over 1024 chars are likely adversarial.
      const MAX_PATTERN_LENGTH = 1024;
      if (schema.pattern.length > MAX_PATTERN_LENGTH) {
        errors.push(`${path}: schema pattern exceeds maximum length (${MAX_PATTERN_LENGTH}); skipping validation`);
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

    if (typeof schema.format === 'string') {
      const formatPattern = FORMAT_PATTERNS[schema.format];
      if (formatPattern !== undefined) {
        const regex = getCachedRegex(formatPattern);
        if (!regex.test(value)) {
          errors.push(`${path}: string does not match format '${schema.format}'`);
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
        validateNode(value[i], itemSchema as JsonSchema, `${path}[${i}]`, errors, context);
      }
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const objectValue = value as Record<string, unknown>;
    const required = Array.isArray(schema.required) ? schema.required.filter(item => typeof item === 'string') : [];

    for (const key of required) {
      if (!Object.hasOwn(objectValue, key)) {
        errors.push(`${path}.${key}: missing required property`);
      }
    }

    const properties =
      schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
        ? (schema.properties as Record<string, unknown>)
        : {};

    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.hasOwn(objectValue, key) && childSchema && typeof childSchema === 'object' && !Array.isArray(childSchema)) {
        validateNode(objectValue[key], childSchema as JsonSchema, `${path}.${key}`, errors, context);
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(objectValue)) {
        if (!Object.hasOwn(properties, key)) {
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

  // Extract $defs for local $ref resolution.
  const defs =
    schema.$defs && typeof schema.$defs === 'object' && !Array.isArray(schema.$defs)
      ? (schema.$defs as Record<string, JsonSchema>)
      : {};
  const context: ResolveContext = { defs, resolving: new Set<string>() };

  const errors: string[] = [];
  validateNode(parsed, schema, '$', errors, context);

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
