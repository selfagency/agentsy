/**
 * Integration: processor + thinking/xml-filter + tool-calls
 *
 * Tests the processor's cooperation with the thinking, xml-filter, and
 * tool-calls packages across chunk boundaries.
 */
import { describe, expect, it } from 'vitest';

import { LLMStreamProcessor } from '@agentsy/processor';
import { ThinkingParser } from '@agentsy/thinking';
import { createXmlStreamFilter } from '@agentsy/xml-filter';
import { extractXmlToolCalls } from '@agentsy/tool-calls';

// ---------------------------------------------------------------------------
// Thinking tag parsing through the processor
// ---------------------------------------------------------------------------

describe('LLMStreamProcessor — thinking tag integration', () => {
  it('strips <think> tags and exposes thinking separately (single chunk)', () => {
    const processor = new LLMStreamProcessor({ parseThinkTags: true, scrubContextTags: false });

    const out = processor.process({
      content: '<think>my reasoning here</think>The final answer.',
    });

    expect(out.thinking).toBe('my reasoning here');
    expect(out.content).toBe('The final answer.');
  });

  it('handles <think> tags split across multiple chunks', () => {
    const processor = new LLMStreamProcessor({ parseThinkTags: true });

    processor.process({ content: '<think>part one' });
    processor.process({ content: ' part two</think>answer' });
    processor.flush();

    expect(processor.accumulatedThinking).toBe('part one part two');
    // After flush content may be fully flushed
    expect(processor.accumulatedMessage.content).toBe('answer');
  });

  it('supports custom thinking tags via thinkingOpenTag/CloseTag', () => {
    const processor = new LLMStreamProcessor({
      parseThinkTags: true,
      thinkingOpenTag: '<reasoning>',
      thinkingCloseTag: '</reasoning>',
    });

    const out = processor.processComplete({
      content: '<reasoning>custom reasoning</reasoning>result',
      done: true,
    });

    expect(out.thinking).toBe('custom reasoning');
    expect(out.content).toBe('result');
  });

  it('handles nested standard think-tag content without crashing', () => {
    const processor = new LLMStreamProcessor({ parseThinkTags: true });

    // Content that looks like nested XML should not throw
    const out = processor.processComplete({
      content: '<think><step>a</step><step>b</step></think>done',
      done: true,
    });

    expect(out.thinking).toContain('step');
    expect(out.content).toBe('done');
  });

  it('exposes thinking natively when chunk.thinking is already set (no tag parsing needed)', () => {
    // Anthropic-style: provider delivers thinking in a separate field, not wrapped in tags
    const processor = new LLMStreamProcessor();

    processor.process({ thinking: 'native reasoning' });
    processor.process({ content: 'native answer', done: true });
    processor.flush();

    expect(processor.accumulatedThinking).toBe('native reasoning');
    expect(processor.accumulatedMessage.content).toBe('native answer');
  });
});

// ---------------------------------------------------------------------------
// ThinkingParser standalone (package-level integration)
// ---------------------------------------------------------------------------

describe('ThinkingParser (standalone)', () => {
  it('parses thinking tags and separates text from thinking', () => {
    const parser = new ThinkingParser({ openingTag: '<think>', closingTag: '</think>' });

    let accThinking = '';
    let accContent = '';
    const [td, cd] = parser.addContent('<think>thought</think>text');
    accThinking += td;
    accContent += cd;
    const [ftd, fcd] = parser.flush();
    accThinking += ftd;
    accContent += fcd;

    expect(accThinking).toBe('thought');
    expect(accContent).toBe('text');
  });

  it('handles multi-push boundary splits', () => {
    const parser = new ThinkingParser({ openingTag: '<think>', closingTag: '</think>' });

    let accThinking = '';
    let accContent = '';
    const [td1, cd1] = parser.addContent('<think>half');
    accThinking += td1;
    accContent += cd1;
    const [td2, cd2] = parser.addContent(' thought</think>rest');
    accThinking += td2;
    accContent += cd2;
    const [ftd, fcd] = parser.flush();
    accThinking += ftd;
    accContent += fcd;

    expect(accThinking).toBe('half thought');
    expect(accContent).toBe('rest');
  });
});

// ---------------------------------------------------------------------------
// XML tool call extraction through the processor
// ---------------------------------------------------------------------------

