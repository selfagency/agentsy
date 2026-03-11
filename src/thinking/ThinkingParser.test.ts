import { describe, expect, it } from 'vitest';

import { ThinkingParser } from './ThinkingParser.js';

describe('ThinkingParser', () => {
  it('returns content unchanged when no think tags present', () => {
    const parser = new ThinkingParser();
    const [thinking, content] = parser.addContent('Hello world');
    expect(thinking).toBe('');
    expect(content).toBe('Hello world');
  });

  it('extracts thinking from <think>...</think>', () => {
    const parser = new ThinkingParser();
    parser.addContent('<think>');
    parser.addContent('I am thinking');
    const [thinking, content] = parser.addContent('</think>Answer');
    expect(thinking).toBe('I am thinking');
    expect(content).toBe('Answer');
  });

  it('buffers partial opening tag across chunks', () => {
    const parser = new ThinkingParser();
    const [thinking1, content1] = parser.addContent('<thi');
    expect(thinking1).toBe('');
    expect(content1).toBe('');

    const [thinking2, content2] = parser.addContent('nk>reasoning</think>done');
    expect(thinking2).toBe('reasoning');
    expect(content2).toBe('done');
  });

  it('buffers partial closing tag across chunks', () => {
    const parser = new ThinkingParser();
    parser.addContent('<think>thinking</');
    const [thinking, content] = parser.addContent('think>response');
    expect(thinking).toBe('thinking');
    expect(content).toBe('response');
  });

  it('strips leading whitespace after opening tag', () => {
    const parser = new ThinkingParser();
    parser.addContent('<think>   \n');
    const [thinking] = parser.addContent('actual thought</think>');
    expect(thinking).toBe('actual thought');
  });

  it('strips leading whitespace after closing tag when present in same chunk', () => {
    const parser = new ThinkingParser();
    parser.addContent('<think>thought</think>   \n');
    const [, content] = parser.addContent('response');
    expect(content).toBe('response');
  });

  it('preserves leading whitespace in next chunk when closing tag chunk had no trailing chars', () => {
    const parser = new ThinkingParser();
    parser.addContent('<think>thought</think>');
    const [, content] = parser.addContent(' response');
    expect(content).toBe(' response');
  });

  it('supports custom tags', () => {
    const parser = new ThinkingParser({ openingTag: '<|thinking|>', closingTag: '</|thinking|>' });
    parser.addContent('<|thinking|>');
    const [thinking, content] = parser.addContent('reason</|thinking|>ok');
    expect(thinking).toBe('reason');
    expect(content).toBe('ok');
  });

  it('reset clears parser state', () => {
    const parser = new ThinkingParser();
    parser.addContent('<think>abc');
    parser.reset();
    const [thinking, content] = parser.addContent('plain');
    expect(thinking).toBe('');
    expect(content).toBe('plain');
  });
});
