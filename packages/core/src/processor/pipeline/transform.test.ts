import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OutputPart } from '../processor/llm-stream-processor.js';
import { LLMStreamProcessor } from '../processor/llm-stream-processor.js';
import { createSmoothStream, createThinkingFilter, createToolCallFilter } from './transform.js';

async function writeAndCollect(
  transform: TransformStream<OutputPart, OutputPart>,
  input: OutputPart[]
): Promise<OutputPart[]> {
  async function write(): Promise<void> {
    const writer = transform.writable.getWriter();
    for (const part of input) {
      await writer.write(part);
    }
    await writer.close();
  }

  async function read(): Promise<OutputPart[]> {
    const parts: OutputPart[] = [];
    const reader = transform.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      parts.push(value);
    }
    return parts;
  }

  const [, parts] = await Promise.all([write(), read()]);
  return parts;
}

async function collectStream(stream: ReadableStream<OutputPart>): Promise<OutputPart[]> {
  const parts: OutputPart[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    parts.push(value);
  }
  return parts;
}

describe('createSmoothStream', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes non-text parts through unchanged', async () => {
    const call = { format: 'native-json' as const, name: 'fn', parameters: {} };
    const part: OutputPart = {
      call,
      state: 'input-complete',
      type: 'tool_call'
    };
    const parts = await writeAndCollect(createSmoothStream({ chunkSize: 4 }), [part]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe(part);
  });

  it('splits large text delta into chunkSize sub-chunks', async () => {
    const parts = await writeAndCollect(createSmoothStream({ chunkSize: 3 }), [{ text: 'abcdef', type: 'text' }]);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toStrictEqual({ text: 'abc', type: 'text' });
    expect(parts[1]).toStrictEqual({ text: 'def', type: 'text' });
  });

  it('emits single chunk for text shorter than chunkSize', async () => {
    const parts = await writeAndCollect(createSmoothStream({ chunkSize: 10 }), [{ text: 'hi', type: 'text' }]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toStrictEqual({ text: 'hi', type: 'text' });
  });

  it('defaults to chunkSize 8', async () => {
    const parts = await writeAndCollect(createSmoothStream(), [{ text: 'x'.repeat(16), type: 'text' }]);
    expect(parts).toHaveLength(2);
    expect(parts.every(p => p.type === 'text' && p.text.length === 8)).toBeTruthy();
  });

  it('waits between emitted sub-chunks when delayMs is provided', async () => {
    vi.useFakeTimers();

    const transform = createSmoothStream({ chunkSize: 2, delayMs: 50 });
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();

    const writePromise = writer.write({ text: 'abcd', type: 'text' }).then(async () => {
      await writer.close();
    });

    const firstRead = await reader.read();
    expect(firstRead.value).toStrictEqual({ text: 'ab', type: 'text' });

    let secondResolved = false;
    const secondReadPromise = reader.read().then(result => {
      secondResolved = true;
      return result;
    });

    await Promise.resolve();
    expect(secondResolved).toBeFalsy();

    await vi.advanceTimersByTimeAsync(50);
    const secondRead = await secondReadPromise;
    expect(secondRead.value).toStrictEqual({ text: 'cd', type: 'text' });

    await writePromise;
  });
});

describe('createThinkingFilter', () => {
  it('strips thinking parts', async () => {
    const parts = await writeAndCollect(createThinkingFilter(), [
      { text: 'internal', type: 'thinking' },
      { text: 'output', type: 'text' }
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toStrictEqual({ text: 'output', type: 'text' });
  });

  it('passes text and tool_call parts through', async () => {
    const call = {
      format: 'native-json' as const,
      name: 'get_data',
      parameters: {}
    };
    const parts = await writeAndCollect(createThinkingFilter(), [
      { text: 'hello', type: 'text' },
      { call, state: 'input-complete', type: 'tool_call' }
    ]);
    expect(parts).toHaveLength(2);
  });
});

function makeCall(name: string): OutputPart {
  return {
    call: { format: 'native-json', name, parameters: {} },
    state: 'input-complete',
    type: 'tool_call'
  };
}

describe('createToolCallFilter', () => {
  it('passes through only tool calls with matching names', async () => {
    const parts = await writeAndCollect(createToolCallFilter(['search', 'fetch']), [
      makeCall('search'),
      makeCall('delete'),
      makeCall('fetch')
    ]);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({
      call: { name: 'search' },
      type: 'tool_call'
    });
    expect(parts[1]).toMatchObject({
      call: { name: 'fetch' },
      type: 'tool_call'
    });
  });

  it('passes non-tool_call parts through unchanged', async () => {
    const parts = await writeAndCollect(createToolCallFilter(['search']), [
      { text: 'hello', type: 'text' },
      makeCall('other')
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toStrictEqual({ text: 'hello', type: 'text' });
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
    const processor = new LLMStreamProcessor({
      transforms: [createThinkingFilter()]
    });
    const streamPromise = collectStream(processor.partsStream);
    // processComplete calls process() + flush() internally, ensuring the stream is closed.
    processor.processComplete({ content: 'visible', thinking: 'internal' });
    const parts = await streamPromise;
    expect(parts.every(p => p.type !== 'thinking')).toBeTruthy();
    const textParts = parts.filter(p => p.type === 'text');
    expect(textParts.length).toBeGreaterThan(0);
  });

  it('chains multiple transforms in order', async () => {
    const processor = new LLMStreamProcessor({
      transforms: [createThinkingFilter(), createSmoothStream({ chunkSize: 3 })]
    });
    const streamPromise = collectStream(processor.partsStream);
    // processComplete calls process() + flush() internally, ensuring the stream is closed.
    processor.processComplete({ content: 'abcdef', thinking: 'skip' });
    const parts = await streamPromise;
    const textParts = parts.filter((p): p is typeof p & { type: 'text' } => p.type === 'text');
    expect(textParts.length).toBeGreaterThan(1);
    for (const p of textParts) {
      expect(p.text.length).toBeLessThanOrEqual(3);
    }
  });
});
