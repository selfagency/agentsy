import { DEFAULT_MAX_JSON_DEPTH, DEFAULT_MAX_JSON_KEYS, parseJson, type ParseJsonOptions } from './parseJson.js';

type JsonSchema = Record<string, unknown>;

const REGEX_CACHE_MAX = 256;
const regexCache = new Map<string, RegExp & { _accessTimestamp: number }>();

function getCachedRegex(pattern: string): RegExp {
  const existing = regexCache.get(pattern);
  if (existing !== undefined) {
    // Update access timestamp without delete/re-insert to avoid disrupting LRU tracking
    existing._accessTimestamp = Date.now();
    return existing;
  }

  let regex: RegExp;
  try {
    // Security: Validate pattern length and characters to prevent ReDoS attacks.
    // JSON Schema patterns should be relatively simple; overly complex patterns are rejected.
    if (typeof pattern !== 'string' || pattern.length > 1000 || /[*+?]{3,}/.test(pattern)) {
      // Pattern is too long, too complex, or not a string: use safe match-nothing regex
      regex = /(?!)/;
    } else {
      regex = new RegExp(pattern);
    }
  } catch {
    // Malformed or ReDoS-vulnerable patterns: fail gracefully with match-nothing regex
    regex = /(?!)/; // Negative lookahead that never matches
  }
  const taggedRegex = regex as RegExp & { _accessTimestamp: number };
  taggedRegex._accessTimestamp = Date.now();

  if (regexCache.size >= REGEX_CACHE_MAX) {
    // Evict least-recently-used entry by scanning access timestamps
    let lruKey: string | undefined;
    let lruTime = Infinity;
    for (const [key, value] of regexCache.entries()) {
      const accessTime = value._accessTimestamp;
      if (accessTime < lruTime) {
        lruTime = accessTime;
        lruKey = key;
      }
    }
    if (lruKey !== undefined) regexCache.delete(lruKey);
  }
  regexCache.set(pattern, taggedRegex);
  return taggedRegex;
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
  date: String.raw`^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$`,
  'date-time': String.raw`^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$`,
  email: String.raw`^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`,
  uri: String.raw`^[a-zA-Z][a-zA-Z0-9+\-.]*:`,
  uuid: `^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`,
  ipv4: String.raw`^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?:\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$`,
  ipv6:
    `^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$` +
    `|^([0-9a-fA-F]{1,4}:){1,7}:$` +
    `|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$` +
    `|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$` +
    `|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$` +
    `|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$` +
    `|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$` +
    `|^[0-9a-fA-F]{1,4}:(:[0-9a-fA-F]{1,4}){1,6}$` +
    `|^:(:[0-9a-fA-F]{1,4}){1,7}$` +
    `|^::$`,
};

function checkRef(
  value: unknown,
  schema: JsonSchema,
  path: string,
  errors: string[],
  context?: ResolveContext,
): boolean {
  if (typeof schema.$ref !== 'string') return false;

  const ref = schema.$ref;
  const match = /^#\/\$defs\/([^/]+)$/.exec(ref);
  if (match === null || match[1] === undefined) {
    errors.push(`${path}: unsupported $ref (only local #/$defs/... references are supported): ${ref}`);
    return true;
  }
  const defName = match[1];
  if (context?.resolving.has(defName)) {
    errors.push(`${path}: circular $ref detected: ${ref}`);
    return true;
  }
  const defSchema = context !== undefined && Object.hasOwn(context.defs, defName) ? context.defs[defName] : undefined;
  if (defSchema === undefined) {
    errors.push(`${path}: $ref not found in $defs: ${ref}`);
    return true;
  }
  const newResolving = new Set(context!.resolving);
  newResolving.add(defName);
  validateNode(value, defSchema, path, errors, { defs: context!.defs, resolving: newResolving });
  return true;
}

