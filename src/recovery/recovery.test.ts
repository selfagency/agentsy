import { describe, expect, it } from 'vitest';

import { LLMStreamProcessor } from '../processor/LLMStreamProcessor.js';
import { buildContinuationPrompt, captureStreamState } from './index.js';

describe('captureStreamState', () => {
  it('captures empty state at start of stream', () => {
    const processor = new LLMStreamProcessor();
    const snap = captureStreamState(processor);

    expect(snap.content).toBe('');
    expect(snap.thinking).toBe('');
    expect(snap.toolCalls).toEqual([]);
    expect(typeof snap.timestamp).toBe('number');
    expect(snap.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('captures accumulated content after processing chunks', () => {
    const processor = new LLMStreamProcessor({ parseThinkTags: true, scrubContextTags: false });
    processor.process({ content: '<think>thoughts</think>Hello, ' });
    processor.process({ content: 'world' });

    const snap = captureStreamState(processor);

    expect(snap.content).toBe('Hello, world');
    expect(snap.thinking).toBe('thoughts');
  });

  it('captures tool calls in snapshot', () => {
    const processor = new LLMStreamProcessor({
      knownTools: new Set(['lookup']),
    });
    processor.process({
      content: '<toolCall>{"name":"lookup","arguments":{"q":"test"}}</toolCall>',
      done: true,
    });

    const snap = captureStreamState(processor);

    expect(snap.toolCalls).toHaveLength(1);
    expect(snap.toolCalls[0]!.name).toBe('lookup');
  });

  it('captures usage when present', () => {
    const processor = new LLMStreamProcessor();
    processor.process({ content: 'hi', usage: { inputTokens: 10, outputTokens: 20 } });

    const snap = captureStreamState(processor);

    expect(snap.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
  });

  it('omits usage field entirely when no usage seen', () => {
    const processor = new LLMStreamProcessor();
    processor.process({ content: 'hi' });

    const snap = captureStreamState(processor);

    expect('usage' in snap).toBe(false);
  });

  it('records provided options in snapshot', () => {
    const processor = new LLMStreamProcessor();
    const opts = { parseThinkTags: false };
    const snap = captureStreamState(processor, opts);

    expect(snap.options).toEqual(opts);
  });
});

describe('buildContinuationPrompt', () => {
  it('returns a user continuation message when no content was accumulated', () => {
    const processor = new LLMStreamProcessor();
    const snap = captureStreamState(processor);
    const messages = buildContinuationPrompt(snap);

    expect(messages).toHaveLength(1);
    expect(messages[0]!.role).toBe('user');
    expect(messages[0]!.content).toBeTruthy();
  });

  it('openai provider returns [assistant partial, user continue] pair', () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });
    processor.process({ content: 'Once upon a time,' });

    const snap = captureStreamState(processor);
    const messages = buildContinuationPrompt(snap, { provider: 'openai' });

    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe('assistant');
    expect(messages[0]!.content).toBe('Once upon a time,');
    expect(messages[1]!.role).toBe('user');
  });

  it('anthropic provider returns [assistant partial] only (prefill)', () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });
    processor.process({ content: 'The answer is' });

    const snap = captureStreamState(processor);
    const messages = buildContinuationPrompt(snap, { provider: 'anthropic' });

    expect(messages).toHaveLength(1);
    expect(messages[0]!.role).toBe('assistant');
    expect(messages[0]!.content).toBe('The answer is');
  });

  it('ollama provider behaves the same as openai', () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });
    processor.process({ content: 'Continuing...' });

    const snap = captureStreamState(processor);
    const openaiMsgs = buildContinuationPrompt(snap, { provider: 'openai' });
    const ollamaMsgs = buildContinuationPrompt(snap, { provider: 'ollama' });

    expect(ollamaMsgs).toEqual(openaiMsgs);
  });

  it('defaults to openai format when no provider specified', () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });
    processor.process({ content: 'partial output' });

    const snap = captureStreamState(processor);
    const defaultMsgs = buildContinuationPrompt(snap);
    const openaiMsgs = buildContinuationPrompt(snap, { provider: 'openai' });

    expect(defaultMsgs).toEqual(openaiMsgs);
  });

  it('trims whitespace from partial content before including in message', () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });
    processor.process({ content: '  lots of whitespace   ' });

    const snap = captureStreamState(processor);
    const messages = buildContinuationPrompt(snap, { provider: 'anthropic' });

    expect(messages[0]!.content).toBe('lots of whitespace');
  });
});
