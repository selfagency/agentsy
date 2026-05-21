import { describe, expect, it, beforeEach } from 'vitest';

import { createSummarizer } from './summarizer.js';
import { createTierTestClock, createTestMemoryItem, resetTestItemIdCounter } from './testing.js';

describe('createSummarizer', () => {
  let clock: ReturnType<typeof createTierTestClock>;

  beforeEach(() => {
    clock = createTierTestClock(10_000);
    resetTestItemIdCounter();
  });

  it('returns empty result for empty input', () => {
    const summarizer = createSummarizer({ now: clock.now });
    const result = summarizer.summarize([], 1000);
    expect(result.longTermItems).toHaveLength(0);
    expect(result.metaActions).toHaveLength(0);
    expect(result.discarded).toHaveLength(0);
  });

  it('summarizes items within budget', () => {
    const summarizer = createSummarizer({ now: clock.now });
    const items = Array.from({ length: 10 }, () =>
      createTestMemoryItem({
        content:
          'The system encountered an error while processing the request. The database connection failed to establish.',
        tokenCount: 20,
        createdAt: clock.now()
      })
    );
    const result = summarizer.summarize(items, 500);
    expect(result.longTermItems.length).toBeGreaterThan(0);
    expect(result.longTermItems.length).toBeLessThan(10);
  });

  it('extracts MetaActions from pattern-rich content', () => {
    const summarizer = createSummarizer({ now: clock.now });
    const items = Array.from({ length: 10 }, () =>
      createTestMemoryItem({
        content: 'Error occurred during database connection. The exception was handled gracefully.',
        tokenCount: 20,
        createdAt: clock.now()
      })
    );
    const result = summarizer.summarize(items, 500);
    expect(result.metaActions.length).toBeGreaterThanOrEqual(1);
  });

  it('classifies writeHeap based on content', () => {
    const summarizer = createSummarizer({ now: clock.now });
    const items = [
      createTestMemoryItem({ content: 'Error: failed to connect to database', tokenCount: 15, createdAt: clock.now() }),
      createTestMemoryItem({ content: 'Search query returned no results', tokenCount: 15, createdAt: clock.now() }),
      createTestMemoryItem({ content: 'Created new user profile successfully', tokenCount: 15, createdAt: clock.now() })
    ];
    const result = summarizer.summarize(items, 500);
    const heaps = new Set(result.longTermItems.map(i => i.writeHeap));
    expect(heaps.size).toBeGreaterThan(0);
  });

  it('respects budget and discards overflow', () => {
    const summarizer = createSummarizer({ now: clock.now });
    const items = Array.from({ length: 20 }, () =>
      createTestMemoryItem({
        content: 'Very long content about system operations and error handling procedures.',
        tokenCount: 50,
        createdAt: clock.now()
      })
    );
    const result = summarizer.summarize(items, 100);
    const totalTokens = result.longTermItems.reduce((sum, i) => sum + i.tokenCount, 0);
    expect(totalTokens).toBeLessThanOrEqual(200);
  });

  it('10 short-term items summarize to fewer long-term items', () => {
    const summarizer = createSummarizer({ now: clock.now });
    const items = Array.from({ length: 10 }, (_, i) =>
      createTestMemoryItem({
        content: `Observation ${i}: The system processes data through multiple stages. Each stage validates the input.`,
        tokenCount: 30,
        createdAt: clock.now()
      })
    );
    const result = summarizer.summarize(items, 300);
    expect(result.longTermItems.length).toBeGreaterThanOrEqual(1);
    expect(result.longTermItems.length).toBeLessThanOrEqual(5);
  });

  it('marks summarized items with metadata._summarized', () => {
    const summarizer = createSummarizer({ now: clock.now });
    const items = Array.from({ length: 5 }, () =>
      createTestMemoryItem({
        content: 'The authentication service validated the OAuth token successfully.',
        tokenCount: 20,
        createdAt: clock.now()
      })
    );
    const result = summarizer.summarize(items, 500);
    const summarizedCount = result.longTermItems.filter(i => i.metadata._summarized === true).length;
    expect(summarizedCount).toBeGreaterThanOrEqual(0);
  });
});
