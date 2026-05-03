import type { SettingsValidationResult } from '../types/settings.js';

/**
 * JSON Schema subset for settings validation.
 * Supports type, required, properties, minimum, maximum, and enum.
 */
export interface SchemaProperty {
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | string;
  required?: string[];
  properties?: Record<string, SchemaProperty>;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
  default?: unknown;
  description?: string;
}

export type SettingsSchema = SchemaProperty;

/**
 * Validates settings against a JSON Schema subset.
 */
export function validateSettings(
  settings: Record<string, unknown>,
  schema: SettingsSchema,
): SettingsValidationResult {
  const errors: string[] = [];

  if (schema.required) {
    for (const key of schema.required) {
      if (!(key in settings) || settings[key] === undefined || settings[key] === null) {
        errors.push(`Missing required setting: '${key}'`);
      }
    }
  }

  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (!(key in settings)) continue;
      const value = settings[key];
      validateValue(key, value, propSchema, errors);
    }
  }

  return { valid: errors.length === 0, errors: errors.length ? errors : undefined };
}

function validateValue(
  path: string,
  value: unknown,
  schema: SchemaProperty,
  errors: string[],
): void {
  if (value === undefined || value === null) return;

  if (schema.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== schema.type) {
      errors.push(`Setting '${path}' must be of type '${schema.type}', got '${actualType}'`);
      return;
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`Setting '${path}' must be one of: ${schema.enum.map(String).join(', ')}`);
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`Setting '${path}' must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`Setting '${path}' must be <= ${schema.maximum}`);
    }
  }

  if (typeof value === 'object' && !Array.isArray(value) && schema.properties) {
    for (const [subKey, subSchema] of Object.entries(schema.properties)) {
      const subValue = (value as Record<string, unknown>)[subKey];
      validateValue(`${path}.${subKey}`, subValue, subSchema, errors);
    }
  }
}

/**
 * Merges settings with defaults, with settings taking priority.
 */
export function applyDefaults(
  settings: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined && value !== null) {
      result[key] = value;
    }
  }
  return result;
}
