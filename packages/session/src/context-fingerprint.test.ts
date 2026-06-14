import { describe, expect, it } from 'vitest';
import { computeContextFingerprint, isCacheValid } from './context-fingerprint.js';

describe('computeContextFingerprint', () => {
  it('computes deterministic fingerprints', () => {
    const a = computeContextFingerprint({
      contextContent: 'hello world',
      lastMemoryRefresh: '2026-01-01T00:00:00Z',
      messageCount: 5,
      modelId: 'gpt-4o'
    });
    const b = computeContextFingerprint({
      contextContent: 'hello world',
      lastMemoryRefresh: '2026-01-01T00:00:00Z',
      messageCount: 5,
      modelId: 'gpt-4o'
    });
    expect(a.hash).toBe(b.hash);
  });

  it('produces different hashes for different content', () => {
    const a = computeContextFingerprint({
      contextContent: 'content a',
      lastMemoryRefresh: '2026-01-01T00:00:00Z',
      messageCount: 5,
      modelId: 'gpt-4o'
    });
    const b = computeContextFingerprint({
      contextContent: 'content b',
      lastMemoryRefresh: '2026-01-01T00:00:00Z',
      messageCount: 5,
      modelId: 'gpt-4o'
    });
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('isCacheValid', () => {
  it('returns true when fingerprints match', () => {
    const fp = computeContextFingerprint({
      contextContent: 'test',
      lastMemoryRefresh: '2026-01-01T00:00:00Z',
      messageCount: 3,
      modelId: 'gpt-4'
    });
    expect(isCacheValid(fp, fp)).toBe(true);
  });

  it('returns false when model changes', () => {
    const fresh = computeContextFingerprint({
      contextContent: 'test',
      lastMemoryRefresh: '2026-01-01T00:00:00Z',
      messageCount: 3,
      modelId: 'gpt-4o'
    });
    const cached = computeContextFingerprint({
      contextContent: 'test',
      lastMemoryRefresh: '2026-01-01T00:00:00Z',
      messageCount: 3,
      modelId: 'gpt-4'
    });
    expect(isCacheValid(fresh, cached)).toBe(false);
  });

  it('returns false when message count changes', () => {
    const fresh = computeContextFingerprint({
      contextContent: 'test',
      lastMemoryRefresh: '2026-01-01T00:00:00Z',
      messageCount: 10,
      modelId: 'gpt-4o'
    });
    const cached = computeContextFingerprint({
      contextContent: 'test',
      lastMemoryRefresh: '2026-01-01T00:00:00Z',
      messageCount: 5,
      modelId: 'gpt-4o'
    });
    expect(isCacheValid(fresh, cached)).toBe(false);
  });

  it('returns false when memory refresh time changes', () => {
    const fresh = computeContextFingerprint({
      contextContent: 'test',
      lastMemoryRefresh: '2026-06-01T00:00:00Z',
      messageCount: 3,
      modelId: 'gpt-4o'
    });
    const cached = computeContextFingerprint({
      contextContent: 'test',
      lastMemoryRefresh: '2026-01-01T00:00:00Z',
      messageCount: 3,
      modelId: 'gpt-4o'
    });
    expect(isCacheValid(fresh, cached)).toBe(false);
  });

  it('returns false when content hash changes', () => {
    const fresh = computeContextFingerprint({
      contextContent: 'new content',
      lastMemoryRefresh: '2026-01-01T00:00:00Z',
      messageCount: 3,
      modelId: 'gpt-4o'
    });
    const cached = computeContextFingerprint({
      contextContent: 'old content',
      lastMemoryRefresh: '2026-01-01T00:00:00Z',
      messageCount: 3,
      modelId: 'gpt-4o'
    });
    expect(isCacheValid(fresh, cached)).toBe(false);
  });
});
