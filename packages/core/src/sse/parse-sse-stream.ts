import type { SSEEvent } from './sse-parser.js';
import { SSEParser } from './sse-parser.js';

/**
 * Parse a stream of SSE frames as an async generator.
 *
 * @param source - ReadableStream or AsyncIterable<string> of SSE text
 * @returns Async generator yielding SSEEvent objects
 *
 * @example
 * ```ts
 * const response = await fetch('https://api.example.com/stream');
 * const events = parseSSEStream(response.body);
 *
 * for await (const event of events) {
 *   console.log('Event:', event.event, 'Data:', event.data);
 * }
 * ```
 */
export async function* parseSSEStream(
  source: ReadableStream<string> | AsyncIterable<string>
): AsyncGenerator<SSEEvent, void> {
  const eventQueue: SSEEvent[] = [];

  const parser = new SSEParser({
    onEvent: (event: SSEEvent) => {
      eventQueue.push(event);
    }
  });

  // biome-ignore lint/correctness/useQwikValidLexicalScope: legitimate usage
  const isReadableStream = (obj: unknown): obj is ReadableStream<string> =>
    obj != null && typeof obj === 'object' && 'getReader' in obj;

  async function* iterateReadableStream(stream: ReadableStream<string>): AsyncGenerator<string> {
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          return;
        }
        yield value ?? '';
      }
    } finally {
      reader.releaseLock();
    }
  }

  async function* iterateAsyncIterable(iterable: AsyncIterable<string>): AsyncGenerator<string> {
    yield* iterable;
  }

  async function* iterateChunks(): AsyncGenerator<string> {
    if (isReadableStream(source)) {
      yield* iterateReadableStream(source);
      return;
    }

    yield* iterateAsyncIterable(source);
  }

  // Feed chunks into the parser and yield events.
  for await (const chunk of iterateChunks()) {
    if (chunk) {
      parser.write(chunk);
    }

    // Yield all queued events.
    while (eventQueue.length > 0) {
      const event = eventQueue.shift();
      if (event) {
        yield event;
      }
    }
  }

  // End of stream; flush remaining data.
  parser.end();

  // Yield any final queued events.
  while (eventQueue.length > 0) {
    const event = eventQueue.shift();
    if (event) {
      yield event;
    }
  }
}
