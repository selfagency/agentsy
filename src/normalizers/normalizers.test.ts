import { describe, expect, it } from 'vitest';
import { normalizeAnthropicEvent } from './anthropic.js';
import { normalizeGeminiChunk } from './gemini.js';
import { normalizeOllamaChatChunk, normalizeOllamaGenerateChunk } from './ollama.js';
import { normalizeOpenAIChatChunk } from './openai.js';
import { normalizeOpenAIResponseEvent } from './openaiResponses.js';

// ---------------------------------------------------------------------------
// OpenAI Chat Completions streaming chunk normalizer
// ---------------------------------------------------------------------------

describe('normalizeOpenAIChatChunk', () => {
  it('maps content delta to chunk.content', () => {
    const result = normalizeOpenAIChatChunk({
      id: 'chatcmpl-abc',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [{ index: 0, delta: { role: 'assistant', content: 'Hello' }, finish_reason: null }],
    });
    expect(result?.chunk.content).toBe('Hello');
    expect(result?.chunk.done).toBeFalsy();
  });

  it('maps thinking/reasoning_content delta to chunk.thinking', () => {
    const result = normalizeOpenAIChatChunk({
      id: 'chatcmpl-abc',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [{ index: 0, delta: { role: 'assistant', reasoning_content: 'Thinking...' }, finish_reason: null }],
    });
    expect(result?.chunk.thinking).toBe('Thinking...');
  });

  it('sets done=true on finish_reason stop', () => {
    const result = normalizeOpenAIChatChunk({
      id: 'chatcmpl-abc',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    });
    expect(result?.chunk.done).toBe(true);
  });

  it('sets done=true on finish_reason tool_calls', () => {
    const result = normalizeOpenAIChatChunk({
      id: 'chatcmpl-abc',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
    });
    expect(result?.chunk.done).toBe(true);
  });

  it('maps tool_call delta to nativeToolCallDeltas', () => {
    const result = normalizeOpenAIChatChunk({
      id: 'chatcmpl-abc',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'call_xyz',
                type: 'function',
                function: { name: 'get_weather', arguments: '' },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    });
    expect(result?.chunk.nativeToolCallDeltas).toHaveLength(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.index).toBe(0);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.id).toBe('call_xyz');
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.name).toBe('get_weather');
  });

  it('maps tool_call argument delta', () => {
    const result = normalizeOpenAIChatChunk({
      id: 'chatcmpl-abc',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [{ index: 0, function: { name: null, arguments: '{"city"' } }],
          },
          finish_reason: null,
        },
      ],
    });
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.argumentsDelta).toBe('{"city"');
  });

  it('extracts usage from final chunk', () => {
    const result = normalizeOpenAIChatChunk({
      id: 'chatcmpl-abc',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
    expect(result?.usage?.inputTokens).toBe(10);
    expect(result?.usage?.outputTokens).toBe(20);
    expect(result?.usage?.totalTokens).toBe(30);
  });

  it('returns null for unrecognizable input', () => {
    expect(normalizeOpenAIChatChunk(null)).toBeNull();
    expect(normalizeOpenAIChatChunk({ object: 'something.else' })).toBeNull();
    expect(normalizeOpenAIChatChunk('raw string')).toBeNull();
  });

  it('never throws on adversarial input', () => {
    expect(() => normalizeOpenAIChatChunk({ choices: 'not-an-array' })).not.toThrow();
    expect(() => normalizeOpenAIChatChunk({ choices: [null] })).not.toThrow();
    expect(() => normalizeOpenAIChatChunk(undefined)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// OpenAI Responses API streaming event normalizer
// ---------------------------------------------------------------------------

describe('normalizeOpenAIResponseEvent', () => {
  it('maps response.output_text.delta to chunk.content', () => {
    const result = normalizeOpenAIResponseEvent({
      type: 'response.output_text.delta',
      event_id: 'ev_001',
      item_id: 'item_001',
      output_index: 0,
      content_index: 0,
      delta: 'Hello ',
    });
    expect(result?.chunk.content).toBe('Hello ');
    expect(result?.chunk.done).toBeFalsy();
  });

  it('maps response.output_text.delta with empty delta to empty content', () => {
    const result = normalizeOpenAIResponseEvent({
      type: 'response.output_text.delta',
      delta: '',
    });
    expect(result?.chunk.content).toBe('');
  });

  it('maps response.refusal.delta to chunk.content (refusal text)', () => {
    const result = normalizeOpenAIResponseEvent({
      type: 'response.refusal.delta',
      event_id: 'ev_002',
      item_id: 'item_001',
      output_index: 0,
      content_index: 0,
      delta: 'I cannot help with that.',
    });
    expect(result?.chunk.content).toBe('I cannot help with that.');
  });

  it('maps response.output_item.added for function_call to nativeToolCallDeltas', () => {
    const result = normalizeOpenAIResponseEvent({
      type: 'response.output_item.added',
      event_id: 'ev_003',
      output_index: 0,
      item: {
        type: 'function_call',
        id: 'item_001',
        call_id: 'call_abc',
        name: 'get_weather',
        status: 'in_progress',
      },
    });
    expect(result?.chunk.nativeToolCallDeltas).toHaveLength(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.index).toBe(0);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.id).toBe('call_abc');
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.name).toBe('get_weather');
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.argumentsDelta).toBeUndefined();
  });

  it('maps response.function_call_arguments.delta to nativeToolCallDeltas', () => {
    const result = normalizeOpenAIResponseEvent({
      type: 'response.function_call_arguments.delta',
      event_id: 'ev_004',
      item_id: 'item_001',
      output_index: 0,
      call_id: 'call_abc',
      delta: '{"city"',
    });
    expect(result?.chunk.nativeToolCallDeltas).toHaveLength(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.index).toBe(0);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.id).toBe('call_abc');
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.argumentsDelta).toBe('{"city"');
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.name).toBeUndefined();
  });

  it('maps response.completed to done=true with usage', () => {
    const result = normalizeOpenAIResponseEvent({
      type: 'response.completed',
      event_id: 'ev_005',
      response: {
        id: 'resp_001',
        status: 'completed',
        usage: { input_tokens: 15, output_tokens: 25, total_tokens: 40 },
      },
    });
    expect(result?.chunk.done).toBe(true);
    expect(result?.usage?.inputTokens).toBe(15);
    expect(result?.usage?.outputTokens).toBe(25);
    expect(result?.usage?.totalTokens).toBe(40);
  });

  it('returns null for unknown event types', () => {
    expect(normalizeOpenAIResponseEvent({ type: 'response.created' })).toBeNull();
    expect(normalizeOpenAIResponseEvent({ type: 'response.in_progress' })).toBeNull();
    expect(normalizeOpenAIResponseEvent({ type: 'response.output_item.done' })).toBeNull();
    expect(normalizeOpenAIResponseEvent({ type: 'something.unknown' })).toBeNull();
  });

  it('returns null for non-object or missing type', () => {
    expect(normalizeOpenAIResponseEvent(null)).toBeNull();
    expect(normalizeOpenAIResponseEvent('raw string')).toBeNull();
    expect(normalizeOpenAIResponseEvent({})).toBeNull();
  });

  it('never throws on adversarial input', () => {
    expect(() => normalizeOpenAIResponseEvent({ type: 'response.output_text.delta', delta: null })).not.toThrow();
    expect(() => normalizeOpenAIResponseEvent({ type: 'response.completed', response: null })).not.toThrow();
    expect(() => normalizeOpenAIResponseEvent(undefined)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Anthropic Claude SSE streaming event normalizer
// ---------------------------------------------------------------------------

describe('normalizeAnthropicEvent', () => {
  it('extracts input token usage from message_start', () => {
    const result = normalizeAnthropicEvent({
      type: 'message_start',
      message: {
        id: 'msg_01',
        type: 'message',
        role: 'assistant',
        content: [],
        model: 'claude-opus-4-6',
        stop_reason: null,
        usage: { input_tokens: 25, output_tokens: 1 },
      },
    });
    expect(result?.usage?.inputTokens).toBe(25);
  });

  it('maps content_block_delta text_delta to chunk.content', () => {
    const result = normalizeAnthropicEvent({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'Hello!' },
    });
    expect(result?.chunk.content).toBe('Hello!');
  });

  it('maps content_block_delta thinking_delta to chunk.thinking', () => {
    const result = normalizeAnthropicEvent({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'thinking_delta', thinking: 'Let me reason...' },
    });
    expect(result?.chunk.thinking).toBe('Let me reason...');
  });

  it('maps content_block_delta input_json_delta to nativeToolCallDeltas', () => {
    const result = normalizeAnthropicEvent({
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '{"location":"' },
    });
    expect(result?.chunk.nativeToolCallDeltas).toHaveLength(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.index).toBe(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.argumentsDelta).toBe('{"location":"');
  });

  it('maps content_block_start tool_use to nativeToolCallDeltas with name+id', () => {
    const result = normalizeAnthropicEvent({
      type: 'content_block_start',
      index: 1,
      content_block: {
        type: 'tool_use',
        id: 'toolu_01A09',
        name: 'get_weather',
        input: {},
      },
    });
    expect(result?.chunk.nativeToolCallDeltas).toHaveLength(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.index).toBe(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.id).toBe('toolu_01A09');
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.name).toBe('get_weather');
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.argumentsDelta).toBeUndefined();
  });

  it('returns null for content_block_start with text type', () => {
    const result = normalizeAnthropicEvent({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    });
    expect(result).toBeNull();
  });

  it('maps message_delta stop_reason end_turn to done=true with output tokens', () => {
    const result = normalizeAnthropicEvent({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 42 },
    });
    expect(result?.chunk.done).toBe(true);
    expect(result?.usage?.outputTokens).toBe(42);
  });

  it('maps message_delta stop_reason tool_use to done=true', () => {
    const result = normalizeAnthropicEvent({
      type: 'message_delta',
      delta: { stop_reason: 'tool_use' },
      usage: { output_tokens: 10 },
    });
    expect(result?.chunk.done).toBe(true);
  });

  it('maps message_stop to done=true', () => {
    const result = normalizeAnthropicEvent({ type: 'message_stop' });
    expect(result?.chunk.done).toBe(true);
  });

  it('returns null for unknown/informational event types', () => {
    expect(normalizeAnthropicEvent({ type: 'content_block_stop', index: 0 })).toBeNull();
    expect(normalizeAnthropicEvent({ type: 'ping' })).toBeNull();
  });

  it('returns null for non-object or missing type', () => {
    expect(normalizeAnthropicEvent(null)).toBeNull();
    expect(normalizeAnthropicEvent('text')).toBeNull();
    expect(normalizeAnthropicEvent({})).toBeNull();
  });

  it('never throws on adversarial input', () => {
    expect(() => normalizeAnthropicEvent({ type: 'content_block_delta', delta: null })).not.toThrow();
    expect(() => normalizeAnthropicEvent({ type: 'message_start', message: null })).not.toThrow();
    expect(() => normalizeAnthropicEvent(undefined)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Ollama NDJSON normalizer
// ---------------------------------------------------------------------------

describe('normalizeOllamaChatChunk', () => {
  it('maps message.content to chunk.content', () => {
    const result = normalizeOllamaChatChunk({
      model: 'llama3.2',
      created_at: '2024-01-01T00:00:00Z',
      message: { role: 'assistant', content: 'Hello ' },
      done: false,
    });
    expect(result?.chunk.content).toBe('Hello ');
    expect(result?.chunk.done).toBeFalsy();
  });

  it('sets done=true on done:true chunk and extracts usage', () => {
    const result = normalizeOllamaChatChunk({
      model: 'llama3.2',
      created_at: '2024-01-01T00:00:00Z',
      message: { role: 'assistant', content: '' },
      done: true,
      prompt_eval_count: 26,
      eval_count: 150,
    });
    expect(result?.chunk.done).toBe(true);
    expect(result?.usage?.inputTokens).toBe(26);
    expect(result?.usage?.outputTokens).toBe(150);
  });

  it('maps message.tool_calls to nativeToolCallDeltas', () => {
    const result = normalizeOllamaChatChunk({
      model: 'llama3.2',
      created_at: '2024-01-01T00:00:00Z',
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [
          { function: { name: 'get_weather', arguments: { location: 'Boston' } } },
        ],
      },
      done: false,
    });
    expect(result?.chunk.nativeToolCallDeltas).toHaveLength(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.index).toBe(0);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.name).toBe('get_weather');
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.argumentsDelta).toBe(
      JSON.stringify({ location: 'Boston' }),
    );
  });

  it('returns null when message field is absent', () => {
    expect(normalizeOllamaChatChunk({ model: 'llama3.2', response: 'hello', done: false })).toBeNull();
    expect(normalizeOllamaChatChunk(null)).toBeNull();
  });

  it('never throws on adversarial input', () => {
    expect(() => normalizeOllamaChatChunk({ message: null })).not.toThrow();
    expect(() => normalizeOllamaChatChunk({ message: { tool_calls: 'bad' } })).not.toThrow();
    expect(() => normalizeOllamaChatChunk(undefined)).not.toThrow();
  });
});

