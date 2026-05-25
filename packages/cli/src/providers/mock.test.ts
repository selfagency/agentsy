import { describe, expect, it } from 'vitest';

import { createMockClient } from './mock.js';

describe('createMockClient', () => {
  const client = createMockClient({ chunkDelayMs: 1 });

  it('returns a completion response with content', async () => {
    const response = await client.complete({
      model: 'mock-model',
      messages: [{ role: 'user', content: 'Hello' }]
    });

    expect(response.content).toBeDefined();
    expect(response.content).toContain('mock LLM response');
    expect(response.model).toBe('mock-model');
    expect(response.usage).toBeDefined();
    expect(response.usage?.inputTokens).toBe(10);
  });

  it('returns a readable stream with chunks', async () => {
    const stream = await client.stream({
      model: 'mock-model',
      messages: [{ role: 'user', content: 'Hi' }]
    });

    const reader = stream.getReader();
    const chunks: unknown[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
    }

    expect(chunks.length).toBeGreaterThan(0);

    // First chunk should be thinking
    const first = chunks[0] as Record<string, unknown>;
    expect(first.thinking).toBeDefined();

    // Last chunk should have done=true
    const last = chunks[chunks.length - 1] as Record<string, unknown>;
    expect(last.done).toBe(true);
  });

  it('honours custom response text', async () => {
    const customClient = createMockClient({
      responseText: 'Custom response',
      chunkDelayMs: 1
    });

    const response = await customClient.complete({
      model: 'test',
      messages: [{ role: 'user', content: 'Hello' }]
    });

    expect(response.content).toBe('Custom response');
  });
});
