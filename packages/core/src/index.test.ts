import { describe, expect, it } from 'vitest';

import {
  LLMStreamProcessor,
  ThinkingParser,
  appendToBlockquote,
  buildXmlToolSystemPrompt,
  createXmlStreamFilter,
  extractXmlToolCalls,
  formatXmlLikeResponseForDisplay,
  processStream,
  sanitizeNonStreamingModelOutput,
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
    expect(typeof buildXmlToolSystemPrompt).toBe('function');
    expect(typeof sanitizeNonStreamingModelOutput).toBe('function');
    expect(typeof formatXmlLikeResponseForDisplay).toBe('function');
  });
});
