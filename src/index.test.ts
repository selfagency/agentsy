import { describe, expect, it } from 'vitest';

import {
  LLMStreamProcessor,
  ThinkingParser,
  appendToBlockquote,
  createVSCodeCopilotAdapter,
  createXmlStreamFilter,
  extractXmlToolCalls,
  processStream,
} from './index.js';

describe('scaffold exports', () => {
  it('provides core scaffolding exports', () => {
    const parser = new ThinkingParser();
    const filter = createXmlStreamFilter();
    const calls = extractXmlToolCalls('', new Set<string>());

    expect(parser).toBeDefined();
    expect(filter.write('abc')).toBe('');
    expect(filter.end()).toBe('abc');
    expect(calls).toEqual([]);
  });

  it('provides new processor, markdown, and adapter exports', () => {
    const processor = new LLMStreamProcessor();
    expect(processor).toBeDefined();
    expect(typeof processor.process).toBe('function');

    expect(typeof appendToBlockquote).toBe('function');
    expect(appendToBlockquote('hello', true)).toBe('> hello');

    expect(typeof processStream).toBe('function');

    const mockStream = { markdown: (_text: string) => {} };
    const mockOnToolCall = () => {};
    const adapter = createVSCodeCopilotAdapter({
      processor,
      stream: mockStream,
      onToolCall: mockOnToolCall,
    });
    expect(adapter).toBeDefined();
    expect(typeof adapter.write).toBe('function');
    expect(typeof adapter.end).toBe('function');
  });
});
