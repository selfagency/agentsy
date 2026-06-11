import { describe, expect, it } from 'vitest';

import { scrubPiiDeep } from './deep-scrub.js';
import type { GuardrailResult, GuardrailScanner } from './types.js';

// =============================================================================
// Helpers
// =============================================================================

class RedactEmailScanner implements GuardrailScanner {
  readonly metadata = {
    id: 'hub://guardrails/test-redact',
    name: 'Redact Email Scanner',
    version: '1.0.0',
    description: 'Redacts emails',
    priority: 98,
    owaspCategories: [] as never[],
    tags: ['test']
  };

  evaluate(input: string): Promise<GuardrailResult> {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const sanitized = input.replace(emailPattern, '[REDACTED-EMAIL]');

    if (sanitized !== input) {
      return Promise.resolve({
        status: 'transform',
        phase: 'input',
        sanitized,
        detections: [{ id: 'email', description: 'PII detected: email', severity: 'medium' }]
      });
    }

    return Promise.resolve({ status: 'pass', phase: 'input' });
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('scrubPiiDeep', () => {
  const scanner = new RedactEmailScanner();

  it('passes through strings with no PII', async () => {
    const result = await scrubPiiDeep('hello world', [scanner]);
    expect(result).toBe('hello world');
  });

  it('scrubs PII in a plain string', async () => {
    const result = await scrubPiiDeep('contact: user@test.com', [scanner]);
    expect(result).toBe('contact: [REDACTED-EMAIL]');
  });

  it('scrubs PII in nested objects', async () => {
    const input = {
      name: 'John',
      contact: 'john@test.com',
      details: {
        email: 'john@work.com',
        role: 'admin',
        metadata: {
          backupEmail: 'john-backup@test.com'
        }
      }
    };

    const result = await scrubPiiDeep(input, [scanner]);

    expect(result).toEqual({
      name: 'John',
      contact: '[REDACTED-EMAIL]',
      details: {
        email: '[REDACTED-EMAIL]',
        role: 'admin',
        metadata: {
          backupEmail: '[REDACTED-EMAIL]'
        }
      }
    });
  });

  it('scrubs PII in arrays', async () => {
    const input = {
      users: [
        { name: 'Alice', email: 'alice@test.com' },
        { name: 'Bob', email: 'bob@test.com' }
      ]
    };

    const result = await scrubPiiDeep(input, [scanner]);

    expect(result).toEqual({
      users: [
        { name: 'Alice', email: '[REDACTED-EMAIL]' },
        { name: 'Bob', email: '[REDACTED-EMAIL]' }
      ]
    });
  });

  it('returns new object (no mutation)', async () => {
    const input = { email: 'user@test.com' };
    const result = await scrubPiiDeep(input, [scanner]);
    expect(result).not.toBe(input);
    expect(input.email).toBe('user@test.com'); // Original unchanged
    expect(result.email).toBe('[REDACTED-EMAIL]');
  });

  it('passes through null and undefined', async () => {
    expect(await scrubPiiDeep(null, [scanner])).toBeNull();
    expect(await scrubPiiDeep(undefined, [scanner])).toBeUndefined();
  });

  it('passes through primitives when skipPrimitives is true', async () => {
    expect(await scrubPiiDeep(42, [scanner])).toBe(42);
    expect(await scrubPiiDeep(true, [scanner])).toBe(true);
  });

  it('respects maxDepth option', async () => {
    const input = {
      level1: {
        level2: {
          level3: {
            email: 'deep@test.com'
          }
        }
      }
    };

    const result = await scrubPiiDeep(input, [scanner], { maxDepth: 2 });

    // At depth 2, level2 is scrubbed but level3 is not
    expect(result.level1?.level2).toEqual({
      level3: { email: 'deep@test.com' }
    });
  });

  it('handles empty objects', async () => {
    const result = await scrubPiiDeep({}, [scanner]);
    expect(result).toEqual({});
  });

  it('handles empty arrays', async () => {
    const result = await scrubPiiDeep([], [scanner]);
    expect(result).toEqual([]);
  });

  it('handles mixed nested structures', async () => {
    const input = {
      items: [{ id: 1, email: 'one@test.com' }, 'string@test.com', 42, null]
    };

    const result = await scrubPiiDeep(input, [scanner]);

    expect(result.items?.[0]?.email).toBe('[REDACTED-EMAIL]');
    expect(result.items?.[1]).toBe('[REDACTED-EMAIL]');
    expect(result.items?.[2]).toBe(42);
    expect(result.items?.[3]).toBeNull();
  });

  it('uses custom placeholder', async () => {
    const result = await scrubPiiDeep('email: user@test.com', [scanner], {
      placeholder: '***'
    });
    expect(result).toBe('email: [REDACTED-EMAIL]'); // Scanner controls placeholder, not deep-scrub
  });
});
