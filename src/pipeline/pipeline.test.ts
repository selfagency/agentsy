import { describe, it, expect } from 'vitest';
import { createPipeline } from './createPipeline.js';

describe('createPipeline', () => {
  it('composes SSE → normalize → parse into a unified pipeline', async () => {
    // Simulate an async iterable of text chunks
    async function* mockOpenAIStream() {
      yield 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
      yield 'data: {"choices":[{"delta":{"content":" "}}]}\n\n';
      yield 'data: {"choices":[{"delta":{"content":"world"}}]}\n\n';
      yield 'data: [DONE]\n\n';
    }

    const events: unknown[] = [];
    for await (const event of createPipeline(mockOpenAIStream(), {
      provider: 'openai',
      scrubContextTags: false,
    })) {
      events.push(event);
    }

    // Should have text delta events
    const textEvents = events.filter((e: any) => e.type === 'delta');
    expect(textEvents.length).toBeGreaterThan(0);
    expect(textEvents.map((e: any) => e.content).join('')).toContain('Hello');
  });

  it('emits error events instead of throwing on invalid source', async () => {
    // Test that JSON parse errors are converted to events
    async function* mockStreamWithBadJson() {
      yield 'data: {invalid json}\n\n';
      yield 'data: [DONE]\n\n';
    }

    const events: unknown[] = [];
    for await (const event of createPipeline(mockStreamWithBadJson(), { provider: 'openai' })) {
      events.push(event);
    }

    const errorEvent = events.find((e: any) => e.type === 'error');
    expect(errorEvent).toBeDefined();
  });

  it('respects structured content parsing', async () => {
    // Simulate stream with JSON content
    async function* mockStreamWithJson() {
      yield 'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n';
      yield 'data: {"choices":[{"delta":{"content":"world"}}]}\n\n';
      yield 'data: [DONE]\n\n';
    }

    const events: any[] = [];
    for await (const event of createPipeline(mockStreamWithJson(), {
      provider: 'openai',
      scrubContextTags: false,
    })) {
      events.push(event);
    }

    // Should have emitted deltas
    const deltaContent = events
      .filter(e => e.type === 'delta')
      .map(e => e.content)
      .join('');
    expect(deltaContent).toBe('helloworld');
  });

  it('emits thinking blocks separately', async () => {
    // Simulate Claude stream with thinking
    async function* mockClaudeWithThinking() {
      yield 'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking"}}\n\n';
      yield 'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Let me think..."}}\n\n';
      yield 'data: {"type":"content_block_start","index":1,"content_block":{"type":"text"}}\n\n';
      yield 'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Hello"}}\n\n';
      yield 'data: {"type":"message_stop"}\n\n';
    }

    const events: any[] = [];
    for await (const event of createPipeline(mockClaudeWithThinking(), { provider: 'anthropic' })) {
      events.push(event);
    }

    // Should have thinking and text events
    const hasThinking = events.some(e => e.type === 'thinking');
    expect(hasThinking).toBe(true);
  });
});
