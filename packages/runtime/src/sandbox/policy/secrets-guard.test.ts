import { describe, expect, it } from 'vitest';
import { guardSecrets, assertSecretsGuard } from './secrets-guard.js';

describe('guardSecrets', () => {
  it('safe: true when no secrets present', () => {
    const result = guardSecrets('hello world, no secrets here');
    expect(result.safe).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.redacted).toBe('hello world, no secrets here');
  });

  it('detects sk- pattern (OpenAI-style)', () => {
    const result = guardSecrets('token: sk-abcdefghijklmnopqrstu1234567890AB');
    expect(result.safe).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.redacted).toContain('[SECRET_REDACTED]');
    expect(result.redacted).not.toContain('sk-');
  });

  it('detects gho_ pattern (GitHub token)', () => {
    const result = guardSecrets('auth: gho_abcdefghijklmnopqrstuvwxyz0123456789aa');
    expect(result.safe).toBe(false);
    expect(result.redacted).not.toContain('gho_');
  });

  it('detects AKIA pattern (AWS access key)', () => {
    const result = guardSecrets('aws_access_key_id=AKIAIOSFODNN7EXAMPLE12');
    expect(result.safe).toBe(false);
    expect(result.redacted).not.toContain('AKIA');
  });

  it('detects ASIA pattern (AWS temporary credential)', () => {
    const result = guardSecrets('key: ASIAIOSFODNN7EXAMPLEXX');
    expect(result.safe).toBe(false);
  });

  it('safe input passes through unchanged', () => {
    const input = 'const x = 1;\nconsole.log(x);';
    const result = guardSecrets(input);
    expect(result.safe).toBe(true);
    expect(result.redacted).toBe(input);
  });

  it('respects custom patterns option', () => {
    const result = guardSecrets('my-custom-secret-abc', { patterns: [/my-custom-[a-z]+/g] });
    expect(result.safe).toBe(false);
    expect(result.redacted).toContain('[SECRET_REDACTED]');
  });
});

describe('assertSecretsGuard', () => {
  it('returns redacted string for safe input', () => {
    const out = assertSecretsGuard('safe code here');
    expect(out).toBe('safe code here');
  });

  it('throws when secrets detected (default strict mode)', () => {
    expect(() => assertSecretsGuard('key: sk-abcdefghijklmnopqrstu1234567890AB')).toThrow(/Secrets detected/);
  });

  it('does not throw in non-strict mode, returns redacted string', () => {
    const out = assertSecretsGuard('sk-abcdefghijklmnopqrstu1234567890AB', { strict: false });
    expect(out).toContain('[SECRET_REDACTED]');
  });
});
