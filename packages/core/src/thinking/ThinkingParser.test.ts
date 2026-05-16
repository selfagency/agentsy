import { describe, expect, it } from 'vitest';

import { ThinkingParser } from './ThinkingParser.js';

describe(ThinkingParser, () => {
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
    const parser = new ThinkingParser({
      closingTag: '</|thinking|>',
      openingTag: '<|thinking|>'
    });
    parser.addContent('<|thinking|>');
    const [thinking, content] = parser.addContent('reason</|thinking|>ok');
    expect(thinking).toBe('reason');
    expect(content).toBe('ok');
  });

  it('selects built-in tags for known models via forModel', () => {
    const parser = ThinkingParser.forModel('granite-3.2');
    const [thinking, content] = parser.addContent('<|thinking|>reason</|thinking|>ok');
    expect(thinking).toBe('reason');
    expect(content).toBe('ok');
  });

  it('supports custom model thinking tag map via forModel', () => {
    const parser = ThinkingParser.forModel('custom-model', new Map([['custom', ['<x>', '</x>']]]));
    const [thinking, content] = parser.addContent('<x>reason</x>ok');
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

  it('handles multiple thinking blocks in a single chunk', () => {
    const parser = new ThinkingParser();
    const [thinking, content] = parser.addContent(
      '<think>first thought</think>middle<think>second thought</think>final'
    );
    expect(thinking).toBe('first thoughtsecond thought');
    expect(content).toBe('middlefinal');
  });

  it('handles multiple thinking blocks across chunks', () => {
    const parser = new ThinkingParser();
    let allThinking = '';
    let allContent = '';

    let [t, c] = parser.addContent('<think>thought1</think>');
    allThinking += t;
    allContent += c;

    [t, c] = parser.addContent('between');
    allThinking += t;
    allContent += c;

    [t, c] = parser.addContent('<think>thought2</think>after');
    allThinking += t;
    allContent += c;

    expect(allThinking).toBe('thought1thought2');
    expect(allContent).toBe('betweenafter');
  });

  it('handles three consecutive thinking blocks', () => {
    const parser = new ThinkingParser();
    const [thinking, content] = parser.addContent('<think>a</think>x<think>b</think>y<think>c</think>z');
    expect(thinking).toBe('abc');
    expect(content).toBe('xyz');
  });

  it('handles nested thinking tags by tracking depth', () => {
    const parser = new ThinkingParser();
    const [thinking, content] = parser.addContent('<think>outer<think>inner</think>more</think>after');
    expect(thinking).toBe('outer<think>inner</think>more');
    expect(content).toBe('after');
  });

  it('handles deeply nested thinking tags', () => {
    const parser = new ThinkingParser();
    const [thinking, content] = parser.addContent('<think>a<think>b<think>c</think>d</think>e</think>f');
    expect(thinking).toBe('a<think>b<think>c</think>d</think>e');
    expect(content).toBe('f');
  });

  it('handles nested tags across chunks', () => {
    const parser = new ThinkingParser();
    let allThinking = '';
    let allContent = '';

    let [t, c] = parser.addContent('<think>outer<think>');
    allThinking += t;
    allContent += c;

    [t, c] = parser.addContent('inner</think>');
    allThinking += t;
    allContent += c;

    [t, c] = parser.addContent('more</think>after');
    allThinking += t;
    allContent += c;

    expect(allThinking).toBe('outer<think>inner</think>more');
    expect(allContent).toBe('after');
  });

  it('handles unclosed think tag at end of stream via flush', () => {
    const parser = new ThinkingParser();
    parser.addContent('<think>incomplete reasoning');
    const [thinking, content] = parser.flush();
    expect(thinking).toBe('incomplete reasoning');
    expect(content).toBe('');
  });

  it('handles empty think blocks', () => {
    const parser = new ThinkingParser();
    const [thinking, content] = parser.addContent('<think></think>visible');
    expect(thinking).toBe('');
    expect(content).toBe('visible');
  });

  it('handles think blocks with only whitespace', () => {
    const parser = new ThinkingParser();
    const [_thinking, content] = parser.addContent('<think>   \n   </think>visible');
    expect(content).toBe('visible');
  });
});