describe('normalizeOllamaGenerateChunk', () => {
  it('maps response field to chunk.content', () => {
    const result = normalizeOllamaGenerateChunk({
      model: 'llama3.2',
      created_at: '2024-01-01T00:00:00Z',
      response: 'The capital',
      done: false,
    });
    expect(result?.chunk.content).toBe('The capital');
  });

  it('sets done=true on done:true and extracts usage', () => {
    const result = normalizeOllamaGenerateChunk({
      model: 'llama3.2',
      created_at: '2024-01-01T00:00:00Z',
      response: '',
      done: true,
      prompt_eval_count: 10,
      eval_count: 80,
    });
    expect(result?.chunk.done).toBe(true);
    expect(result?.usage?.inputTokens).toBe(10);
    expect(result?.usage?.outputTokens).toBe(80);
  });

  it('returns null when response field is absent', () => {
    expect(normalizeOllamaGenerateChunk({ model: 'llama3.2', message: {}, done: false })).toBeNull();
    expect(normalizeOllamaGenerateChunk(null)).toBeNull();
  });

  it('never throws on adversarial input', () => {
    expect(() => normalizeOllamaGenerateChunk({ response: 42 })).not.toThrow();
    expect(() => normalizeOllamaGenerateChunk(undefined)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Gemini normalizer
// ---------------------------------------------------------------------------

describe('normalizeGeminiChunk', () => {
  it('maps candidates[0].content.parts[0].text to chunk.content', () => {
    const result = normalizeGeminiChunk({
      candidates: [
        {
          content: { parts: [{ text: 'Hello ' }], role: 'model' },
          finishReason: 'FINISH_REASON_UNSPECIFIED',
          index: 0,
        },
      ],
    });
    expect(result?.chunk.content).toBe('Hello ');
    expect(result?.chunk.done).toBeFalsy();
  });

  it('concatenates multiple text parts into chunk.content', () => {
    const result = normalizeGeminiChunk({
      candidates: [
        {
          content: { parts: [{ text: 'Hello' }, { text: ' world' }], role: 'model' },
          finishReason: 'FINISH_REASON_UNSPECIFIED',
        },
      ],
    });
    expect(result?.chunk.content).toBe('Hello world');
  });

  it('maps thought:true parts to chunk.thinking', () => {
    const result = normalizeGeminiChunk({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: 'Let me reason...' },
              { text: 'The answer is 42.' },
            ],
            role: 'model',
          },
          finishReason: 'FINISH_REASON_UNSPECIFIED',
        },
      ],
    });
    expect(result?.chunk.thinking).toBe('Let me reason...');
    expect(result?.chunk.content).toBe('The answer is 42.');
  });

  it('maps functionCall parts to nativeToolCallDeltas', () => {
    const result = normalizeGeminiChunk({
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: { name: 'get_weather', args: { location: 'Boston' } },
              },
            ],
            role: 'model',
          },
          finishReason: 'STOP',
        },
      ],
    });
    expect(result?.chunk.nativeToolCallDeltas).toHaveLength(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.index).toBe(0);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.name).toBe('get_weather');
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.argumentsDelta).toBe(
      JSON.stringify({ location: 'Boston' }),
    );
  });

  it('sets done=true on finishReason STOP', () => {
    const result = normalizeGeminiChunk({
      candidates: [
        { content: { parts: [], role: 'model' }, finishReason: 'STOP' },
      ],
    });
    expect(result?.chunk.done).toBe(true);
  });

  it('sets done=true on finishReason MAX_TOKENS', () => {
    const result = normalizeGeminiChunk({
      candidates: [
        { content: { parts: [], role: 'model' }, finishReason: 'MAX_TOKENS' },
      ],
    });
    expect(result?.chunk.done).toBe(true);
  });

  it('extracts usageMetadata tokens', () => {
    const result = normalizeGeminiChunk({
      candidates: [{ content: { parts: [], role: 'model' }, finishReason: 'STOP' }],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 30,
        totalTokenCount: 40,
      },
    });
    expect(result?.usage?.inputTokens).toBe(10);
    expect(result?.usage?.outputTokens).toBe(30);
    expect(result?.usage?.totalTokens).toBe(40);
  });

  it('returns null for non-object or missing candidates', () => {
    expect(normalizeGeminiChunk(null)).toBeNull();
    expect(normalizeGeminiChunk('text')).toBeNull();
    expect(normalizeGeminiChunk({ model: 'gemini' })).toBeNull();
    expect(normalizeGeminiChunk({ candidates: [] })).toBeNull();
  });

  it('never throws on adversarial input', () => {
    expect(() => normalizeGeminiChunk({ candidates: [null] })).not.toThrow();
    expect(() => normalizeGeminiChunk({ candidates: [{ content: null }] })).not.toThrow();
    expect(() => normalizeGeminiChunk(undefined)).not.toThrow();
  });
});
