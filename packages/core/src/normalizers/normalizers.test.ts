import { describe, expect, it } from 'vitest';
import { normalizeAnthropicEvent } from './anthropic.js';
import { normalizeBedrockConverseEvent } from './bedrock.js';
import { normalizeCohereEvent } from './cohere.js';
import { normalizeGeminiChunk } from './gemini.js';
import { normalizeHuggingFaceTGIChunk } from './hfTgi.js';
import { normalizeMistralChunk } from './mistral.js';
import { normalizeOllamaChatChunk, normalizeOllamaGenerateChunk } from './ollama.js';
import { normalizeOpenAIChatChunk } from './openai.js';
import {
  OPENAI_COMPATIBLE_NORMALIZER_PROVIDERS,
  isOpenAICompatibleNormalizerProvider,
  normalizeOpenAICompatibleChunk,
} from './openai-compatible.js';
import { normalizeOpenAIResponseEvent } from './openaiResponses.js';
import { normalizeZAiChunk } from './zai.js';

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

  it('maps finish_reason stop to finishReason stop', () => {
    const result = normalizeOpenAIChatChunk({
      id: 'chatcmpl-abc',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    });
    expect(result?.chunk.finishReason).toBe('stop');
  });

  it('maps finish_reason tool_calls to finishReason tool-calls', () => {
    const result = normalizeOpenAIChatChunk({
      id: 'chatcmpl-abc',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
    });
    expect(result?.chunk.finishReason).toBe('tool-calls');
    expect(result?.chunk.done).toBe(true);
  });

  it('maps finish_reason length to finishReason length', () => {
    const result = normalizeOpenAIChatChunk({
      id: 'chatcmpl-abc',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [{ index: 0, delta: {}, finish_reason: 'length' }],
    });
    expect(result?.chunk.finishReason).toBe('length');
  });

  it('maps finish_reason content_filter to finishReason content-filter', () => {
    const result = normalizeOpenAIChatChunk({
      id: 'chatcmpl-abc',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [{ index: 0, delta: {}, finish_reason: 'content_filter' }],
    });
    expect(result?.chunk.finishReason).toBe('content-filter');
  });

  it('does not set finishReason on mid-stream chunks', () => {
    const result = normalizeOpenAIChatChunk({
      id: 'chatcmpl-abc',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [{ index: 0, delta: { content: 'hi' }, finish_reason: null }],
    });
    expect(result?.chunk.finishReason).toBeUndefined();
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

  it('sets done=true on other terminal finish reasons (length, content_filter)', () => {
    for (const finish_reason of ['length', 'content_filter']) {
      const result = normalizeOpenAIChatChunk({
        id: 'chatcmpl-abc',
        object: 'chat.completion.chunk',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [{ index: 0, delta: {}, finish_reason }],
      });
      expect(result?.chunk.done).toBe(true);
    }
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
    expect(result?.chunk.usage?.inputTokens).toBe(10);
    expect(result?.chunk.usage?.outputTokens).toBe(20);
    expect(result?.chunk.usage?.totalTokens).toBe(30);
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

describe('openai-compatible normalizer', () => {
  it('exposes expected provider registry', () => {
    expect(OPENAI_COMPATIBLE_NORMALIZER_PROVIDERS).toEqual(['openai', 'kimi', 'qwen', 'llama', 'granite']);
  });

  it('checks provider compatibility', () => {
    expect(isOpenAICompatibleNormalizerProvider('openai')).toBe(true);
    expect(isOpenAICompatibleNormalizerProvider('qwen')).toBe(true);
    expect(isOpenAICompatibleNormalizerProvider('mistral')).toBe(false);
  });

  it('normalizes openai-compatible chunks through shared helper', () => {
    const result = normalizeOpenAICompatibleChunk('kimi', {
      id: 'chatcmpl-kimi-1',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'kimi-k2',
      choices: [{ index: 0, delta: { content: 'Hello from kimi' }, finish_reason: null }],
    });

    expect(result?.chunk.content).toBe('Hello from kimi');
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
    expect(result?.chunk.usage?.inputTokens).toBe(15);
    expect(result?.chunk.usage?.outputTokens).toBe(25);
    expect(result?.chunk.usage?.totalTokens).toBe(40);
  });

  it('maps response.completed to finishReason stop', () => {
    const result = normalizeOpenAIResponseEvent({
      type: 'response.completed',
      response: { id: 'resp_001', status: 'completed' },
    });
    expect(result?.chunk.finishReason).toBe('stop');
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
    expect(result?.chunk.usage?.inputTokens).toBe(25);
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
    expect(result?.chunk.usage?.outputTokens).toBe(42);
  });

  it('maps message_delta stop_reason end_turn to finishReason stop', () => {
    const result = normalizeAnthropicEvent({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 5 },
    });
    expect(result?.chunk.finishReason).toBe('stop');
  });

  it('maps message_delta stop_reason tool_use to finishReason tool-calls', () => {
    const result = normalizeAnthropicEvent({
      type: 'message_delta',
      delta: { stop_reason: 'tool_use' },
      usage: { output_tokens: 10 },
    });
    expect(result?.chunk.finishReason).toBe('tool-calls');
  });

  it('maps message_delta stop_reason max_tokens to finishReason length', () => {
    const result = normalizeAnthropicEvent({
      type: 'message_delta',
      delta: { stop_reason: 'max_tokens' },
      usage: { output_tokens: 100 },
    });
    expect(result?.chunk.finishReason).toBe('length');
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
    expect(result?.chunk.usage?.inputTokens).toBe(26);
    expect(result?.chunk.usage?.outputTokens).toBe(150);
  });

  it('sets finishReason stop on done:true chunk', () => {
    const result = normalizeOllamaChatChunk({
      model: 'llama3.2',
      created_at: '2024-01-01T00:00:00Z',
      message: { role: 'assistant', content: '' },
      done: true,
    });
    expect(result?.chunk.finishReason).toBe('stop');
  });

  it('does not set finishReason on mid-stream ollama chat chunk', () => {
    const result = normalizeOllamaChatChunk({
      model: 'llama3.2',
      created_at: '2024-01-01T00:00:00Z',
      message: { role: 'assistant', content: 'hi' },
      done: false,
    });
    expect(result?.chunk.finishReason).toBeUndefined();
  });

  it('maps message.tool_calls to nativeToolCallDeltas', () => {
    const result = normalizeOllamaChatChunk({
      model: 'llama3.2',
      created_at: '2024-01-01T00:00:00Z',
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [{ function: { name: 'get_weather', arguments: { location: 'Boston' } } }],
      },
      done: false,
    });
    expect(result?.chunk.nativeToolCallDeltas).toHaveLength(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.index).toBe(0);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.name).toBe('get_weather');
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.argumentsDelta).toBe(JSON.stringify({ location: 'Boston' }));
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
    expect(result?.chunk.usage?.inputTokens).toBe(10);
    expect(result?.chunk.usage?.outputTokens).toBe(80);
  });

  it('sets finishReason stop on done:true generate chunk', () => {
    const result = normalizeOllamaGenerateChunk({
      model: 'llama3.2',
      created_at: '2024-01-01T00:00:00Z',
      response: '',
      done: true,
    });
    expect(result?.chunk.finishReason).toBe('stop');
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
            parts: [{ thought: true, text: 'Let me reason...' }, { text: 'The answer is 42.' }],
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
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.argumentsDelta).toBe(JSON.stringify({ location: 'Boston' }));
  });

  it('sets done=true on finishReason STOP', () => {
    const result = normalizeGeminiChunk({
      candidates: [{ content: { parts: [], role: 'model' }, finishReason: 'STOP' }],
    });
    expect(result?.chunk.done).toBe(true);
  });

  it('maps Gemini finishReason STOP to finishReason stop', () => {
    const result = normalizeGeminiChunk({
      candidates: [{ content: { parts: [], role: 'model' }, finishReason: 'STOP' }],
    });
    expect(result?.chunk.finishReason).toBe('stop');
  });

  it('maps Gemini finishReason MAX_TOKENS to finishReason length', () => {
    const result = normalizeGeminiChunk({
      candidates: [{ content: { parts: [], role: 'model' }, finishReason: 'MAX_TOKENS' }],
    });
    expect(result?.chunk.finishReason).toBe('length');
  });

  it('maps Gemini finishReason SAFETY to finishReason content-filter', () => {
    const result = normalizeGeminiChunk({
      candidates: [{ content: { parts: [], role: 'model' }, finishReason: 'SAFETY' }],
    });
    expect(result?.chunk.finishReason).toBe('content-filter');
  });

  it('sets done=true on finishReason MAX_TOKENS', () => {
    const result = normalizeGeminiChunk({
      candidates: [{ content: { parts: [], role: 'model' }, finishReason: 'MAX_TOKENS' }],
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
    expect(result?.chunk.usage?.inputTokens).toBe(10);
    expect(result?.chunk.usage?.outputTokens).toBe(30);
    expect(result?.chunk.usage?.totalTokens).toBe(40);
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

// ---------------------------------------------------------------------------
// Mistral normalizer (OpenAI-compatible format)
// ---------------------------------------------------------------------------

describe('normalizeMistralChunk', () => {
  it('maps delta.content to chunk.content (OpenAI-compatible)', () => {
    const result = normalizeMistralChunk({
      id: 'cmpl-abc',
      object: 'chat.completion.chunk',
      model: 'mistral-large',
      choices: [{ index: 0, delta: { content: 'Bonjour' }, finish_reason: null }],
    });
    expect(result?.chunk.content).toBe('Bonjour');
  });

  it('sets done=true on finish_reason stop', () => {
    const result = normalizeMistralChunk({
      id: 'cmpl-abc',
      object: 'chat.completion.chunk',
      model: 'mistral-large',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    });
    expect(result?.chunk.done).toBe(true);
  });

  it('maps tool_call delta to nativeToolCallDeltas', () => {
    const result = normalizeMistralChunk({
      id: 'cmpl-abc',
      object: 'chat.completion.chunk',
      model: 'mistral-large',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'search', arguments: '' } }],
          },
          finish_reason: null,
        },
      ],
    });
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.name).toBe('search');
  });

  it('extracts thinking from structured content array (Magistral native reasoning)', () => {
    const result = normalizeMistralChunk({
      id: 'cmpl-abc',
      object: 'chat.completion.chunk',
      model: 'magistral-medium-latest',
      choices: [
        {
          index: 0,
          delta: {
            content: [{ type: 'thinking', thinking: [{ type: 'text', text: 'Let me reason...' }] }],
          },
          finish_reason: null,
        },
      ],
    });
    expect(result?.chunk.thinking).toBe('Let me reason...');
    expect(result?.chunk.content).toBeUndefined();
  });

  it('extracts text from structured content array (Magistral native reasoning)', () => {
    const result = normalizeMistralChunk({
      id: 'cmpl-abc',
      object: 'chat.completion.chunk',
      model: 'magistral-medium-latest',
      choices: [
        {
          index: 0,
          delta: {
            content: [{ type: 'text', text: 'The answer is 42.' }],
          },
          finish_reason: null,
        },
      ],
    });
    expect(result?.chunk.content).toBe('The answer is 42.');
    expect(result?.chunk.thinking).toBeUndefined();
  });

  it('extracts both content and thinking when both appear in one chunk', () => {
    const result = normalizeMistralChunk({
      id: 'cmpl-abc',
      object: 'chat.completion.chunk',
      model: 'magistral-medium-latest',
      choices: [
        {
          index: 0,
          delta: {
            content: [
              { type: 'thinking', thinking: [{ type: 'text', text: 'reasoning' }] },
              { type: 'text', text: 'answer' },
            ],
          },
          finish_reason: null,
        },
      ],
    });
    expect(result?.chunk.thinking).toBe('reasoning');
    expect(result?.chunk.content).toBe('answer');
  });

  it('preserves tool call deltas alongside structured content', () => {
    const result = normalizeMistralChunk({
      id: 'cmpl-abc',
      object: 'chat.completion.chunk',
      model: 'magistral-medium-latest',
      choices: [
        {
          index: 0,
          delta: {
            content: [{ type: 'text', text: 'ok' }],
            tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'fn', arguments: '' } }],
          },
          finish_reason: null,
        },
      ],
    });
    expect(result?.chunk.content).toBe('ok');
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.name).toBe('fn');
  });

  it('returns null for unrecognizable input', () => {
    expect(normalizeMistralChunk(null)).toBeNull();
    expect(normalizeMistralChunk('string')).toBeNull();
  });

  it('never throws on adversarial input', () => {
    expect(() => normalizeMistralChunk({ choices: null })).not.toThrow();
    expect(() => normalizeMistralChunk(undefined)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Cohere v2 streaming event normalizer
// ---------------------------------------------------------------------------

describe('normalizeCohereEvent', () => {
  it('maps content-delta to chunk.content', () => {
    const result = normalizeCohereEvent({
      type: 'content-delta',
      index: 0,
      delta: { message: { content: { text: 'Hello' } } },
    });
    expect(result?.chunk.content).toBe('Hello');
    expect(result?.chunk.done).toBeFalsy();
  });

  it('maps tool-plan-delta to chunk.thinking', () => {
    const result = normalizeCohereEvent({
      type: 'tool-plan-delta',
      delta: { message: { tool_plan: 'I will check the weather.' } },
    });
    expect(result?.chunk.thinking).toBe('I will check the weather.');
  });

  it('maps tool-call-start to nativeToolCallDeltas with id+name', () => {
    const result = normalizeCohereEvent({
      type: 'tool-call-start',
      index: 0,
      delta: {
        message: {
          tool_calls: {
            id: 'get_weather_abc123',
            type: 'function',
            function: { name: 'get_weather', arguments: '' },
          },
        },
      },
    });
    expect(result?.chunk.nativeToolCallDeltas).toHaveLength(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.index).toBe(0);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.id).toBe('get_weather_abc123');
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.name).toBe('get_weather');
  });

  it('maps tool-call-delta to nativeToolCallDeltas with argumentsDelta', () => {
    const result = normalizeCohereEvent({
      type: 'tool-call-delta',
      index: 0,
      delta: { message: { tool_calls: { function: { arguments: '{"location":' } } } },
    });
    expect(result?.chunk.nativeToolCallDeltas).toHaveLength(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.index).toBe(0);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.argumentsDelta).toBe('{"location":');
  });

  it('sets done=true on message-end', () => {
    const result = normalizeCohereEvent({
      type: 'message-end',
      delta: { finish_reason: 'COMPLETE' },
    });
    expect(result?.chunk.done).toBe(true);
  });

  it('maps Cohere message-end COMPLETE to finishReason stop', () => {
    const result = normalizeCohereEvent({
      type: 'message-end',
      delta: { finish_reason: 'COMPLETE' },
    });
    expect(result?.chunk.finishReason).toBe('stop');
  });

  it('maps Cohere message-end MAX_TOKENS to finishReason length', () => {
    const result = normalizeCohereEvent({
      type: 'message-end',
      delta: { finish_reason: 'MAX_TOKENS' },
    });
    expect(result?.chunk.finishReason).toBe('length');
  });

  it('maps Cohere message-end TOOL_CALL to finishReason tool-calls', () => {
    const result = normalizeCohereEvent({
      type: 'message-end',
      delta: { finish_reason: 'TOOL_CALL' },
    });
    expect(result?.chunk.finishReason).toBe('tool-calls');
  });

  it('maps Cohere message-end ERROR to finishReason error', () => {
    const result = normalizeCohereEvent({
      type: 'message-end',
      delta: { finish_reason: 'ERROR' },
    });
    expect(result?.chunk.finishReason).toBe('error');
  });

  it('extracts usage tokens from message-end', () => {
    const result = normalizeCohereEvent({
      type: 'message-end',
      delta: {
        finish_reason: 'COMPLETE',
        usage: { tokens: { input_tokens: 71, output_tokens: 418 } },
      },
    });
    expect(result?.chunk.usage?.inputTokens).toBe(71);
    expect(result?.chunk.usage?.outputTokens).toBe(418);
  });

  it('returns null for informational event types', () => {
    expect(normalizeCohereEvent({ type: 'message-start', id: 'abc' })).toBeNull();
    expect(normalizeCohereEvent({ type: 'content-start', index: 0 })).toBeNull();
    expect(normalizeCohereEvent({ type: 'content-end', index: 0 })).toBeNull();
    expect(normalizeCohereEvent({ type: 'citation-start', index: 0 })).toBeNull();
  });

  it('returns null for non-object or missing type', () => {
    expect(normalizeCohereEvent(null)).toBeNull();
    expect(normalizeCohereEvent('string')).toBeNull();
    expect(normalizeCohereEvent({})).toBeNull();
    expect(normalizeCohereEvent({ type: 42 })).toBeNull();
  });

  it('never throws on adversarial input', () => {
    expect(() => normalizeCohereEvent({ type: 'content-delta', delta: null })).not.toThrow();
    expect(() => normalizeCohereEvent({ type: 'tool-call-start', delta: { message: null } })).not.toThrow();
    expect(() => normalizeCohereEvent(undefined)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AWS Bedrock Converse API streaming event normalizer
// ---------------------------------------------------------------------------

describe('normalizeBedrockConverseEvent', () => {
  it('maps contentBlockDelta.delta.text to chunk.content', () => {
    const result = normalizeBedrockConverseEvent({
      contentBlockDelta: { contentBlockIndex: 0, delta: { text: 'Hello' } },
    });
    expect(result?.chunk.content).toBe('Hello');
    expect(result?.chunk.done).toBeFalsy();
  });

  it('maps contentBlockDelta.delta.reasoningContent.text to chunk.thinking', () => {
    const result = normalizeBedrockConverseEvent({
      contentBlockDelta: {
        contentBlockIndex: 0,
        delta: { reasoningContent: { text: 'Let me think...' } },
      },
    });
    expect(result?.chunk.thinking).toBe('Let me think...');
  });

  it('maps contentBlockDelta.delta.toolUse.input to nativeToolCallDeltas', () => {
    const result = normalizeBedrockConverseEvent({
      contentBlockDelta: {
        contentBlockIndex: 1,
        delta: { toolUse: { input: '{"location":' } },
      },
    });
    expect(result?.chunk.nativeToolCallDeltas).toHaveLength(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.index).toBe(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.argumentsDelta).toBe('{"location":');
  });

  it('maps contentBlockStart.start.toolUse to nativeToolCallDeltas with id+name', () => {
    const result = normalizeBedrockConverseEvent({
      contentBlockStart: {
        contentBlockIndex: 1,
        start: { toolUse: { toolUseId: 'tooluse_abc', name: 'get_weather' } },
      },
    });
    expect(result?.chunk.nativeToolCallDeltas).toHaveLength(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.index).toBe(1);
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.id).toBe('tooluse_abc');
    expect(result?.chunk.nativeToolCallDeltas?.[0]?.name).toBe('get_weather');
  });

  it('sets done=true on messageStop event', () => {
    const result = normalizeBedrockConverseEvent({ messageStop: { stopReason: 'end_turn' } });
    expect(result?.chunk.done).toBe(true);
  });

  it('maps Bedrock messageStop end_turn to finishReason stop', () => {
    const result = normalizeBedrockConverseEvent({ messageStop: { stopReason: 'end_turn' } });
    expect(result?.chunk.finishReason).toBe('stop');
  });

  it('maps Bedrock messageStop tool_use to finishReason tool-calls', () => {
    const result = normalizeBedrockConverseEvent({ messageStop: { stopReason: 'tool_use' } });
    expect(result?.chunk.finishReason).toBe('tool-calls');
  });

  it('maps Bedrock messageStop max_tokens to finishReason length', () => {
    const result = normalizeBedrockConverseEvent({ messageStop: { stopReason: 'max_tokens' } });
    expect(result?.chunk.finishReason).toBe('length');
  });

  it('maps Bedrock messageStop guardrail_intervened to finishReason content-filter', () => {
    const result = normalizeBedrockConverseEvent({ messageStop: { stopReason: 'guardrail_intervened' } });
    expect(result?.chunk.finishReason).toBe('content-filter');
  });

  it('sets done=true for all messageStop stopReason values', () => {
    expect(normalizeBedrockConverseEvent({ messageStop: { stopReason: 'tool_use' } })?.chunk.done).toBe(true);
    expect(normalizeBedrockConverseEvent({ messageStop: { stopReason: 'max_tokens' } })?.chunk.done).toBe(true);
  });

  it('extracts usage from metadata event', () => {
    const result = normalizeBedrockConverseEvent({
      metadata: { usage: { inputTokens: 15, outputTokens: 42, totalTokens: 57 } },
    });
    expect(result?.chunk.usage?.inputTokens).toBe(15);
    expect(result?.chunk.usage?.outputTokens).toBe(42);
    expect(result?.chunk.usage?.totalTokens).toBe(57);
  });

  it('returns null for contentBlockStop and messageStart', () => {
    expect(normalizeBedrockConverseEvent({ contentBlockStop: { contentBlockIndex: 0 } })).toBeNull();
    expect(normalizeBedrockConverseEvent({ messageStart: { role: 'assistant' } })).toBeNull();
  });

  it('returns null for non-Bedrock objects', () => {
    expect(normalizeBedrockConverseEvent(null)).toBeNull();
    expect(normalizeBedrockConverseEvent({ choices: [] })).toBeNull();
    expect(normalizeBedrockConverseEvent('string')).toBeNull();
  });

  it('never throws on adversarial input', () => {
    expect(() => normalizeBedrockConverseEvent({ contentBlockDelta: null })).not.toThrow();
    expect(() => normalizeBedrockConverseEvent({ contentBlockDelta: { delta: null } })).not.toThrow();
    expect(() => normalizeBedrockConverseEvent(undefined)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Z.ai normalizer
// ---------------------------------------------------------------------------

describe('normalizeZAiChunk', () => {
  it('maps content delta to chunk.content', () => {
    const result = normalizeZAiChunk({
      choices: [{ index: 0, delta: { content: 'Hello from Z.ai' }, finish_reason: null }],
    });

    expect(result?.chunk.content).toBe('Hello from Z.ai');
    expect(result?.chunk.done).toBeUndefined();
  });

  it('maps finish reasons to canonical finishReason and done', () => {
    expect(normalizeZAiChunk({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })?.chunk.finishReason).toBe(
      'stop',
    );
    expect(
      normalizeZAiChunk({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })?.chunk.finishReason,
    ).toBe('tool-calls');
    expect(normalizeZAiChunk({ choices: [{ index: 0, delta: {}, finish_reason: 'length' }] })?.chunk.finishReason).toBe(
      'length',
    );
    expect(
      normalizeZAiChunk({ choices: [{ index: 0, delta: {}, finish_reason: 'sensitive' }] })?.chunk.finishReason,
    ).toBe('content-filter');
    expect(
      normalizeZAiChunk({ choices: [{ index: 0, delta: {}, finish_reason: 'model_context_window_exceeded' }] })?.chunk
        .finishReason,
    ).toBe('error');
    expect(
      normalizeZAiChunk({ choices: [{ index: 0, delta: {}, finish_reason: 'network_error' }] })?.chunk.finishReason,
    ).toBe('error');

    expect(normalizeZAiChunk({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })?.chunk.done).toBe(true);
  });

  it('extracts usage from z.ai usage fields', () => {
    const result = normalizeZAiChunk({
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { input_tokens: 7, output_tokens: 13 },
    });

    expect(result?.chunk.usage).toEqual({
      inputTokens: 7,
      outputTokens: 13,
      totalTokens: 20,
    });
  });

  it('returns null for unrecognized payloads', () => {
    expect(normalizeZAiChunk(null)).toBeNull();
    expect(normalizeZAiChunk({})).toBeNull();
    expect(normalizeZAiChunk({ choices: [] })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// HuggingFace Text Generation Inference (TGI) streaming chunk normalizer
// ---------------------------------------------------------------------------

describe('normalizeHuggingFaceTGIChunk', () => {
  it('maps token.text to chunk.content for non-special tokens', () => {
    const result = normalizeHuggingFaceTGIChunk({
      index: 0,
      token: { id: 15496, text: ' Hello', logprob: -0.5, special: false },
      generated_text: null,
      details: null,
    });
    expect(result?.chunk.content).toBe(' Hello');
    expect(result?.chunk.done).toBeFalsy();
  });

  it('omits content for special tokens (e.g., EOS)', () => {
    const result = normalizeHuggingFaceTGIChunk({
      index: 5,
      token: { id: 2, text: '</s>', logprob: 0, special: true },
      generated_text: 'Hello world',
      details: { finish_reason: 'eos_token', generated_tokens: 5, input_length: 10 },
    });
    expect(result?.chunk.content).toBeUndefined();
    expect(result?.chunk.done).toBe(true);
  });

  it('sets done=true and extracts usage on final event with details', () => {
    const result = normalizeHuggingFaceTGIChunk({
      index: 4,
      token: { id: 13, text: '.', logprob: -0.1, special: false },
      generated_text: 'Hello world.',
      details: { finish_reason: 'eos_token', generated_tokens: 5, input_length: 10 },
    });
    expect(result?.chunk.content).toBe('.');
    expect(result?.chunk.done).toBe(true);
    expect(result?.chunk.usage?.inputTokens).toBe(10);
    expect(result?.chunk.usage?.outputTokens).toBe(5);
  });

  it('maps HF TGI eos_token to finishReason stop', () => {
    const result = normalizeHuggingFaceTGIChunk({
      index: 1,
      token: { id: 2, text: '</s>', special: true },
      details: { finish_reason: 'eos_token', generated_tokens: 3, input_length: 5 },
    });
    expect(result?.chunk.finishReason).toBe('stop');
  });

  it('maps HF TGI length to finishReason length', () => {
    const result = normalizeHuggingFaceTGIChunk({
      index: 1,
      token: { id: 1, text: 'x', special: false },
      details: { finish_reason: 'length', generated_tokens: 10, input_length: 5 },
    });
    expect(result?.chunk.finishReason).toBe('length');
  });

  it('maps HF TGI stop_sequence to finishReason stop', () => {
    const result = normalizeHuggingFaceTGIChunk({
      index: 1,
      token: { id: 1, text: '.', special: false },
      details: { finish_reason: 'stop_sequence', generated_tokens: 5, input_length: 3 },
    });
    expect(result?.chunk.finishReason).toBe('stop');
  });

  it('sets done=true for stop_sequence and length finish reasons', () => {
    // biome-ignore lint/correctness/useQwikValidLexicalScope: legitimate usage
    const make = (finish_reason: string) =>
      normalizeHuggingFaceTGIChunk({
        index: 1,
        token: { id: 1, text: 'x', special: false },
        details: { finish_reason, generated_tokens: 1, input_length: 5 },
      });
    expect(make('stop_sequence')?.chunk.done).toBe(true);
    expect(make('length')?.chunk.done).toBe(true);
  });

  it('returns null for missing or non-object token field', () => {
    expect(normalizeHuggingFaceTGIChunk({ index: 0, generated_text: null })).toBeNull();
    expect(normalizeHuggingFaceTGIChunk({ token: 'bad' })).toBeNull();
    expect(normalizeHuggingFaceTGIChunk(null)).toBeNull();
  });

  it('returns null for special-only event with no details', () => {
    expect(normalizeHuggingFaceTGIChunk({ token: { id: 0, text: '<pad>', special: true }, details: null })).toBeNull();
  });

  it('never throws on adversarial input', () => {
    expect(() => normalizeHuggingFaceTGIChunk({ token: null })).not.toThrow();
    expect(() => normalizeHuggingFaceTGIChunk({ token: { text: null } })).not.toThrow();
    expect(() => normalizeHuggingFaceTGIChunk(undefined)).not.toThrow();
  });
});
