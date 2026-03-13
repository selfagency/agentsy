import { describe, expect, it, vi } from 'vitest';

import { LLMStreamProcessor } from './LLMStreamProcessor.js';

describe('LLMStreamProcessor', () => {
  it('processes thinking tags, scrubs content, and extracts xml-wrapped tool calls', () => {
    const processor = new LLMStreamProcessor({
      knownTools: new Set(['search_files']),
    });

    const out = processor.process({
      content: '<think>reasoning</think>Hello <toolCall>{"name":"search_files","arguments":{"query":"abc"}}</toolCall>',
      done: false,
    });

    expect(out.thinking).toBe('reasoning');
    expect(out.content).toBe('Hello ');
    expect(out.toolCalls).toEqual([
      {
        name: 'search_files',
        parameters: { query: 'abc' },
        format: 'json-wrapped',
      },
    ]);
    expect(out.parts.map(part => part.type)).toEqual(['thinking', 'text', 'tool_call']);

    expect(processor.accumulatedThinking).toBe('reasoning');
    expect(processor.accumulatedMessage.content).toBe('Hello ');
    expect(processor.accumulatedMessage.toolCalls).toHaveLength(1);
  });

  it('emits events and warning callbacks', () => {
    const onWarning = vi.fn();
    const onText = vi.fn();
    const onThinking = vi.fn();
    const onDone = vi.fn();

    const processor = new LLMStreamProcessor({
      maxInputLength: 20,
      onWarning,
    });

    processor.on('text', onText).on('thinking', onThinking).on('done', onDone);

    processor.process({ content: '<think>x</think>ok' });
    processor.process({ content: '1234567890123456789012345' });
    processor.flush();

    expect(onWarning).toHaveBeenCalled();
    expect(onThinking).toHaveBeenCalledWith('x');
    expect(onText).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('maps native tool_calls into XmlToolCall shape', () => {
    const processor = new LLMStreamProcessor();
    const out = processor.process({
      tool_calls: [
        {
          function: {
            name: 'read_file',
            arguments: { path: '/tmp/a.ts' },
          },
        },
      ],
    });

    expect(out.toolCalls).toEqual([
      {
        name: 'read_file',
        parameters: { path: '/tmp/a.ts' },
        format: 'json-wrapped',
      },
    ]);
  });

  it('truncates tool calls when maxToolCallsPerMessage is exceeded', () => {
    const onWarning = vi.fn();
    const processor = new LLMStreamProcessor({ maxToolCallsPerMessage: 1, onWarning });

    const out = processor.process({
      tool_calls: [{ function: { name: 'a', arguments: {} } }, { function: { name: 'b', arguments: {} } }],
    });

    expect(out.toolCalls).toHaveLength(1);
    expect(out.toolCalls[0]?.name).toBe('a');
    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('maxToolCallsPerMessage'),
      expect.objectContaining({ originalCount: 2, maxToolCallsPerMessage: 1 }),
    );
  });

  it('drops tool calls whose argument payload exceeds maxToolArgumentBytes', () => {
    const onWarning = vi.fn();
    const processor = new LLMStreamProcessor({ maxToolArgumentBytes: 8, onWarning });

    const out = processor.process({
      tool_calls: [
        {
          function: {
            name: 'read_file',
            arguments: { path: '/a/very/long/path.ts' },
          },
        },
      ],
    });

    expect(out.toolCalls).toEqual([]);
    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('maxToolArgumentBytes'),
      expect.objectContaining({ toolName: 'read_file', maxToolArgumentBytes: 8 }),
    );
  });

  it('drops tool calls whose arguments contain a circular reference', () => {
    const onWarning = vi.fn();
    const processor = new LLMStreamProcessor({ onWarning });

    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    const out = processor.process({
      tool_calls: [{ function: { name: 'circular_tool', arguments: circular } }],
    });

    expect(out.toolCalls).toEqual([]);
    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('could not be serialized'),
      expect.objectContaining({ toolName: 'circular_tool' }),
    );
  });

  it('drops tool calls whose arguments contain a BigInt value', () => {
    const onWarning = vi.fn();
    const processor = new LLMStreamProcessor({ onWarning });

    const out = processor.process({
      tool_calls: [{ function: { name: 'bigint_tool', arguments: { value: BigInt(42) } } }],
    });

    expect(out.toolCalls).toEqual([]);
    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('could not be serialized'),
      expect.objectContaining({ toolName: 'bigint_tool' }),
    );
  });

  it('uses modelId with thinkingTagMap to parse custom thinking tags', () => {
    const processor = new LLMStreamProcessor({
      modelId: 'my-custom-model-v1',
      thinkingTagMap: new Map([['my-custom-model', ['<x>', '</x>']]]),
    });

    const out = processor.process({ content: '<x>reason</x>ok' });
    const flushed = processor.flush();
    expect(out.thinking).toBe('reason');
    expect(out.content + flushed.content).toBe('ok');
  });

  it('rate limits warning emissions with maxWarnings', () => {
    const onWarning = vi.fn();
    const processor = new LLMStreamProcessor({
      onWarning,
      maxWarnings: 3,
      maxInputLength: 10,
    });

    // Trigger 5 warnings by sending oversized content
    for (let i = 0; i < 5; i++) {
      processor.process({ content: 'x'.repeat(20) });
    }

    expect(onWarning).toHaveBeenCalledTimes(3);
  });

  it('resets warning count on reset()', () => {
    const onWarning = vi.fn();
    const processor = new LLMStreamProcessor({
      onWarning,
      maxWarnings: 2,
      maxInputLength: 10,
    });

    processor.process({ content: 'x'.repeat(20) });
    processor.process({ content: 'x'.repeat(20) });
    processor.process({ content: 'x'.repeat(20) }); // should be suppressed
    expect(onWarning).toHaveBeenCalledTimes(2);

    processor.reset();
    processor.process({ content: 'x'.repeat(20) });
    expect(onWarning).toHaveBeenCalledTimes(3); // warning count was reset
  });

  it('can be reused after flush() + reset() cycle', () => {
    const processor = new LLMStreamProcessor();

    processor.process({ content: '<think>thought1</think>content1' });
    processor.flush();

    processor.reset();

    const out = processor.process({ content: '<think>thought2</think>content2' });
    const flushed = processor.flush();
    expect(out.thinking).toBe('thought2');
    expect(out.content + flushed.content).toBe('content2');
  });

  it('returns done on second flush() without process()', () => {
    const processor = new LLMStreamProcessor();
    processor.process({ content: '<think>t</think>content' });
    const first = processor.flush();
    const second = processor.flush();

    expect(first.done).toBe(true);
    expect(second.done).toBe(true);
    expect(second.thinking).toBe('');
    expect(second.toolCalls).toEqual([]);
  });

  it('emits events in correct order across process+flush', () => {
    const events: string[] = [];
    const processor = new LLMStreamProcessor({
      parseThinkTags: true,
      scrubContextTags: false,
    });

    processor.on('thinking', () => events.push('thinking'));
    processor.on('text', () => events.push('text'));
    processor.on('done', () => events.push('done'));

    processor.process({ content: '<think>plan</think>output' });
    processor.flush();

    expect(events).toEqual(['thinking', 'text', 'done']);
  });

  // -------------------------------------------------------------------
  // Usage / token tracking (Phase 3)
  // -------------------------------------------------------------------

  it('stores usage from a chunk carrying usage data', () => {
    const processor = new LLMStreamProcessor();
    processor.process({ content: 'hello', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } });

    expect(processor.accumulatedMessage.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });
  });

  it('includes usage in ProcessedOutput when chunk has usage', () => {
    const processor = new LLMStreamProcessor();
    const out = processor.process({ content: 'hi', usage: { inputTokens: 5, outputTokens: 8 } });

    expect(out.usage).toEqual({ inputTokens: 5, outputTokens: 8 });
  });

  it('merges usage from multiple chunks (last-write-wins per field)', () => {
    const processor = new LLMStreamProcessor();
    processor.process({ content: 'a', usage: { inputTokens: 10 } });
    processor.process({ content: 'b', usage: { outputTokens: 20, totalTokens: 30 } });

    expect(processor.accumulatedMessage.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });
  });

  it('emits usage event when chunk carries usage', () => {
    const onUsage = vi.fn();
    const processor = new LLMStreamProcessor();
    processor.on('usage', onUsage);

    processor.process({ content: 'x', usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } });

    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
  });

  it('does not emit usage event when chunk has no usage', () => {
    const onUsage = vi.fn();
    const processor = new LLMStreamProcessor();
    processor.on('usage', onUsage);

    processor.process({ content: 'no usage here' });

    expect(onUsage).not.toHaveBeenCalled();
  });

  it('usage is undefined in accumulatedMessage when no chunks carried usage', () => {
    const processor = new LLMStreamProcessor();
    processor.process({ content: 'hello' });

    expect(processor.accumulatedMessage.usage).toBeUndefined();
  });

  it('flush() output includes accumulated usage', () => {
    const processor = new LLMStreamProcessor();
    processor.process({ content: '<think>t</think>', usage: { inputTokens: 7 } });
    const flushed = processor.flush();

    expect(flushed.usage).toEqual({ inputTokens: 7 });
  });

  it('processComplete() output includes accumulated usage', () => {
    const processor = new LLMStreamProcessor();
    const out = processor.processComplete({ content: 'done', done: true, usage: { inputTokens: 4, outputTokens: 8, totalTokens: 12 } });

    expect(out.usage).toEqual({ inputTokens: 4, outputTokens: 8, totalTokens: 12 });
  });

  it('reset() clears accumulated usage', () => {
    const processor = new LLMStreamProcessor();
    processor.process({ usage: { inputTokens: 99 } });
    expect(processor.accumulatedMessage.usage).toBeDefined();

    processor.reset();
    expect(processor.accumulatedMessage.usage).toBeUndefined();
  });

  // -------------------------------------------------------------------
  // Concurrent events — content + done in a single chunk
  // -------------------------------------------------------------------

  it('processes content and done flag in the same chunk', () => {
    const onText = vi.fn();
    const onDone = vi.fn();
    const processor = new LLMStreamProcessor({ scrubContextTags: false });

    processor.on('text', onText).on('done', onDone);

    const out = processor.process({ content: 'final text', done: true });

    expect(out.content).toBe('final text');
    expect(out.done).toBe(true);
    expect(onText).toHaveBeenCalledWith('final text');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('includes thinking and signals done in the same chunk', () => {
    const events: string[] = [];
    // Disable context tag scrubbing so xmlFilter does not buffer 'answer' text
    const processor = new LLMStreamProcessor({ scrubContextTags: false });

    processor.on('thinking', () => events.push('thinking'));
    processor.on('text', () => events.push('text'));
    processor.on('done', () => events.push('done'));

    const out = processor.process({ content: '<think>plan</think>answer', done: true });

    expect(out.thinking).toBe('plan');
    expect(out.content).toBe('answer');
    expect(out.done).toBe(true);
    expect(events).toEqual(['thinking', 'text', 'done']);
  });

  it('emits tool_call and done events when final chunk carries tool calls and done: true', () => {
    const onToolCall = vi.fn();
    const onDone = vi.fn();
    const processor = new LLMStreamProcessor();

    processor.on('tool_call', onToolCall).on('done', onDone);

    const out = processor.process({
      tool_calls: [{ function: { name: 'fetch', arguments: { url: 'https://example.com' } } }],
      done: true,
    });

    expect(out.toolCalls).toHaveLength(1);
    expect(out.done).toBe(true);
    expect(onToolCall).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledOnce();
  });
});
