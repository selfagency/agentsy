/**
 * Integration: normalizer → LLMStreamProcessor
 *
 * Verifies that raw provider event shapes flow through each normalizer and
 * produce the expected processed output from the processor.  These tests
 * treat the two packages as a black-box pipeline — the individual unit tests
 * for each package live alongside their source files.
 */
import { describe, expect, it } from 'vitest';

import type { NormalizerResult } from '@agentsy/core/normalizers';
import {
  normalizeAnthropicEvent,
  normalizeBedrockConverseEvent,
  normalizeCohereEvent,
  normalizeGeminiChunk,
  normalizeOpenAIChatChunk,
  normalizeOpenAIResponseEvent,
} from '@agentsy/core/normalizers';
import { LLMStreamProcessor } from '@agentsy/core/processor';

// ---------------------------------------------------------------------------
// Helper: pump a list of raw provider events through a normalizer and a fresh
// processor, returning the concatenated processed output.
// ---------------------------------------------------------------------------

function pump<T>(
  events: T[],
  normalizer: (e: T) => NormalizerResult | null,
  options: ConstructorParameters<typeof LLMStreamProcessor>[0] = {},
) {
  const processor = new LLMStreamProcessor(options);
  let content = '';
  let thinking = '';
  let done = false;

  for (const event of events) {
    const result = normalizer(event);
    if (!result) continue;
    const out = processor.process(result.chunk);
    content += out.content ?? '';
    thinking += out.thinking ?? '';
    if (out.done) done = true;
  }

  const flush = processor.flush();
  content += flush.content ?? '';
  thinking += flush.thinking ?? '';
  if (flush.done) done = true;

  return { content, thinking, done, processor };
}

// ---------------------------------------------------------------------------
// OpenAI Chat Completions
// ---------------------------------------------------------------------------

