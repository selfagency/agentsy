import { describe, it, expect, vi } from 'vitest';
import { SSEParser, parseSSEStream } from './index.js';

describe('SSEParser', () => {
  it('parses a simple single-line event', () => {
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
    });

    parser.write('data: hello\n\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ data: 'hello' });
  });

  it('parses multi-line data (multiple data: fields)', () => {
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
    });

    parser.write('data: line1\n');
    parser.write('data: line2\n\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ data: 'line1\nline2' });
  });

  it('handles cross-chunk event splits', () => {
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
    });

    parser.write('data: hel');
    parser.write('lo\n\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ data: 'hello' });
  });

  it('handles cross-chunk field delimiter splits', () => {
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
    });

    parser.write('dat');
    parser.write('a: value\n\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ data: 'value' });
  });

  it('parses event name, id, and retry fields', () => {
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
    });

    parser.write('event: custom\n');
    parser.write('data: content\n');
    parser.write('id: 123\n');
    parser.write('retry: 5000\n\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      event: 'custom',
      data: 'content',
      id: '123',
      retry: 5000,
    });
  });

  it('skips comment lines (starting with :)', () => {
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
    });

    parser.write(': this is a comment\n');
    parser.write('data: hello\n\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ data: 'hello' });
  });

  it('strips leading space after colon', () => {
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
    });

    parser.write('data: value\n\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ data: 'value' });
  });

  it('handles empty data field', () => {
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
    });

    parser.write('data:\n\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ data: '' });
  });

  it('parses multiple events in one write', () => {
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
    });

    parser.write('data: event1\n\ndata: event2\n\n');
    parser.end();

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ data: 'event1' });
    expect(events[1]).toEqual({ data: 'event2' });
  });

  it('handles retry field parsing', () => {
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
    });

    parser.write('retry: 10000\n\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ retry: 10000 });
  });

  it('ignores invalid retry values', () => {
    const errors: any[] = [];
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
      onError: error => errors.push(error),
    });

    parser.write('retry: not-a-number\n\n');
    parser.end();

    // Invalid retry values should not create an event.
    expect(events).toHaveLength(0);
  });

  it('handles JSON data', () => {
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
    });

    parser.write('data: {"type":"message","content":"hello"}\n\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      data: '{"type":"message","content":"hello"}',
    });
  });

  it('resets state on reset()', () => {
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
    });

    parser.write('data: incomplete');
    parser.reset();
    parser.write('data: complete\n\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ data: 'complete' });
  });

  it('handles empty writes', () => {
    const events: any[] = [];
    const parser = new SSEParser({
      onEvent: event => events.push(event),
    });

    parser.write('');
    parser.write('data: hello\n\n');
    parser.write('');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ data: 'hello' });
  });
});

describe('parseSSEStream', () => {
  it('parses events from an async iterable', async () => {
    async function* chunks() {
      yield 'data: hello\n';
      yield '\n';
      yield 'data: world\n';
      yield '\n';
    }

    const events = [];

    for await (const event of parseSSEStream(chunks())) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ data: 'hello' });
    expect(events[1]).toEqual({ data: 'world' });
  });

  it('parses events from an async iterable (async)', async () => {
    async function* asyncChunks() {
      yield 'data: chunk1\n';
      yield '\n';
      yield 'data: chunk2\n';
      yield '\n';
    }

    const events = [];

    for await (const event of parseSSEStream(asyncChunks())) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ data: 'chunk1' });
    expect(events[1]).toEqual({ data: 'chunk2' });
  });

  it('handles cross-chunk splits in async iterable', async () => {
    async function* asyncChunks() {
      yield 'data: hel';
      yield 'lo\n\n';
      yield 'data: worl';
      yield 'd\n\n';
    }

    const events = [];

    for await (const event of parseSSEStream(asyncChunks())) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ data: 'hello' });
    expect(events[1]).toEqual({ data: 'world' });
  });

  it('handles empty stream', async () => {
    async function* asyncChunks() {
      // yield nothing
    }

    const events = [];

    for await (const event of parseSSEStream(asyncChunks())) {
      events.push(event);
    }

    expect(events).toHaveLength(0);
  });

  it('parses complex events with all fields', async () => {
    async function* asyncChunks() {
      yield 'event: progress\n';
      yield 'id: msg1\n';
      yield 'data: {"step":1}\n';
      yield 'retry: 5000\n';
      yield '\n';
    }

    const events = [];

    for await (const event of parseSSEStream(asyncChunks())) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      event: 'progress',
      id: 'msg1',
      data: '{"step":1}',
      retry: 5000,
    });
  });

  it('handles OpenAI-style streaming', async () => {
    async function* openaiChunks() {
      yield 'data: {"id":"chatcmpl-123","choices":[{"delta":{"content":"Hello"}}]}\n\n';
      yield 'data: {"id":"chatcmpl-123","choices":[{"delta":{"content":" world"}}]}\n\n';
      yield 'data: [DONE]\n\n';
    }

    const events = [];

    for await (const event of parseSSEStream(openaiChunks())) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0]?.data).toContain('Hello');
    expect(events[1]?.data).toContain('world');
    expect(events[2]?.data).toEqual('[DONE]');
  });
});
