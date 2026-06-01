import { describe, it, expect } from 'vitest';
import { sanitizeIngestSource } from './sanitization.js';

describe('sanitization', () => {
  it('should redact Bearer tokens', () => {
    const source = {
      sourceId: 'test',
      sourceType: 'file' as const,
      content: 'Access token: bearer abcdef1234567890'
    };
    const sanitized = sanitizeIngestSource(source);
    expect(sanitized.content).toBe('Access token: [REDACTED]');
  });

  it('should redact OpenAI sk- keys', () => {
    const source = {
      sourceId: 'test',
      sourceType: 'file' as const,
      content: 'Key is sk-1234567890abcdef1234567890abcdef'
    };
    const sanitized = sanitizeIngestSource(source);
    expect(sanitized.content).toBe('Key is [REDACTED]');
  });

  it('should redact api-key labels', () => {
    const source = {
      sourceId: 'test',
      sourceType: 'file' as const,
      content: 'api-key: my-secret-value'
    };
    const sanitized = sanitizeIngestSource(source);
    expect(sanitized.content).toBe('[REDACTED]');
  });

  it('should preserve metadata', () => {
    const source = {
      sourceId: 'test',
      sourceType: 'file' as const,
      content: 'nothing here',
      metadata: { foo: 'bar' }
    };
    const sanitized = sanitizeIngestSource(source);
    expect(sanitized.metadata).toEqual({ foo: 'bar' });
  });

  it('should handle undefined metadata', () => {
    const source = {
      sourceId: 'test',
      sourceType: 'file' as const,
      content: 'nothing here'
    };
    const sanitized = sanitizeIngestSource(source);
    expect(sanitized.metadata).toBeUndefined();
  });

  it('should be case insensitive for tokens', () => {
    const source = {
      sourceId: 'test',
      sourceType: 'file' as const,
      content: 'BEARER secrettokenhere'
    };
    const sanitized = sanitizeIngestSource(source);
    expect(sanitized.content).toBe('[REDACTED]');
  });
});
