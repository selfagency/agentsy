import { describe, expect, it, vi } from 'vitest';

import { LLMStreamProcessor } from './LLMStreamProcessor.js';

describe('LLMStreamProcessor', () => {
  it('processes thinking tags, scrubs content, and extracts xml-wrapped tool calls', () => {
    const processor = new LLMStreamProcessor({
      knownTools: new Set(['search_files']),
    });

    const out = processor.process({
      content:
        '<think>reasoning</think>Hello <toolCall>{"name":"search_files","arguments":{"query":"abc"}}</toolCall>',
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
});
