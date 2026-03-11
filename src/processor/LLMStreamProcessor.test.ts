import { describe, expect, it, vi } from 'vitest';

import { LLMStreamProcessor } from './LLMStreamProcessor.js';

describe('LLMStreamProcessor', () => {
  it('passes through plain content when think parsing and scrub are disabled', () => {
    const processor = new LLMStreamProcessor({ parseThinkTags: false, scrubContextTags: false });
    const out = processor.process({ content: 'hello' });

    expect(out.content).toBe('hello');
    expect(out.thinking).toBe('');
    expect(out.toolCalls).toEqual([]);
    expect(out.parts).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('extracts thinking from content when think parsing is enabled', () => {
    const processor = new LLMStreamProcessor({ parseThinkTags: true, scrubContextTags: false });
    processor.process({ content: '<think>reason' });
    const out = processor.process({ content: '</think>answer' });

    expect(out.thinking).toBe('reason');
    expect(out.content).toBe('answer');
    expect(processor.accumulatedMessage.thinking).toBe('reason');
    expect(processor.accumulatedMessage.content).toBe('answer');
  });

  it('scrubs context tags from output when enabled', () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: true, parseThinkTags: false });
    const out = processor.process({ content: '<user_info>secret</user_info>visible' });
    const flushed = processor.flush();

    expect(out.content + flushed.content).toBe('visible');
  });

  it('extracts xml tool calls when knownTools is configured', () => {
    const processor = new LLMStreamProcessor({
      parseThinkTags: false,
      scrubContextTags: false,
      knownTools: new Set(['search_files']),
    });
    const out = processor.process({ content: '<search_files><query>x</query></search_files>' });

    expect(out.toolCalls).toHaveLength(1);
    expect(out.toolCalls[0]).toEqual({
      name: 'search_files',
      parameters: { query: 'x' },
      format: 'bare-xml',
    });
  });

  it('maps native tool_calls into output toolCalls', () => {
    const processor = new LLMStreamProcessor({ parseThinkTags: false, scrubContextTags: false });
    const out = processor.process({
      tool_calls: [
        {
          function: {
            name: 'read_file',
            arguments: { path: 'a.ts' },
          },
        },
      ],
    });

    expect(out.toolCalls).toEqual([
      {
        name: 'read_file',
        parameters: { path: 'a.ts' },
        format: 'json-wrapped',
      },
    ]);
  });

  it('emits events for text/thinking/tool_call/done', () => {
    const processor = new LLMStreamProcessor({ knownTools: new Set(['search_files']) });
    const onText = vi.fn();
    const onThinking = vi.fn();
    const onTool = vi.fn();
    const onDone = vi.fn();

    processor.on('text', onText).on('thinking', onThinking).on('tool_call', onTool).on('done', onDone);

    processor.process({ content: '<think>a</think><search_files><query>x</query></search_files>', done: true });

    expect(onThinking).toHaveBeenCalled();
    expect(onText).toHaveBeenCalled();
    expect(onTool).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('processComplete combines process + flush output and marks done', () => {
    const processor = new LLMStreamProcessor({ parseThinkTags: false, scrubContextTags: true });
    const out = processor.processComplete({ content: 'abc' });

    expect(out.done).toBe(true);
    expect(out.content).toBe('abc');
  });

  it('off() unsubscribes listeners', () => {
    const processor = new LLMStreamProcessor();
    const onText = vi.fn();
    processor.on('text', onText);
    processor.off('text', onText);

    processor.process({ content: 'hello' });
    processor.flush();

    expect(onText).not.toHaveBeenCalled();
  });

  it('reset() clears accumulated state and think parser state', () => {
    const processor = new LLMStreamProcessor({ parseThinkTags: true, scrubContextTags: false });

    processor.process({ content: '<think>reason</think>answer' });
    expect(processor.accumulatedThinking).toBe('reason');
    expect(processor.accumulatedMessage.content).toBe('answer');

    processor.reset();
    expect(processor.accumulatedThinking).toBe('');
    expect(processor.accumulatedMessage).toEqual({ thinking: '', content: '', toolCalls: [] });

    const out = processor.process({ content: 'plain' });
    expect(out.thinking).toBe('');
    expect(out.content).toBe('plain');
  });

  it('processComplete emits done event even without done flag in input chunk', () => {
    const processor = new LLMStreamProcessor({ parseThinkTags: false, scrubContextTags: false });
    const onDone = vi.fn();
    processor.on('done', onDone);

    const out = processor.processComplete({ content: 'abc' });
    expect(out.done).toBe(true);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
