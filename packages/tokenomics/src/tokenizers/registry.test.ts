import { describe, expect, it } from 'vitest';
import { EstimatorTokenizer, estimateTokenCount } from './estimate.js';
import { TokenizerRegistry } from './registry.js';

describe('EstimatorTokenizer', () => {
  it('counts tokens based on char ratio', () => {
    const t = new EstimatorTokenizer('test', 4);
    expect(t.count('')).toBe(0);
    expect(t.count('a')).toBe(1);
    expect(t.count('abcd')).toBe(1);
    expect(t.count('abcde')).toBe(2);
  });

  it('uses default 4 chars/token when no ratio given', () => {
    const t = new EstimatorTokenizer('default');
    const text = 'hello world this is a test message';
    expect(t.count(text)).toBe(Math.ceil(text.length / 4));
  });
});

describe('estimateTokenCount utility', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokenCount('')).toBe(0);
  });

  it('uses custom chars-per-token ratio', () => {
    expect(estimateTokenCount('hello world', 2)).toBe(6);
    expect(estimateTokenCount('hello world', 10)).toBe(2);
  });
});

describe('TokenizerRegistry', () => {
  const createRegistry = () => new TokenizerRegistry();

  it('resolves gpt-4o to exact tokenizer', () => {
    const registry = createRegistry();
    const result = registry.countTokens('gpt-4o', 'hello world');
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.method).toBe('exact');
  });

  it('resolves gpt-4o-mini via prefix pattern', () => {
    const registry = createRegistry();
    const result = registry.countTokens('gpt-4o-mini', 'hello world');
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.method).toBe('exact');
  });

  it('resolves gpt-4 via cl100k_base', () => {
    const registry = createRegistry();
    const result = registry.countTokens('gpt-4', 'hello world');
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.method).toBe('exact');
  });

  it('resolves claude via family fallback', () => {
    const registry = createRegistry();
    const result = registry.countTokens('claude-sonnet-4-5', 'hello world');
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.method).toBe('estimated');
    expect(result.reason).toContain('claude');
  });

  it('resolves unknown model with default estimator', () => {
    const registry = createRegistry();
    const result = registry.countTokens('unknown-model-x', 'hello world');
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.method).toBe('estimated');
    expect(result.reason).toContain('unknown-model-x');
  });

  it('uses exact tokenizer over family fallback', () => {
    const registry = createRegistry();
    // gpt-4 matches both gpt-4* pattern (exact) and no fallback
    const result = registry.countTokens('gpt-4', 'some text that is longer than a few characters');
    expect(result.method).toBe('exact');
  });

  it('returns matching tokens across resolve and countTokens', () => {
    const registry = createRegistry();
    const tokenizer = registry.resolve('gpt-4o');
    const result = registry.countTokens('gpt-4o', 'hello world');
    expect(tokenizer.count('hello world')).toBe(result.tokens);
    tokenizer.free();
  });

  it('can free all resources', () => {
    const registry = createRegistry();
    // Resolve multiple models to trigger cache population
    registry.resolve('gpt-4o');
    registry.resolve('gpt-4');
    // Should not throw
    expect(() => registry.freeAll()).not.toThrow();
  });
});
