import { describe, expect, it } from 'vitest';

import {
  compressConversation,
  compressOutput,
  createDriftMonitor,
  createTokenLedger,
  findAnchors,
  scoreCoherence
} from './index.js';

describe('createTokenLedger', () => {
  it('consumes tokens within budget', () => {
    const ledger = createTokenLedger({ limit: 10 });

    expect(ledger.consume(4)).toBeTruthy();
    expect(ledger.remaining()).toBe(6);
  });

  it('rejects negative and over-budget token usage', () => {
    const ledger = createTokenLedger({ limit: 5 });

    expect(ledger.consume(-1)).toBeFalsy();
    expect(ledger.consume(6)).toBeFalsy();
    expect(ledger.remaining()).toBe(5);
  });
});

describe('compressConversation', () => {
  it('drops the oldest messages until the estimated token budget fits', () => {
    const result = compressConversation(['aaaa', 'bbbb', 'cccc', 'dddd'], {
      estimateTokens: (value: string) => value.length,
      maxTokens: 8,
      preserveLast: 1
    });

    expect(result.compressed).toBeTruthy();
    expect(result.messages).toStrictEqual(['cccc', 'dddd']);
    expect(result.droppedCount).toBe(2);
    expect(result.estimatedTokens).toBe(8);
  });

  it('uses content-aware routing for diff-heavy input', () => {
    const result = compressConversation(
      [{ content: 'diff --git a/src/a.ts b/src/a.ts\n@@ -1 +1 @@\n-old\n+new' }, { content: '+++ b/src/a.ts' }],
      {
        estimateTokens: (value: { content: string }) => value.content.length,
        maxTokens: 200,
        preserveLast: 0
      }
    );

    expect(result.compressed).toBeFalsy();
    expect(result.messages).toHaveLength(2);
  });
});

describe('drift foundation', () => {
  it('scores coherent conversations higher than repetitive ones', () => {
    const coherent = scoreCoherence([
      { role: 'user', content: 'What is 2 + 2?' },
      { role: 'assistant', content: '2 + 2 = 4.' },
      { role: 'user', content: 'And 4 + 4?' },
      { role: 'assistant', content: '4 + 4 = 8.' }
    ]);

    const repetitive = scoreCoherence([
      { role: 'user', content: 'Explain recursion.' },
      { role: 'assistant', content: 'Recursion is when a function calls itself.' },
      { role: 'user', content: 'Explain recursion again.' },
      { role: 'assistant', content: 'Recursion is when a function calls itself.' }
    ]);

    expect(coherent).toBeGreaterThan(repetitive);
  });

  it('detects anchors in tool calls and directives', () => {
    const anchors = findAnchors([
      { role: 'user', content: 'Use the new API endpoint.' },
      { role: 'assistant', content: 'Switching now.', toolUse: { name: 'query_api', args: {} } }
    ]);

    expect(anchors.some(anchor => anchor.type === 'tool-call')).toBe(true);
    expect(anchors.some(anchor => anchor.type === 'directive')).toBe(true);
  });

  it('tracks drift across repeated compression cycles', () => {
    const monitor = createDriftMonitor({ driftThreshold: 0.7 });
    monitor.recordCompression({ cycle: 1, coherence: 0.95, droppedMessages: 0 });
    monitor.recordCompression({ cycle: 2, coherence: 0.65, droppedMessages: 5 });

    expect(monitor.isDrifting()).toBe(true);
    expect(monitor.getStats().cycles).toBe(2);
  });
});

describe('compressOutput', () => {
  it('reduces token estimate while preserving fenced code blocks', () => {
    const source = [
      'This is a very verbose explanation that repeats itself repeatedly and unnecessarily.',
      '',
      '```ts',
      'const url = "https://example.com/a/b";',
      '```',
      '',
      'This is a very verbose explanation that repeats itself repeatedly and unnecessarily.'
    ].join('\n');

    const result = compressOutput(source, { level: 'full' });

    expect(result.original).toBe(source);
    expect(result.compressed).toContain('```ts');
    expect(result.compressed).toContain('const url = "https://example.com/a/b";');
    expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    expect(result.savingsRatio).toBeGreaterThan(0);
  });

  it('only removes stopwords when they are whitespace-delimited tokens', () => {
    const source = 'Use cache and tokens in production. token, cache,and strict-mode.';

    const result = compressOutput(source, { level: 'full' });

    expect(result.compressed).toContain('token,');
    expect(result.compressed).toContain('cache,and');
  });
});
