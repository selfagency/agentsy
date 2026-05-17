import { describe, expect, it, expectTypeOf } from 'vitest';

import { LLMStreamProcessor } from '../processor/processor/LLMStreamProcessor.js';
import { buildContinuationPrompt, captureStreamState } from './index.js';

describe('captureStreamState', () => {
  it('captures empty state at start of stream', () => {
    const processor = new LLMStreamProcessor();
    const snap = captureStreamState(processor);

    expect(snap.content).toBe('');
    expect(snap.thinking).toBe('');
    expect(snap.toolCalls).toStrictEqual([]);
    expectTypeOf(snap.timestamp).toBeNumber();
    expect(snap.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('captures accumulated content after processing chunks', () => {
    const processor = new LLMStreamProcessor({
      parseThinkTags: true,
      scrubContextTags: false
    });
    processor.process({ content: '<think>thoughts</think>Hello, ' });
    processor.process({ content: 'world' });

    const snap = captureStreamState(processor);

    expect(snap.content).toBe('Hello, world');
    expect(snap.thinking).toBe('thoughts');
  });

  it('captures tool calls in snapshot', () => {
    const processor = new LLMStreamProcessor({
      knownTools: new Set(['lookup'])
    });
    processor.process({
      content: '<toolCall>{"name":"lookup","arguments":{"q":"test"}}</toolCall>',
      done: true
    });

    const snap = captureStreamState(processor);

    expect(snap.toolCalls).toHaveLength(1);
    const toolCall = snap.toolCalls[0];
    expect(toolCall).toBeDefined();
    expect(toolCall?.name).toBe('lookup');
  });

  it('captures usage when present', () => {
    const processor = new LLMStreamProcessor();
    processor.process({
      content: 'hi',
      usage: { inputTokens: 10, outputTokens: 20 }
    });

    const snap = captureStreamState(processor);

    expect(snap.usage).toStrictEqual({ inputTokens: 10, outputTokens: 20 });
  });

  it('omits usage field entirely when no usage seen', () => {
    const processor = new LLMStreamProcessor();
    processor.process({ content: 'hi' });

    const snap = captureStreamState(processor);

    expect('usage' in snap).toBeFalsy();
  });

  it('records provided options in snapshot', () => {
    const processor = new LLMStreamProcessor();
    const opts = { parseThinkTags: false };
    const snap = captureStreamState(processor, opts);

    expect(snap.options).toStrictEqual(opts);
  });
});

describe('buildContinuationPrompt', () => {
  it('returns a user continuation message when no content was accumulated', () => {
    const processor = new LLMStreamProcessor();
    const snap = captureStreamState(processor);
    const messages = buildContinuationPrompt(snap);

    expect(messages).toHaveLength(1);
    const msg = messages[0];
    expect(msg).toBeDefined();
    expect(msg?.role).toBe('user');
    expect(msg?.content).toBeTruthy();
  });

  it('openai provider returns [assistant partial, user continue] pair', () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });
    processor.process({ content: 'Once upon a time,' });

    const snap = captureStreamState(processor);
    const messages = buildContinuationPrompt(snap, { provider: 'openai' });

    expect(messages).toHaveLength(2);
    const msg0 = messages[0];
    const msg1 = messages[1];
    expect(msg0).toBeDefined();
    expect(msg1).toBeDefined();
    expect(msg0?.role).toBe('assistant');
    expect(msg0?.content).toBe('Once upon a time,');
    expect(msg1?.role).toBe('user');
  });

  it('anthropic provider returns [assistant partial] only (prefill)', () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });
    processor.process({ content: 'The answer is' });

    const snap = captureStreamState(processor);
    const messages = buildContinuationPrompt(snap, { provider: 'anthropic' });

    expect(messages).toHaveLength(1);
    const msg = messages[0];
    expect(msg).toBeDefined();
    expect(msg?.role).toBe('assistant');
    expect(msg?.content).toBe('The answer is');
  });

  it('ollama provider behaves the same as openai', () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });
    processor.process({ content: 'Continuing...' });

    const snap = captureStreamState(processor);
    const openaiMsgs = buildContinuationPrompt(snap, { provider: 'openai' });
    const ollamaMsgs = buildContinuationPrompt(snap, { provider: 'ollama' });

    expect(ollamaMsgs).toStrictEqual(openaiMsgs);
  });

  it('defaults to openai format when no provider specified', () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });
    processor.process({ content: 'partial output' });

    const snap = captureStreamState(processor);
    const defaultMsgs = buildContinuationPrompt(snap);
    const openaiMsgs = buildContinuationPrompt(snap, { provider: 'openai' });

    expect(defaultMsgs).toStrictEqual(openaiMsgs);
  });

  it('trims whitespace from partial content before including in message', () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });
    processor.process({ content: '  lots of whitespace   ' });

    const snap = captureStreamState(processor);
    const messages = buildContinuationPrompt(snap, { provider: 'anthropic' });

    expect(messages[0]?.content).toBe('lots of whitespace');
  });

  it('includes completed tool calls in continuation context for openai-style prompts', () => {
    const snap = {
      content: 'Working on it',
      options: {},
      thinking: '',
      timestamp: Date.now(),
      toolCalls: [
        {
          format: 'bare-xml' as const,
          name: 'search',
          parameters: { query: 'docs' }
        }
      ]
    };

    const messages = buildContinuationPrompt(snap, { provider: 'openai' });

    expect(messages).toHaveLength(2);
    expect(messages[1]?.role).toBe('user');
    expect(messages[1]?.content).toContain('search({"query":"docs"})');
    expect(messages[1]?.content).toContain('without repeating the completed tool calls');
  });

  it('includes completed tool calls before anthropic prefills when available', () => {
    const snap = {
      content: 'The answer is',
      options: {},
      thinking: '',
      timestamp: Date.now(),
      toolCalls: [
        {
          format: 'native-json' as const,
          name: 'lookup',
          parameters: { id: '123' }
        }
      ]
    };

    const messages = buildContinuationPrompt(snap, { provider: 'anthropic' });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('user');
    expect(messages[0]?.content).toContain('lookup({"id":"123"})');
    expect(messages[1]?.role).toBe('assistant');
    expect(messages[1]?.content).toBe('The answer is');
  });
});
