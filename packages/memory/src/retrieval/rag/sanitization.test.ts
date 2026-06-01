import { describe, expect, it } from 'vitest';

import { sanitizeIngestSource } from './sanitization.js';

describe('sanitization', () => {
  it('should redact Bearer tokens', () => {
    const source = {
      content: 'Access token: bearer abcdef1234567890',
      sourceId: 'test',
      sourceType: 'file' as const
    };
    const sanitized = sanitizeIngestSource(source);
    expect(sanitized.content).toBe('Access token: [REDACTED]');
  });

  it('should redact OpenAI sk- keys', () => {
    const source = {
      content: 'Key is sk-1234567890abcdef1234567890abcdef',
      sourceId: 'test',
      sourceType: 'file' as const
    };
    const sanitized = sanitizeIngestSource(source);
    expect(sanitized.content).toBe('Key is [REDACTED]');
  });

  it('should redact api-key labels', () => {
    const source = {
      content: 'api-key: my-secret-value',
      sourceId: 'test',
      sourceType: 'file' as const
    };
    const sanitized = sanitizeIngestSource(source);
    expect(sanitized.content).toBe('[REDACTED]');
  });

  it('should preserve metadata', () => {
    const source = {
      content: 'nothing here',
      metadata: { foo: 'bar' },
      sourceId: 'test',
      sourceType: 'file' as const
    };
    const sanitized = sanitizeIngestSource(source);
    expect(sanitized.metadata).toStrictEqual({ foo: 'bar' });
  });

  it('should handle undefined metadata', () => {
    const source = {
      content: 'nothing here',
      sourceId: 'test',
      sourceType: 'file' as const
    };
    const sanitized = sanitizeIngestSource(source);
    expect(sanitized.metadata).toBeUndefined();
  });

  it('should be case insensitive for tokens', () => {
    const source = {
      content: 'BEARER secrettokenhere',
      sourceId: 'test',
      sourceType: 'file' as const
    };
    const sanitized = sanitizeIngestSource(source);
    expect(sanitized.content).toBe('[REDACTED]');
  });
});