describe('LLMStreamProcessor — XML tool call extraction', () => {
  it('extracts a single complete XML tool call from content', () => {
    const processor = new LLMStreamProcessor({
      knownTools: new Set(['read_file']),
    });

    const out = processor.processComplete({
      content: 'Let me read that. <read_file><path>package.json</path></read_file>',
      done: true,
    });

    expect(out.toolCalls).toHaveLength(1);
    const [tc] = out.toolCalls;
    expect(tc?.name).toBe('read_file');
    expect(tc?.parameters).toEqual({ path: 'package.json' });
  });

  it('extracts multiple XML tool calls from a single response', () => {
    const processor = new LLMStreamProcessor({
      knownTools: new Set(['read_file', 'write_file']),
    });

    const out = processor.processComplete({
      content:
        '<read_file><path>a.ts</path></read_file>' +
        '<write_file><path>b.ts</path><content>hello</content></write_file>',
      done: true,
    });

    expect(out.toolCalls).toHaveLength(2);
    expect(out.toolCalls[0]?.name).toBe('read_file');
    expect(out.toolCalls[1]?.name).toBe('write_file');
    expect(out.toolCalls[1]?.parameters).toEqual({ path: 'b.ts', content: 'hello' });
  });

  it('preserves surrounding text content and strips the tool call markup', () => {
    const processor = new LLMStreamProcessor({
      knownTools: new Set(['search']),
    });

    const out = processor.processComplete({
      content: 'Searching now.<search><query>cats</query></search>Done.',
      done: true,
    });

    // Content should not include the tool call XML
    expect(out.content).toContain('Searching now.');
    expect(out.toolCalls[0]?.name).toBe('search');
    expect(out.toolCalls[0]?.parameters).toEqual({ query: 'cats' });
  });

  it('handles tool call arguments streamed across chunk boundaries', () => {
    const processor = new LLMStreamProcessor({
      knownTools: new Set(['search']),
    });

    processor.process({ content: '<search><query>split ' });
    const result = processor.processComplete({ content: 'query</query></search>' });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.parameters).toEqual({ query: 'split query' });
  });
});

// ---------------------------------------------------------------------------
// ToolCallAccumulator standalone (package-level integration)
// ---------------------------------------------------------------------------

describe('ToolCallAccumulator (standalone)', () => {
  it('builds XmlToolCall objects from XML string', () => {
    const result = extractXmlToolCalls('<find><pattern>*.ts</pattern></find>', new Set(['find']));

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('find');
    expect(result[0]?.parameters).toEqual({ pattern: '*.ts' });
  });
});

// ---------------------------------------------------------------------------
// XmlStreamFilter standalone (package-level integration)
// ---------------------------------------------------------------------------

describe('XmlStreamFilter (standalone)', () => {
  it('strips specified XML tags from streamed text', () => {
    const filter = createXmlStreamFilter({ extraScrubTags: new Set(['context']) });

    const result = filter.write('<context>some context</context>actual text') + filter.end();

    // The filter emits text outside stripped tags
    expect(result).toBe('actual text');
  });

  it('handles tag split across multiple push calls', () => {
    const filter = createXmlStreamFilter({ extraScrubTags: new Set(['scratchpad']) });

    const p1 = filter.write('<scratchpad>hide ');
    const p2 = filter.write('this</scratchpad>show this');

    expect((p1 ?? '') + (p2 ?? '') + filter.end()).toBe('show this');
  });
});

// ---------------------------------------------------------------------------
// Context scrubbing via processor option
// ---------------------------------------------------------------------------

describe('LLMStreamProcessor — context tag scrubbing', () => {
  it('strips <context> blocks from output when scrubContextTags=true', () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: true });

    const out = processor.processComplete({
      content: '<context>hidden</context>visible text',
      done: true,
    });

    expect(out.content).toBe('visible text');
    expect(out.content).not.toContain('hidden');
  });

  it('strips custom tags when extraScrubTags are specified', () => {
    const processor = new LLMStreamProcessor({
      extraScrubTags: new Set(['internal_memo']),
    });

    const out = processor.processComplete({
      content: '<internal_memo>secret</internal_memo>public',
      done: true,
    });

    expect(out.content).toBe('public');
  });
});
