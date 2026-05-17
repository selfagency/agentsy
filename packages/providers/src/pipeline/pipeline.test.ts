import { describe, expect, it } from 'vitest';

import { createPipeline } from './create-pipeline.js';

async function* mockOpenAIStream() {
  yield 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
  yield 'data: {"choices":[{"delta":{"content":" "}}]}\n\n';
  yield 'data: {"choices":[{"delta":{"content":"world"}}]}\n\n';
  yield 'data: [DONE]\n\n';
}

async function* mockStreamWithBadJson() {
  yield 'data: {invalid json}\n\n';
  yield 'data: [DONE]\n\n';
}

async function* mockStreamWithJson() {
  yield 'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n';
  yield 'data: {"choices":[{"delta":{"content":"world"}}]}\n\n';
  yield 'data: [DONE]\n\n';
}

async function* mockClaudeWithThinking() {
  yield 'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking"}}\n\n';
  yield 'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Let me think..."}}\n\n';
  yield 'data: {"type":"content_block_start","index":1,"content_block":{"type":"text"}}\n\n';
  yield 'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Hello"}}\n\n';
  yield 'data: {"type":"message_stop"}\n\n';
}

describe('createPipeline', () => {
  it('composes SSE → normalize → parse into a unified pipeline', async () => {
    const events: unknown[] = [];
    for await (const event of createPipeline(mockOpenAIStream(), {
      provider: 'openai',
      scrubContextTags: false
    })) {
      events.push(event);
    }

    const textEvents = events.filter(
      (e: unknown): e is { type: string; content: string } =>
        typeof e === 'object' && e !== null && (e as Record<string, unknown>).type === 'delta'
    );
    expect(textEvents.length).toBeGreaterThan(0);
    expect(textEvents.map(e => e.content).join('')).toContain('Hello');
  });

  it('emits error events instead of throwing on invalid source', async () => {
    const events: unknown[] = [];
    for await (const event of createPipeline(mockStreamWithBadJson(), {
      provider: 'openai'
    })) {
      events.push(event);
    }

    const errorEvent = events.find(
      (e: unknown): e is { type: string } =>
        typeof e === 'object' && e !== null && (e as Record<string, unknown>).type === 'error'
    );
    expect(errorEvent).toBeDefined();
  });

  it('respects structured content parsing', async () => {
    const events: unknown[] = [];
    for await (const event of createPipeline(mockStreamWithJson(), {
      provider: 'openai',
      scrubContextTags: false
    })) {
      events.push(event);
    }

    const deltaContent = events
      .filter(
        (e: unknown): e is { type: string; content: string } =>
          typeof e === 'object' && e !== null && (e as Record<string, unknown>).type === 'delta'
      )
      .map(e => e.content)
      .join('');
    expect(deltaContent).toBe('helloworld');
  });

  it('emits thinking blocks separately', async () => {
    const events: unknown[] = [];
    for await (const event of createPipeline(mockClaudeWithThinking(), {
      provider: 'anthropic'
    })) {
      events.push(event);
    }

    const hasThinking = events.some(
      (e: unknown): e is { type: string } =>
        typeof e === 'object' && e !== null && (e as Record<string, unknown>).type === 'thinking'
    );
    expect(hasThinking).toBeTruthy();
  });
});
