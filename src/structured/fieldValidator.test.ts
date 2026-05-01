import { describe, it, expect, vi } from 'vitest';
import {
  validateField,
  createFieldValidator,
  validateObject,
  validators,
  allOf,
  oneOf,
  type FieldValidationEvent,
} from './fieldValidator.js';

describe('fieldValidator', () => {
  describe('validateField', () => {
    it('validates field matching validator', () => {
      const result = validateField('email', 'user@example.com', validators.email);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects field not matching validator', () => {
      const result = validateField('email', 'not-an-email', validators.email);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('validates string type', () => {
      const result = validateField('name', 'John', validators.string);
      expect(result.valid).toBe(true);
    });

    it('validates number type', () => {
      const result = validateField('age', 42, validators.number);
      expect(result.valid).toBe(true);
    });

    it('validates array type', () => {
      const result = validateField('tags', ['a', 'b', 'c'], validators.array);
      expect(result.valid).toBe(true);
    });

    it('validates object type', () => {
      const result = validateField('user', { name: 'John', age: 30 }, validators.object);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid object', () => {
      const result = validateField('user', [1, 2, 3], validators.object);
      expect(result.valid).toBe(false);
    });

    it('handles custom validators', () => {
      const customValidator = (value: unknown) => {
        if (typeof value === 'number' && value > 0) return true;
        return 'must be a positive number';
      };
      const result = validateField('count', 42, customValidator);
      expect(result.valid).toBe(true);
    });

    it('handles validator errors gracefully', () => {
      const throwingValidator = () => {
        throw new Error('Validation error');
      };
      const result = validateField('field', 'value', throwingValidator as never);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Validation error');
    });
  });

  describe('validators', () => {
    it('email validator', () => {
      expect(validators.email('user@example.com')).toBe(true);
      expect(validators.email('invalid')).not.toBe(true);
    });

    it('string validator', () => {
      expect(validators.string('hello')).toBe(true);
      expect(validators.string(123)).not.toBe(true);
    });

    it('number validator', () => {
      expect(validators.number(42)).toBe(true);
      expect(validators.number('42')).not.toBe(true);
    });

    it('boolean validator', () => {
      expect(validators.boolean(true)).toBe(true);
      expect(validators.boolean(1)).not.toBe(true);
    });

    it('array validator', () => {
      expect(validators.array([1, 2, 3])).toBe(true);
      expect(validators.array('not-array')).not.toBe(true);
    });

    it('url validator', () => {
      expect(validators.url('https://example.com')).toBe(true);
      expect(validators.url('not-a-url')).not.toBe(true);
    });

    it('integer validator', () => {
      expect(validators.integer(42)).toBe(true);
      expect(validators.integer(42.5)).not.toBe(true);
    });

    it('positive validator', () => {
      expect(validators.positive(42)).toBe(true);
      expect(validators.positive(-5)).not.toBe(true);
    });

    it('minLength validator', () => {
      const minLength3 = validators.minLength(3);
      expect(minLength3('hello')).toBe(true);
      expect(minLength3('hi')).not.toBe(true);
    });

    it('maxLength validator', () => {
      const maxLength5 = validators.maxLength(5);
      expect(maxLength5('hello')).toBe(true);
      expect(maxLength5('hello world')).not.toBe(true);
    });

    it('range validator', () => {
      const range10to20 = validators.range(10, 20);
      expect(range10to20(15)).toBe(true);
      expect(range10to20(5)).not.toBe(true);
      expect(range10to20(25)).not.toBe(true);
    });

    it('enum validator', () => {
      const status = validators.enumValues(['active', 'inactive', 'pending']);
      expect(status('active')).toBe(true);
      expect(status('unknown')).not.toBe(true);
    });

    it('required validator', () => {
      expect(validators.required('value')).toBe(true);
      expect(validators.required(null)).not.toBe(true);
      expect(validators.required(undefined)).not.toBe(true);
    });
  });

  describe('createFieldValidator', () => {
    it('validates single field', () => {
      const validator = createFieldValidator({
        schema: {
          email: validators.email,
        },
      });

      const event = validator.validateFieldAtPath('email', 'user@example.com');
      expect(event.valid).toBe(true);
      expect(event.path).toBe('email');
      expect(event.value).toBe('user@example.com');
    });

    it('emits validation events', () => {
      const onFieldValidation = vi.fn<(event: FieldValidationEvent) => void>();
      const validator = createFieldValidator({
        schema: {
          email: validators.email,
        },
        onFieldValidation,
      });

      validator.validateFieldAtPath('email', 'user@example.com');
      expect(onFieldValidation).toHaveBeenCalled();
      const calls = onFieldValidation.mock.calls;
      expect(calls).toHaveLength(1);
      const call = calls[0]!;
      const event = call[0] as FieldValidationEvent;
      expect(event.valid).toBe(true);
    });

    it('skips fields not in schema', () => {
      const validator = createFieldValidator({
        schema: {
          email: validators.email,
        },
      });

      const event = validator.validateFieldAtPath('unknownField', 'value');
      expect(event.valid).toBe(true);
    });

    it('validates multiple fields', () => {
      const validator = createFieldValidator({
        schema: {
          name: validators.string,
          age: validators.positive,
          email: validators.email,
        },
      });

      const obj = {
        name: 'John',
        age: 30,
        email: 'john@example.com',
      };

      const events = validator.validateObject(obj);
      expect(events).toHaveLength(3);
      expect(events.every(e => e.valid)).toBe(true);
    });

    it('reports field validation errors', () => {
      const validator = createFieldValidator({
        schema: {
          age: validators.positive,
        },
      });

      const event = validator.validateFieldAtPath('age', -5);
      expect(event.valid).toBe(false);
      expect(event.error).toBeDefined();
    });

    it('tracks validation timestamps', () => {
      const startTime = Date.now();
      const validator = createFieldValidator({
        schema: {
          email: validators.email,
        },
        startTime,
      });

      const event = validator.validateFieldAtPath('email', 'user@example.com');
      expect(event.timestamp).toBeDefined();
      expect(event.timestamp).toBeGreaterThanOrEqual(0);
    });

    it('stops on first error when continueOnError is false', () => {
      const validator = createFieldValidator({
        schema: {
          field1: validators.string,
          field2: validators.positive,
          field3: validators.string,
        },
        continueOnError: false,
      });

      const events = validator.validateObject({
        field1: 'valid',
        field2: -5, // Invalid
        field3: 'should-not-validate',
      });

      // Should stop after first error
      expect(events.length).toBeLessThanOrEqual(2);
    });

    it('continues on error by default', () => {
      const validator = createFieldValidator({
        schema: {
          field1: validators.string,
          field2: validators.positive,
          field3: validators.string,
        },
      });

      const events = validator.validateObject({
        field1: 'valid',
        field2: -5, // Invalid
        field3: 'valid',
      });

      // Should validate all three
      expect(events).toHaveLength(3);
    });
  });

  describe('allOf combinator', () => {
    it('combines validators with AND logic', () => {
      const validator = allOf(validators.string, validators.minLength(5), validators.maxLength(20));

      expect(validator('hello')).toBe(true);
      expect(validator('hi')).not.toBe(true);
      expect(validator('this is a very long string')).not.toBe(true);
    });

    it('returns error on first failure', () => {
      const validator = allOf(validators.string, validators.minLength(5));
      const result = validator('hi');
      expect(result).not.toBe(true);
      expect(typeof result).toBe('string');
    });
  });

  describe('oneOf combinator', () => {
    it('combines validators with OR logic', () => {
      const emailOrUrl = oneOf(validators.email, validators.url);

      expect(emailOrUrl('user@example.com')).toBe(true);
      expect(emailOrUrl('https://example.com')).toBe(true);
      expect(emailOrUrl('not-valid')).not.toBe(true);
    });

    it('returns combined error message on all failures', () => {
      const emailOrUrl = oneOf(validators.email, validators.url);
      const result = emailOrUrl('not-valid');
      expect(typeof result).toBe('string');
      expect(result).toContain('alternatives');
    });
  });

  describe('validateObject', () => {
    it('validates object against schema', () => {
      const result = validateObject(
        {
          name: 'John',
          age: 30,
          email: 'john@example.com',
        },
        {
          name: validators.string,
          age: validators.positive,
          email: validators.email,
        },
      );

      expect(result.valid).toBe(true);
      expect(result.events).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('reports validation errors', () => {
      const result = validateObject(
        {
          name: 'John',
          age: -5, // Invalid
          email: 'invalid-email',
        },
        {
          name: validators.string,
          age: validators.positive,
          email: validators.email,
        },
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('includes all events in result', () => {
      const result = validateObject(
        { name: 'John', email: 'john@example.com' },
        {
          name: validators.string,
          email: validators.email,
        },
      );

      expect(result.events).toHaveLength(2);
      expect(result.events.every(e => e.valid)).toBe(true);
    });
  });

  describe('complex validation scenarios', () => {
    it('validates email with additional constraints', () => {
      const validator = createFieldValidator({
        schema: {
          email: allOf(validators.email, validators.minLength(10)),
        },
      });

      expect(validator.validateFieldAtPath('email', 'a@b.c').valid).toBe(false);
      expect(validator.validateFieldAtPath('email', 'user@example.com').valid).toBe(true);
    });

    it('validates flexible input formats', () => {
      const validator = createFieldValidator({
        schema: {
          contact: oneOf(validators.email, validators.url),
        },
      });

      expect(validator.validateFieldAtPath('contact', 'user@example.com').valid).toBe(true);
      expect(validator.validateFieldAtPath('contact', 'https://example.com').valid).toBe(true);
      expect(validator.validateFieldAtPath('contact', 'invalid').valid).toBe(false);
    });

    it('validates numeric ranges', () => {
      const validator = createFieldValidator({
        schema: {
          rating: allOf(validators.number, validators.range(1, 5)),
        },
      });

      expect(validator.validateFieldAtPath('rating', 3).valid).toBe(true);
      expect(validator.validateFieldAtPath('rating', 0).valid).toBe(false);
      expect(validator.validateFieldAtPath('rating', 6).valid).toBe(false);
    });
  });
});