describe('normalizeOpenAIChatChunk → LLMStreamProcessor', () => {
  it('accumulates streamed content across multiple chunks', () => {
    const chunks = [
      { choices: [{ delta: { content: 'Hello' }, finish_reason: null }] },
      { choices: [{ delta: { content: ', ' }, finish_reason: null }] },
      { choices: [{ delta: { content: 'world!' }, finish_reason: 'stop' }] },
    ];

    const { content, done } = pump(chunks, normalizeOpenAIChatChunk);
    expect(content).toBe('Hello, world!');
    expect(done).toBe(true);
  });

  it('surfaces thinking / reasoning_content as thinking output', () => {
    const chunks = [
      { choices: [{ delta: { reasoning_content: 'step 1' }, finish_reason: null }] },
      { choices: [{ delta: { reasoning_content: ' step 2', content: 'answer' }, finish_reason: 'stop' }] },
    ];

    const { content, thinking } = pump(chunks, normalizeOpenAIChatChunk);
    expect(thinking).toBe('step 1 step 2');
    expect(content).toBe('answer');
  });

  it('accumulates native tool_call deltas and maps them via processor', () => {
    // Native tool call: name arrives in first chunk, arguments stream in subsequent ones
    const chunks = [
      {
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '' } },
              ],
            },
            finish_reason: null,
          },
        ],
      },
      {
        choices: [
          {
            delta: { tool_calls: [{ index: 0, function: { arguments: '{"city":' } }] },
            finish_reason: null,
          },
        ],
      },
      {
        choices: [
          {
            delta: { tool_calls: [{ index: 0, function: { arguments: '"Paris"}' } }] },
            finish_reason: 'tool_calls',
          },
        ],
      },
    ];

    const processor = new LLMStreamProcessor({ accumulateNativeToolCalls: true });
    for (const c of chunks) {
      const result = normalizeOpenAIChatChunk(c);
      if (result) processor.process(result.chunk);
    }
    processor.flush();

    const accumulated = processor.accumulatedMessage.toolCalls;
    expect(accumulated).toHaveLength(1);
    const [tc] = accumulated;
    expect(tc?.name).toBe('get_weather');
    expect(tc?.parameters).toEqual({ city: 'Paris' });
  });

  it('forwards usage info from the final chunk', () => {
    const chunks = [
      { choices: [{ delta: { content: 'hi' }, finish_reason: null }] },
      {
        choices: [{ delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    ];

    const processor = new LLMStreamProcessor();
    for (const c of chunks) {
      const result = normalizeOpenAIChatChunk(c);
      if (result) processor.process(result.chunk);
    }
    const flush = processor.flush();
    expect(flush.usage).toMatchObject({ inputTokens: 10, outputTokens: 5 });
  });
});

// ---------------------------------------------------------------------------
// OpenAI Responses API
// ---------------------------------------------------------------------------

describe('normalizeOpenAIResponseEvent → LLMStreamProcessor', () => {
  it('accumulates response.output_text.delta events', () => {
    const events = [
      { type: 'response.output_text.delta', delta: 'Hello' },
      { type: 'response.output_text.delta', delta: ' world' },
      { type: 'response.completed', response: { usage: { input_tokens: 5, output_tokens: 2 } } },
    ];

    const processor = new LLMStreamProcessor();
    for (const e of events) {
      const result = normalizeOpenAIResponseEvent(e);
      if (result) processor.process(result.chunk);
    }
    const flush = processor.flush();

    expect(processor.accumulatedMessage.content).toBe('Hello world');
    expect(flush.usage).toMatchObject({ inputTokens: 5, outputTokens: 2 });
  });
});

// ---------------------------------------------------------------------------
// Anthropic Messages API
// ---------------------------------------------------------------------------

describe('normalizeAnthropicEvent → LLMStreamProcessor', () => {
  it('accumulates text content across content_block_delta events', () => {
    const events = [
      { type: 'message_start', message: { usage: { input_tokens: 20 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' Claude' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 8 } },
      { type: 'message_stop' },
    ];

    const { content, done, processor } = pump(events, normalizeAnthropicEvent);
    expect(content).toBe('Hello Claude');
    expect(done).toBe(true);
    expect(processor.accumulatedMessage.usage?.inputTokens).toBe(20);
  });

  it('captures thinking_delta as thinking output', () => {
    const events = [
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Let me think' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'answer' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } },
    ];

    const { thinking, content } = pump(events, normalizeAnthropicEvent);
    expect(thinking).toBe('Let me think');
    expect(content).toBe('answer');
  });

  it('emits native tool call deltas for tool_use blocks', () => {
    const events = [
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'tu_1', name: 'search' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"q":' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '"cats"}' } },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 10 } },
    ];

    const processor = new LLMStreamProcessor({ accumulateNativeToolCalls: true });
    for (const e of events) {
      const result = normalizeAnthropicEvent(e);
      if (result) processor.process(result.chunk);
    }
    processor.flush();

    expect(processor.accumulatedMessage.toolCalls).toHaveLength(1);
    expect(processor.accumulatedMessage.toolCalls[0]?.name).toBe('search');
    expect(processor.accumulatedMessage.toolCalls[0]?.parameters).toEqual({ q: 'cats' });
  });
});

// ---------------------------------------------------------------------------
// Gemini GenerateContent SSE
// ---------------------------------------------------------------------------

describe('normalizeGeminiChunk → LLMStreamProcessor', () => {
  it('accumulates text parts across multiple candidates', () => {
    const chunks = [
      { candidates: [{ content: { parts: [{ text: 'Gemini' }], role: 'model' }, finishReason: null }] },
      {
        candidates: [{ content: { parts: [{ text: ' says hi' }], role: 'model' }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 },
      },
    ];

    const processor = new LLMStreamProcessor();
    for (const c of chunks) {
      const result = normalizeGeminiChunk(c);
      if (result) processor.process(result.chunk);
    }
    const flush = processor.flush();

    expect(processor.accumulatedMessage.content).toBe('Gemini says hi');
    expect(flush.finishReason).toBe('stop');
    expect(flush.usage).toMatchObject({ inputTokens: 5, outputTokens: 3 });
  });
});

// ---------------------------------------------------------------------------
// Amazon Bedrock Converse
// ---------------------------------------------------------------------------

describe('normalizeBedrockConverseEvent → LLMStreamProcessor', () => {
  it('accumulates contentBlockDelta text deltas', () => {
    const events = [
      { contentBlockStart: { start: { text: '' }, contentBlockIndex: 0 } },
      { contentBlockDelta: { delta: { text: 'Bedrock' }, contentBlockIndex: 0 } },
      { contentBlockDelta: { delta: { text: ' response' }, contentBlockIndex: 0 } },
      { messageStop: { stopReason: 'end_turn' } },
    ];

    const { content, done } = pump(events, normalizeBedrockConverseEvent);
    expect(content).toBe('Bedrock response');
    expect(done).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cohere
// ---------------------------------------------------------------------------

describe('normalizeCohereEvent → LLMStreamProcessor', () => {
  it('accumulates text-generation events', () => {
    const events = [
      { type: 'content-delta', index: 0, delta: { message: { content: { text: 'Co' } } } },
      { type: 'content-delta', index: 0, delta: { message: { content: { text: 'here' } } } },
      { type: 'message-end', delta: { finish_reason: 'COMPLETE' } },
    ];

    const { content, done } = pump(events, normalizeCohereEvent);
    expect(content).toBe('Cohere');
    expect(done).toBe(true);
  });
});
