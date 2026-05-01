import { SSEParser, type SSEEvent } from './SSEParser.js';

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
  source: ReadableStream<string> | AsyncIterable<string>,
): AsyncGenerator<SSEEvent, void> {
  const eventQueue: SSEEvent[] = [];

  const parser = new SSEParser({
    onEvent: (event: SSEEvent) => {
      eventQueue.push(event);
    },
  });

  // biome-ignore useQwikValidLexicalScope: legitimate usage
  const isReadableStream = (obj: unknown): obj is ReadableStream<string> => {
    return obj != null && typeof obj === 'object' && 'getReader' in obj;
  };

  try {
    // Convert source to async iterable.
    let iterator: AsyncIterator<string>;

    if (isReadableStream(source)) {
      const reader = source.getReader();
      iterator = {
        async next(): Promise<IteratorResult<string>> {
          try {
            const { done, value } = await reader.read();
            return { done, value: value ?? '' };
          } catch {
            // Stream closed or read error; end iteration gracefully
            return { done: true, value: undefined };
          }
        },
      };
    } else {
      iterator = source[Symbol.asyncIterator]();
    }

    // Feed chunks into the parser and yield events.
    for await (const chunk of { [Symbol.asyncIterator]: () => iterator }) {
      if (chunk) {
        parser.write(chunk);
      }

      // Yield all queued events.
      while (eventQueue.length > 0) {
        const event = eventQueue.shift();
        if (event) yield event;
      }
    }

    // End of stream; flush remaining data.
    parser.end();

    // Yield any final queued events.
    while (eventQueue.length > 0) {
      const event = eventQueue.shift();
      if (event) yield event;
    }
  } catch {
    // Stream error; stop gracefully without re-throwing
  }
}