function isValueTypeMatch(value: unknown, schemaType: string): boolean {
  if (schemaType === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (schemaType === 'array') return Array.isArray(value);
  if (schemaType === 'integer') return typeof value === 'number' && Number.isInteger(value);
  return typeof value === schemaType;
}

function checkTypeConstraint(
  value: unknown,
  schemaType: string,
  valueType: string,
  path: string,
  errors: string[],
): boolean {
  if (!isValueTypeMatch(value, schemaType)) {
    errors.push(`${path}: expected ${schemaType}, got ${valueType}`);
    return true;
  }
  return false;
}

function checkAnyOf(
  value: unknown,
  subSchemas: unknown[],
  path: string,
  errors: string[],
  context?: ResolveContext,
): void {
  const matched = subSchemas.some(subSchema => {
    if (!subSchema || typeof subSchema !== 'object' || Array.isArray(subSchema)) return false;
    const subErrors: string[] = [];
    validateNode(value, subSchema as JsonSchema, path, subErrors, context);
    return subErrors.length === 0;
  });
  if (!matched) {
    errors.push(`${path}: value does not match any of the 'anyOf' schemas`);
  }
}

function checkOneOf(
  value: unknown,
  subSchemas: unknown[],
  path: string,
  errors: string[],
  context?: ResolveContext,
): void {
  const matchCount = subSchemas.reduce((count: number, subSchema) => {
    if (!subSchema || typeof subSchema !== 'object' || Array.isArray(subSchema)) return count;
    const subErrors: string[] = [];
    validateNode(value, subSchema as JsonSchema, path, subErrors, context);
    return subErrors.length === 0 ? count + 1 : count;
  }, 0);
  if (matchCount !== 1) {
    errors.push(`${path}: value must match exactly one of the 'oneOf' schemas (matched ${String(matchCount)})`);
  }
}

// #lizard forgives
function checkAllOf(
  value: unknown,
  subSchemas: unknown[],
  path: string,
  errors: string[],
  context?: ResolveContext,
): void {
  for (const subSchema of subSchemas) {
    if (!subSchema || typeof subSchema !== 'object' || Array.isArray(subSchema)) continue;
    validateNode(value, subSchema as JsonSchema, path, errors, context);
  }
}

function checkCompositeKeywords(
  value: unknown,
  schema: JsonSchema,
  path: string,
  errors: string[],
  context?: ResolveContext,
): void {
  if (Array.isArray(schema.enum) && !schema.enum.some(item => deepEqual(item, value))) {
    errors.push(`${path}: value is not in enum`);
  }

  if ('const' in schema && !deepEqual(value, schema.const)) {
    errors.push(`${path}: value does not match const`);
  }

  if (schema.not && typeof schema.not === 'object' && !Array.isArray(schema.not)) {
    const notErrors: string[] = [];
    validateNode(value, schema.not as JsonSchema, path, notErrors, context);
    if (notErrors.length === 0) {
      errors.push(`${path}: value must not match the 'not' schema`);
    }
  }

  if (Array.isArray(schema.anyOf)) checkAnyOf(value, schema.anyOf, path, errors, context);
  if (Array.isArray(schema.oneOf)) checkOneOf(value, schema.oneOf, path, errors, context);
  if (Array.isArray(schema.allOf)) checkAllOf(value, schema.allOf, path, errors, context);
}

function checkPatternConstraint(value: string, pattern: string, path: string, errors: string[]): void {
  const MAX_PATTERN_LENGTH = 1024;
  if (pattern.length > MAX_PATTERN_LENGTH) {
    errors.push(`${path}: schema pattern exceeds maximum length (${MAX_PATTERN_LENGTH}); skipping validation`);
    return;
  }
  try {
    const regex = getCachedRegex(pattern);
    if (!regex.test(value)) {
      errors.push(`${path}: string does not match pattern ${pattern}`);
    }
  } catch {
    errors.push(`${path}: schema pattern is not a valid regular expression: ${pattern}`);
  }
}

function checkStringConstraints(value: string, schema: JsonSchema, path: string, errors: string[]): void {
  if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
    errors.push(`${path}: string is shorter than minLength ${schema.minLength}`);
  }
  if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
    errors.push(`${path}: string is longer than maxLength ${schema.maxLength}`);
  }

  if (typeof schema.pattern === 'string') {
    checkPatternConstraint(value, schema.pattern, path, errors);
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

function checkNumberConstraints(value: number, schema: JsonSchema, path: string, errors: string[]): void {
  if (typeof schema.minimum === 'number' && value < schema.minimum) {
    errors.push(`${path}: number is below minimum ${schema.minimum}`);
  }
  if (typeof schema.maximum === 'number' && value > schema.maximum) {
    errors.push(`${path}: number is above maximum ${schema.maximum}`);
  }
  if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
    errors.push(`${path}: number is not above exclusiveMinimum ${schema.exclusiveMinimum}`);
  }
  if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) {
    errors.push(`${path}: number is not below exclusiveMaximum ${schema.exclusiveMaximum}`);
  }
}

