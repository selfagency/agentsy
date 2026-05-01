import { describe, expect, it } from 'vitest';
import type { OutputPart } from '../processor/LLMStreamProcessor.js';
import { LLMStreamProcessor } from '../processor/LLMStreamProcessor.js';
import { createSmoothStream, createThinkingFilter, createToolCallFilter } from './transform.js';

async function writeAndCollect(
  transform: TransformStream<OutputPart, OutputPart>,
  input: OutputPart[],
): Promise<OutputPart[]> {
  const write = async () => {
    const writer = transform.writable.getWriter();
    for (const part of input) await writer.write(part);
    await writer.close();
  };

  const read = async () => {
    const parts: OutputPart[] = [];
    const reader = transform.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
    }
    return parts;
  };

  const [, parts] = await Promise.all([write(), read()]);
  return parts;
}

async function collectStream(stream: ReadableStream<OutputPart>): Promise<OutputPart[]> {
  const parts: OutputPart[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  return parts;
}

describe('createSmoothStream', () => {
  it('passes non-text parts through unchanged', async () => {
    const call = { name: 'fn', parameters: {}, format: 'native-json' as const };
    const part: OutputPart = { type: 'tool_call', call, state: 'input-complete' };
    const parts = await writeAndCollect(createSmoothStream({ chunkSize: 4 }), [part]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe(part);
  });

  it('splits large text delta into chunkSize sub-chunks', async () => {
    const parts = await writeAndCollect(createSmoothStream({ chunkSize: 3 }), [{ type: 'text', text: 'abcdef' }]);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ type: 'text', text: 'abc' });
    expect(parts[1]).toEqual({ type: 'text', text: 'def' });
  });

  it('emits single chunk for text shorter than chunkSize', async () => {
    const parts = await writeAndCollect(createSmoothStream({ chunkSize: 10 }), [{ type: 'text', text: 'hi' }]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ type: 'text', text: 'hi' });
  });

  it('defaults to chunkSize 8', async () => {
    const parts = await writeAndCollect(createSmoothStream(), [{ type: 'text', text: 'x'.repeat(16) }]);
    expect(parts).toHaveLength(2);
    expect(parts.every(p => p.type === 'text' && p.text.length === 8)).toBe(true);
  });
});

describe('createThinkingFilter', () => {
  it('strips thinking parts', async () => {
    const parts = await writeAndCollect(createThinkingFilter(), [
      { type: 'thinking', text: 'internal' },
      { type: 'text', text: 'output' },
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ type: 'text', text: 'output' });
  });

  it('passes text and tool_call parts through', async () => {
    const call = { name: 'get_data', parameters: {}, format: 'native-json' as const };
    const parts = await writeAndCollect(createThinkingFilter(), [
      { type: 'text', text: 'hello' },
      { type: 'tool_call', call, state: 'input-complete' },
    ]);
    expect(parts).toHaveLength(2);
  });
});

describe('createToolCallFilter', () => {
  const makeCall = (name: string): OutputPart => ({
    type: 'tool_call',
    call: { name, parameters: {}, format: 'native-json' },
    state: 'input-complete',
  });

  it('passes through only tool calls with matching names', async () => {
    const parts = await writeAndCollect(createToolCallFilter(['search', 'fetch']), [
      makeCall('search'),
      makeCall('delete'),
      makeCall('fetch'),
    ]);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ type: 'tool_call', call: { name: 'search' } });
    expect(parts[1]).toMatchObject({ type: 'tool_call', call: { name: 'fetch' } });
  });

  it('passes non-tool_call parts through unchanged', async () => {
    const parts = await writeAndCollect(createToolCallFilter(['search']), [
      { type: 'text', text: 'hello' },
      makeCall('other'),
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ type: 'text', text: 'hello' });
  });
});

describe('LLMStreamProcessor.partsStream', () => {
  it('emits all parts and closes after flush()', async () => {
    const processor = new LLMStreamProcessor();
    const streamPromise = collectStream(processor.partsStream);
    // Plain text is buffered by the XML filter and only released on flush().
    processor.process({ content: 'hello', done: false });
    processor.process({ content: ' world', done: false });
    processor.flush();
    const parts = await streamPromise;
    const textParts = parts.filter(p => p.type === 'text');
    expect(textParts.length).toBeGreaterThan(0);
    const combined = textParts.map(p => (p.type === 'text' ? p.text : '')).join('');
    expect(combined).toBe('hello world');
  });

  it('applies a single transform when provided via options', async () => {
    const processor = new LLMStreamProcessor({ transforms: [createThinkingFilter()] });
    const streamPromise = collectStream(processor.partsStream);
    // processComplete calls process() + flush() internally, ensuring the stream is closed.
    processor.processComplete({ thinking: 'internal', content: 'visible' });
    const parts = await streamPromise;
    expect(parts.every(p => p.type !== 'thinking')).toBe(true);
    const textParts = parts.filter(p => p.type === 'text');
    expect(textParts.length).toBeGreaterThan(0);
  });

  it('chains multiple transforms in order', async () => {
    const processor = new LLMStreamProcessor({
      transforms: [createThinkingFilter(), createSmoothStream({ chunkSize: 3 })],
    });
    const streamPromise = collectStream(processor.partsStream);
    // processComplete calls process() + flush() internally, ensuring the stream is closed.
    processor.processComplete({ thinking: 'skip', content: 'abcdef' });
    const parts = await streamPromise;
    const textParts = parts.filter((p): p is typeof p & { type: 'text' } => p.type === 'text');
    expect(textParts.length).toBeGreaterThan(1);
    for (const p of textParts) {
      expect(p.text.length).toBeLessThanOrEqual(3);
    }
  });
});
