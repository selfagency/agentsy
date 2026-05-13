import { describe, expect, it } from 'vitest';
import { parseSSEStream, SSEParser } from './index.js';

describe('processor/sse compatibility', () => {
  it('re-exported SSEParser parses simple events', () => {
    const events: unknown[] = [];
    const parser = new SSEParser({ onEvent: event => events.push(event) });

    parser.write('data: hello\n\n');
    parser.end();

    expect(events).toEqual([{ data: 'hello' }]);
  });

  it('re-exported parseSSEStream yields events from async iterables', async () => {
    async function* chunks() {
      yield 'data: a\n\n';
      yield 'data: b\n\n';
    }

    const events: unknown[] = [];
    for await (const event of parseSSEStream(chunks())) {
      events.push(event);
    }

    expect(events).toEqual([{ data: 'a' }, { data: 'b' }]);
  });
});
