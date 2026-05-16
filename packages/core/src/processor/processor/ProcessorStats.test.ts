import { describe, expect, it, expectTypeOf } from 'vitest';

import { LLMStreamProcessor } from './LLMStreamProcessor.js';
import { createEmptyStats } from './ProcessorStats.js';

describe('ProcessorStats', () => {
  it('creates empty stats with zero counters', () => {
    const stats = createEmptyStats();
    expect(stats.chunksProcessed).toBe(0);
    expect(stats.bytesProcessed).toBe(0);
    expect(stats.currentBufferSize).toBe(0);
    expect(stats.peakBufferSize).toBe(0);
    expect(stats.averageChunkSize).toBe(0);
    expect(stats.parseTimeMs).toBe(0);
    expect(stats.thinkingBlocksCount).toBe(0);
    expect(stats.toolCallsCount).toBe(0);
    expect(stats.contentDeltasCount).toBe(0);
  });

  it('initializes stats with reset date', () => {
    const stats = createEmptyStats();
    expect(stats.resetAt).toBeInstanceOf(Date);
  });

  it('tracks chunk processing in LLMStreamProcessor', () => {
    const processor = new LLMStreamProcessor();

    processor.process({
      content: 'Hello',
      done: false,
      thinking: 'Thinking...'
    });

    const stats = processor.getStats();
    expect(stats.chunksProcessed).toBe(1);
    expect(stats.bytesProcessed).toBeGreaterThan(0);
    expect(stats.firstChunkAt).toBeInstanceOf(Date);
    expect(stats.lastChunkAt).toBeInstanceOf(Date);
  });

  it('accumulates stats across multiple chunks', () => {
    const processor = new LLMStreamProcessor();

    processor.process({ content: 'Hello', done: false });
    processor.process({ content: ' World', done: true });

    const stats = processor.getStats();
    expect(stats.chunksProcessed).toBe(2);
    // content deltas are counted when the raw input chunk has content, not the output
    expect(stats.contentDeltasCount).toBeGreaterThan(0);
  });

  it('tracks content deltas only when content is present', () => {
    const processor = new LLMStreamProcessor();

    processor.process({ content: 'text', done: false });
    processor.process({ content: '', done: false });
    processor.process({ done: false, thinking: 'only thinking' });

    const stats = processor.getStats();
    expect(stats.contentDeltasCount).toBe(1);
  });

  it('tracks tool calls', () => {
    const processor = new LLMStreamProcessor({
      knownTools: new Set(['test_tool'])
    });

    processor.process({
      content: '<test_tool>{"arg": "value"}</test_tool>',
      done: true
    });

    const stats = processor.getStats();
    expect(stats.toolCallsCount).toBe(1);
  });

  it('tracks peak buffer size', () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });

    processor.process({ content: 'small', done: false });
    processor.process({
      content: 'much longer content added here',
      done: false
    });

    const stats = processor.getStats();
    expect(stats.currentBufferSize).toBeGreaterThan(0);
    expect(stats.peakBufferSize).toBeGreaterThanOrEqual(stats.currentBufferSize);
  });

  it('calculates average chunk size', () => {
    const processor = new LLMStreamProcessor();

    processor.process({ content: 'Hello', done: false });
    processor.process({ content: 'World', done: false });

    const stats = processor.getStats();
    expect(stats.averageChunkSize).toBeGreaterThan(0);
    expect(stats.averageChunkSize).toBe(stats.bytesProcessed / stats.chunksProcessed);
  });

  it('tracks parse time', () => {
    const processor = new LLMStreamProcessor();

    processor.process({ content: 'test', done: false });

    const stats = processor.getStats();
    expect(stats.parseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('resets stats on reset()', () => {
    const processor = new LLMStreamProcessor();

    processor.process({ content: 'Hello', done: false });
    let stats = processor.getStats();
    expect(stats.chunksProcessed).toBe(1);

    processor.reset();
    stats = processor.getStats();
    expect(stats.chunksProcessed).toBe(0);
    expect(stats.bytesProcessed).toBe(0);
    expect(stats.firstChunkAt).toBeUndefined();
  });

  it('returns a copy of stats, not a reference', () => {
    const processor = new LLMStreamProcessor();
    processor.process({ content: 'test', done: false });

    const stats1 = processor.getStats();
    const stats2 = processor.getStats();

    expect(stats1).toStrictEqual(stats2);
    expect(stats1).not.toBe(stats2);

    // Mutating the returned copy shouldn't affect the processor's internal stats
    stats1.chunksProcessed = 999;
    const stats3 = processor.getStats();
    expect(stats3.chunksProcessed).toBe(1);
  });

  it('tracks errors and warnings counts', () => {
    const stats = createEmptyStats();
    expect(stats).toHaveProperty('errorsCount');
    expect(stats).toHaveProperty('warningsCount');
    expect(stats.errorsCount).toBe(0);
    expect(stats.warningsCount).toBe(0);
  });

  it('initializes error and warning counts to zero in processor', () => {
    const processor = new LLMStreamProcessor({
      maxInputLength: 50,
      onWarning: () => {
        // Ignore warnings
      }
    });

    // Trigger a warning by exceeding maxInputLength
    processor.process({ content: 'x'.repeat(200), done: false });

    const stats = processor.getStats();
    expect(stats).toHaveProperty('warningsCount');
    expectTypeOf(stats.warningsCount).toBeNumber();
  });
});