function checkArrayConstraints(
  value: unknown[],
  schema: JsonSchema,
  path: string,
  errors: string[],
  context?: ResolveContext,
): void {
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

function checkAdditionalProperties(
  value: Record<string, unknown>,
  properties: Record<string, unknown>,
  additionalProperties: unknown,
  path: string,
  errors: string[],
): void {
  if (additionalProperties !== false) return;
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(properties, key)) {
      errors.push(`${path}.${key}: additional property is not allowed`);
    }
  }
}

function checkObjectConstraints(
  value: Record<string, unknown>,
  schema: JsonSchema,
  path: string,
  errors: string[],
  context?: ResolveContext,
): void {
  const required = Array.isArray(schema.required) ? schema.required.filter(item => typeof item === 'string') : [];
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      errors.push(`${path}.${key}: missing required property`);
    }
  }

  const properties =
    schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
      ? (schema.properties as Record<string, unknown>)
      : {};

  for (const [key, childSchema] of Object.entries(properties)) {
    if (Object.hasOwn(value, key) && childSchema && typeof childSchema === 'object' && !Array.isArray(childSchema)) {
      validateNode(value[key], childSchema as JsonSchema, `${path}.${key}`, errors, context);
    }
  }

  checkAdditionalProperties(value, properties, schema.additionalProperties, path, errors);
}

// #lizard forgives
function checkValueTypeConstraints(
  value: unknown,
  schema: JsonSchema,
  path: string,
  errors: string[],
  context?: ResolveContext,
): void {
  if (typeof value === 'string') checkStringConstraints(value, schema, path, errors);
  if (typeof value === 'number') checkNumberConstraints(value, schema, path, errors);
  if (Array.isArray(value)) checkArrayConstraints(value, schema, path, errors, context);
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    checkObjectConstraints(value as Record<string, unknown>, schema, path, errors, context);
  }
}

function validateNode(
  value: unknown,
  schema: JsonSchema,
  path: string,
  errors: string[],
  context?: ResolveContext,
): void {
  if (checkRef(value, schema, path, errors, context)) return;

  const schemaType = typeof schema.type === 'string' ? schema.type : undefined;
  const valueType = typeOf(value);

  if (schemaType && checkTypeConstraint(value, schemaType, valueType, path, errors)) return;

  checkCompositeKeywords(value, schema, path, errors, context);
  checkValueTypeConstraints(value, schema, path, errors, context);
}

interface WalkLimitsState {
  errors: string[];
  keyCount: number;
}

function walkObjectNode(
  node: Record<string, unknown>,
  depth: number,
  maxDepth: number,
  maxKeys: number,
  state: WalkLimitsState,
): void {
  const entries = Object.entries(node);
  state.keyCount += entries.length;
  if (maxKeys > 0 && state.keyCount > maxKeys) {
    state.errors.push(`$: JSON key count exceeds maxJsonKeys (${maxKeys})`);
    return;
  }
  for (const [, child] of entries) {
    walkForLimits(child, depth + 1, maxDepth, maxKeys, state);
  }
}

function walkForLimits(node: unknown, depth: number, maxDepth: number, maxKeys: number, state: WalkLimitsState): void {
  if (state.errors.length > 0) return;

  if (maxDepth > 0 && depth > maxDepth) {
    state.errors.push(`$: JSON depth exceeds maxJsonDepth (${maxDepth})`);
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      walkForLimits(item, depth + 1, maxDepth, maxKeys, state);
    }
    return;
  }

  if (node && typeof node === 'object') {
    walkObjectNode(node as Record<string, unknown>, depth, maxDepth, maxKeys, state);
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

  const parsedWithLimits = parseJson(text, { ...options, maxJsonDepth, maxJsonKeys });
  const parsed = parsedWithLimits ?? parseJson(text, { ...options, maxJsonDepth: 0, maxJsonKeys: 0 });

  if (parsed === null) {
    return { success: false, errors: ['$: no valid JSON found in input'] };
  }

  const limitsState: WalkLimitsState = { errors: [], keyCount: 0 };
  walkForLimits(parsed, 1, maxJsonDepth, maxJsonKeys, limitsState);
  if (limitsState.errors.length > 0) {
    return { success: false, errors: limitsState.errors };
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
