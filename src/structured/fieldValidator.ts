/**
 * Field-level validation event emitted during JSON streaming.
 */
export interface FieldValidationEvent {
  /** Field path (dot-notation, e.g., "user.email") */
  path: string;
  /** Field value */
  value: unknown;
  /** true if validation passed, false if failed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Time when validation occurred (ms since start) */
  timestamp?: number;
}

/**
 * Validator function for a single field.
 */
export type FieldValidator = (value: unknown) => boolean | string; // true = valid, false/string = invalid

/**
 * Schema for field-level validation.
 * Maps field paths to validator functions.
 */
export type FieldValidationSchema = Record<string, FieldValidator>;

/**
 * Options for field-level validator.
 */
export interface FieldValidatorOptions {
  /** Field validators */
  schema: FieldValidationSchema;
  /** Callback for validation events */
  onFieldValidation?: (event: FieldValidationEvent) => void;
  /** Whether to continue on field validation errors */
  continueOnError?: boolean;
  /** Start time reference for timestamp tracking */
  startTime?: number;
}

/**
 * Validates a field value against its validator function.
 * Returns validation result and optional error message.
 */
export function validateField(
  path: string,
  value: unknown,
  validator: FieldValidator,
): { valid: boolean; error?: string } {
  try {
    const result = validator(value);
    if (typeof result === 'string') {
      return { valid: false, error: result };
    }
    return { valid: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message };
  }
}

/**
 * Create a field-level validator for streaming JSON objects.
 */
export function createFieldValidator(options: FieldValidatorOptions): {
  validateFieldAtPath: (path: string, value: unknown) => FieldValidationEvent;
  validateObject: (obj: Record<string, unknown>) => FieldValidationEvent[];
} {
  const { schema, onFieldValidation, continueOnError = true, startTime = Date.now() } = options;

  return {
    validateFieldAtPath(_path: string, value: unknown): FieldValidationEvent {
      const fieldValidator = Object.hasOwn(schema, _path) ? schema[_path] : undefined;
      if (!fieldValidator) {
        // No validator defined for this field, skip validation
        return {
          path: _path,
          value,
          valid: true,
          timestamp: Date.now() - startTime,
        };
      }

      const { valid, error } = validateField(_path, value, fieldValidator);
      const event: FieldValidationEvent = {
        path: _path,
        value,
        valid,
        ...(error !== undefined && { error }),
        timestamp: Date.now() - startTime,
      };

      if (onFieldValidation) {
        onFieldValidation(event);
      }

      return event;
    },

    validateObject(obj: Record<string, unknown>): FieldValidationEvent[] {
      const events: FieldValidationEvent[] = [];

      for (const [path, value] of Object.entries(obj)) {
        const event = this.validateFieldAtPath(path, value);
        events.push(event);
        if (!event.valid && !continueOnError) {
          break;
        }
      }

      return events;
    },
  };
}

/**
 * Common field validators.
 */
export const validators = {
  /** Validates email format */
  email: (value: unknown): boolean | string => {
    if (typeof value !== 'string') return 'must be a string';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) || 'must be a valid email';
  },

  /** Validates string type */
  string: (value: unknown): boolean | string => {
    return typeof value === 'string' || 'must be a string';
  },

  /** Validates number type */
  number: (value: unknown): boolean | string => {
    return typeof value === 'number' || 'must be a number';
  },

  /** Validates boolean type */
  boolean: (value: unknown): boolean | string => {
    return typeof value === 'boolean' || 'must be a boolean';
  },

  /** Validates array type */
  array: (value: unknown): boolean | string => {
    return Array.isArray(value) || 'must be an array';
  },

  /** Validates object type */
  object: (value: unknown): boolean | string => {
    return (typeof value === 'object' && value !== null && !Array.isArray(value)) || 'must be an object';
  },

  /** Validates non-null value */
  required: (value: unknown): boolean | string => {
    return (value !== null && value !== undefined) || 'must not be null or undefined';
  },

  /** Validates URL format */
  url: (value: unknown): boolean | string => {
    if (typeof value !== 'string') return 'must be a string';
    try {
      new URL(value);
      return true;
    } catch {
      return 'must be a valid URL';
    }
  },

  /** Validates integer */
  integer: (value: unknown): boolean | string => {
    return (typeof value === 'number' && Number.isInteger(value)) || 'must be an integer';
  },

  /** Validates positive number */
  positive: (value: unknown): boolean | string => {
    return (typeof value === 'number' && value > 0) || 'must be positive';
  },

  /** Validates string minimum length */
  minLength:
    (min: number) =>
    (value: unknown): boolean | string => {
      return (typeof value === 'string' && value.length >= min) || `must be at least ${min} characters`;
    },

  /** Validates string maximum length */
  maxLength:
    (max: number) =>
    (value: unknown): boolean | string => {
      return (typeof value === 'string' && value.length <= max) || `must be at most ${max} characters`;
    },

  /** Validates number is within range */
  range:
    (min: number, max: number) =>
    (value: unknown): boolean | string => {
      return (typeof value === 'number' && value >= min && value <= max) || `must be between ${min} and ${max}`;
    },

  /** Validates value matches enum (renamed from 'enum' to avoid reserved keyword) */
  enumValues:
    (allowedValues: unknown[]) =>
    (value: unknown): boolean | string => {
      return allowedValues.includes(value) || `must be one of: ${allowedValues.join(', ')}`;
    },
};

/**
 * Combine multiple validators with AND logic (all must pass).
 */
export function allOf(...validators_: FieldValidator[]): FieldValidator {
  return (value: unknown): boolean | string => {
    for (const validator of validators_) {
      const result = validator(value);
      if (result !== true) {
        return result;
      }
    }
    return true;
  };
}

/**
 * Combine multiple validators with OR logic (at least one must pass).
 */
export function oneOf(...validators_: FieldValidator[]): FieldValidator {
  return (value: unknown): boolean | string => {
    const errors: string[] = [];
    for (const validator of validators_) {
      const result = validator(value);
      if (result === true) {
        return true;
      }
      if (typeof result === 'string') {
        errors.push(result);
      }
    }
    return errors.length > 0 ? `failed all alternatives: ${errors.join('; ')}` : false;
  };
}

/**
 * Validate object against schema.
 * Returns validation result and all field events.
 */
export function validateObject(
  obj: Record<string, unknown>,
  schema: FieldValidationSchema,
): {
  valid: boolean;
  events: FieldValidationEvent[];
  errors: FieldValidationEvent[];
} {
  const validator = createFieldValidator({ schema });
  const events = validator.validateObject(obj);
  const errors = events.filter(e => !e.valid);
  return {
    valid: errors.length === 0,
    events,
    errors,
  };
}
