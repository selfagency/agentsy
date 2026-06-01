import { describe, expect, it } from 'vitest';

import { createMemoryEngine } from '../cognitive/memory-engine.js';
import { onResponse } from './on-response.js';
import { onToolCall } from './on-tool-call.js';

function assertDefined<T>(value: T | undefined): asserts value is T {
  // biome-ignore lint/suspicious/noMisplacedAssertion: Assertion guards used inside it() blocks
  expect(value).toBeDefined();
}

describe('on-tool-call hook', () => {
  it('should capture tool call as episodic memory', () => {
    const engine = createMemoryEngine();
    const result = onToolCall({
      engine,
      toolName: 'file_read',
      toolInput: { path: '/home/user/test.txt' },
      toolOutput: 'file contents here'
    });

    expect(result.memoryId).not.toBeNull();
    expect(result.importance).toBeGreaterThan(0);

    const stats = engine.stats();
    expect(stats.totalItems).toBe(1);
  });

  it('should assign higher importance to write tools', () => {
    const engine = createMemoryEngine();
    const result = onToolCall({
      engine,
      toolName: 'file_write',
      toolInput: { path: '/home/user/output.txt' },
      toolOutput: 'written successfully'
    });

    expect(result.importance).toBeGreaterThanOrEqual(0.7);
  });

  it('should assign lower importance to read tools', () => {
    const engine = createMemoryEngine();
    const result = onToolCall({
      engine,
      toolName: 'file_read',
      toolInput: { path: '/home/user/data.txt' },
      toolOutput: 'data contents'
    });

    expect(result.importance).toBeLessThanOrEqual(0.4);
  });

  it('should allow explicit importance override', () => {
    const engine = createMemoryEngine();
    const result = onToolCall({
      engine,
      toolName: 'file_read',
      toolInput: { path: '/home/user/important.txt' },
      toolOutput: 'important data',
      importance: 0.95
    });

    expect(result.importance).toBe(0.95);
  });

  it('should truncate long tool output', () => {
    const engine = createMemoryEngine();
    const longOutput = 'x'.repeat(500);

    onToolCall({
      engine,
      toolName: 'data_fetch',
      toolInput: { query: 'test' },
      toolOutput: longOutput
    });

    const recall = engine.recall({ crossTier: true, limit: 1 });
    expect(recall.length).toBeGreaterThan(0);
    const tier = recall[0];
    assertDefined(tier);
    expect(tier.items.length).toBeGreaterThan(0);
    const item = tier.items[0];
    assertDefined(item);
    expect(item.content.length).toBeLessThan(longOutput.length + 50);
  });
});

describe('on-response hook', () => {
  it('should capture response as episodic memory', () => {
    const engine = createMemoryEngine();
    const result = onResponse({
      engine,
      responseContent: 'Here is my answer to your question.',
      responseTokens: 100
    });

    expect(result.memoryId).not.toBeNull();
    expect(result.importance).toBeGreaterThan(0);
  });

  it('should assign higher importance to longer responses', () => {
    const engine = createMemoryEngine();

    const shortResult = onResponse({
      engine,
      responseContent: 'Short answer',
      responseTokens: 50
    });

    const longResult = onResponse({
      engine,
      responseContent: 'This is a much longer and more detailed answer with many tokens.',
      responseTokens: 1500
    });

    expect(longResult.importance).toBeGreaterThan(shortResult.importance);
  });

  it('should include model family in metadata when provided', () => {
    const engine = createMemoryEngine();
    onResponse({
      engine,
      responseContent: 'Answer',
      responseTokens: 100,
      modelFamily: 'gpt-4'
    });

    const recall = engine.recall({ crossTier: true, limit: 1 });
    expect(recall.length).toBeGreaterThan(0);
    const tier = recall[0];
    assertDefined(tier);
    expect(tier.items.length).toBeGreaterThan(0);
    const item = tier.items[0];
    assertDefined(item);
    expect(item.metadata.modelFamily).toBe('gpt-4');
    expect(item.metadata.responseTokens).toBe(100);
  });

  it('should truncate long response content', () => {
    const engine = createMemoryEngine();
    const longContent = 'x'.repeat(1000);

    onResponse({
      engine,
      responseContent: longContent,
      responseTokens: 250
    });

    const recall = engine.recall({ crossTier: true, limit: 1 });
    expect(recall.length).toBeGreaterThan(0);
    const tier = recall[0];
    assertDefined(tier);
    expect(tier.items.length).toBeGreaterThan(0);
    const item = tier.items[0];
    assertDefined(item);
    expect(item.content.length).toBeLessThan(longContent.length);
  });
});
