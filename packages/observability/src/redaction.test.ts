import { describe, expect, it } from 'vitest';
import { createRedactionPolicy, DEFAULT_REDACTION_POLICY, redactSecrets } from './redaction.js';

describe('SECRET_PATTERNS', () => {
  it('redacts OpenAI-style API keys', () => {
    const result = redactSecrets('sk-abc123def456ghi789jkl012mno345pqr678stu');
    expect(result).toContain('sk-[REDACTED]');
  });

  it('redacts AWS access keys', () => {
    const result = redactSecrets('AKIA0123456789ABCDEF');
    expect(result).toContain('AKIA[REDACTED]');
  });

  it('redacts GitHub tokens', () => {
    const result = redactSecrets('ghp_abcdefghijklmnopqrstuvwxyz0123456789ab');
    expect(result).toContain('ghp_[REDACTED]');
  });

  it('redacts email addresses', () => {
    const result = redactSecrets('contact me at user@example.com for info');
    expect(result).toContain('[EMAIL-REDACTED]');
  });

  it('redacts SSNs', () => {
    const result = redactSecrets('My SSN is 123-45-6789');
    expect(result).toContain('[SSN-REDACTED]');
  });

  it('leaves non-sensitive text unchanged', () => {
    const result = redactSecrets('Hello, this is a normal message.');
    expect(result).toBe('Hello, this is a normal message.');
  });

  it('redacts multiple patterns in one string', () => {
    const result = redactSecrets('key=sk-abc123def456ghi789jkl012mno345pqr678stu email=user@example.com');
    expect(result).toContain('sk-[REDACTED]');
    expect(result).toContain('[EMAIL-REDACTED]');
  });
});

describe('createRedactionPolicy', () => {
  it('creates a policy with extra patterns', () => {
    const policy = createRedactionPolicy({
      extraPatterns: [
        {
          id: 'custom',
          description: 'Custom pattern',
          pattern: /CUSTOM_SECRET/g,
          replacement: '[CUSTOM]',
          severity: 'high',
          enabled: true
        }
      ]
    });
    const result = policy.redact('CUSTOM_SECRET');
    expect(result).toBe('[CUSTOM]');
  });

  it('uses custom name', () => {
    const policy = createRedactionPolicy({ name: 'strict' });
    expect(policy.name).toBe('strict');
  });
});

describe('DEFAULT_REDACTION_POLICY', () => {
  it('has the default name', () => {
    expect(DEFAULT_REDACTION_POLICY.name).toBe('default');
  });

  it('has at least 5 patterns', () => {
    expect(DEFAULT_REDACTION_POLICY.globalPatterns.length).toBeGreaterThanOrEqual(5);
  });
});
