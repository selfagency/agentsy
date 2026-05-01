/**
 * AG-UI HTTP Server Helpers
 *
 * Provides request handlers for various frameworks that wrap an LLM pipeline
 * and emit AG-UI events as Server-Sent Events (SSE).
 *
 * This makes llm-stream-parser a complete AG-UI backend without additional code:
 * - Direct-to-LLM provider integration (OpenAI, Anthropic, Gemini, etc.)
 * - Automatic AG-UI event emission
 * - SSE streaming response
 * - Compatible with Node.js http, Hono, Express, Fastify, etc.
 */

import type { AgUiEvent } from './types.js';

/**
 * Options for SSE stream creation.
 */
export interface SSEStreamOptions {
  /**
   * Custom event formatter. Default: JSON serialization.
   */
  formatEvent?: (event: AgUiEvent) => string;

  /**
   * Whether to include comments (default: false).
   */
  includeComments?: boolean;

  /**
   * Heartbeat interval in ms to keep connection alive (default: 30000).
   */
  heartbeatInterval?: number;
}

/**
 * Represents an SSE stream that can be piped or consumed.
 *
 * The stream emits:
 * - `event: <eventType>` (SSE event name)
 * - `data: <JSON>` (SSE data payload)
 * - Heartbeat `:` comments (optional, to keep connection alive)
 */
export interface SSEStream {
  /**
   * Web Streams API ReadableStream. Use for Hono, Deno, browser fetch.
   */
  readonly readable: ReadableStream<Uint8Array>;

  /**
   * AsyncIterable for manual consumption and Node.js compatibility.
   */
  [Symbol.asyncIterator](): AsyncIterator<Uint8Array>;
}

/**
 * Converts an AsyncGenerator of AG-UI events into an SSE stream.
 *
 * Formats each event as:
 * event: <eventType>
 * data: <JSON>
 *
 * @param events - AsyncGenerator of AG-UI events
 * @param options - Configuration
 * @returns SSE stream (supports both Node.js and Web Streams APIs)
 */
export function createSSEStream(
  events: AsyncGenerator<AgUiEvent>,
  options: SSEStreamOptions = {},
): {
  readable: ReadableStream<Uint8Array>;
  [Symbol.asyncIterator](): AsyncIterator<Uint8Array>;
} {
  const {
    formatEvent = defaultFormatEvent,
    includeComments: _includeComments = false,
    heartbeatInterval: _heartbeatInterval = 30000,
  } = options;

  // Create an async iterable that produces SSE-formatted chunks
  const createAsyncIterable = async function* () {
    const encoder = new TextEncoder();

    try {
      // Emit each event as SSE-formatted data
      for await (const event of events) {
        yield encoder.encode(formatEvent(event));
      }
    } finally {
      // Cleanup on stream end (no action needed currently)
    }
  };

  // Create Web Streams API ReadableStream
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of createAsyncIterable()) {
          controller.enqueue(chunk);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return {
    readable,
    async *[Symbol.asyncIterator]() {
      const reader = readable.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}

/**
 * Default SSE event formatter.
 *
 * Formats an AG-UI event as:
 * ```
 * event: <eventType>
 * data: <JSON>
 *
 * ```
 */
function defaultFormatEvent(event: AgUiEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Creates a simple HTTP response handler for Node.js.
 *
 * @param streamGenerator - Function that returns an AsyncGenerator of AG-UI events
 * @returns Handler function for Node.js http module
 */
export function createAgentRunHandler(streamGenerator: (runId: string) => AsyncGenerator<AgUiEvent>) {
  return async (req: Record<string, unknown>, res: Record<string, unknown>): Promise<void> => {
    // Handle CORS preflight
    if ((req.method as string) === 'OPTIONS') {
      (res.writeHead as Function)(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      (res.end as Function)();
      return;
    }

    if ((req.method as string) !== 'POST' && (req.method as string) !== 'GET') {
      (res.writeHead as Function)(405, { 'Content-Type': 'application/json' });
      (res.end as Function)(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    try {
      const events = streamGenerator(runId);
      const sseStream = createSSEStream(events);

      (res.writeHead as Function)(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });

      for await (const chunk of sseStream) {
        (res.write as Function)(chunk);
      }

      (res.end as Function)();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      (res.writeHead as Function)(500, { 'Content-Type': 'application/json' });
      (res.end as Function)(JSON.stringify({ error: errorMessage }));
    }
  };
}

/**
 * Creates an Express-compatible middleware for streaming AG-UI events.
 *
 * @param streamGenerator - Function that returns an AsyncGenerator of AG-UI events
 * @returns Express middleware
 */
export function createExpressMiddleware(streamGenerator: (runId: string) => AsyncGenerator<AgUiEvent>) {
  return async (_req: Record<string, unknown>, res: Record<string, unknown>) => {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    try {
      const events = streamGenerator(runId);
      const sseStream = createSSEStream(events);

      (res.setHeader as Function)('Content-Type', 'text/event-stream');
      (res.setHeader as Function)('Cache-Control', 'no-cache');
      (res.setHeader as Function)('Connection', 'keep-alive');
      (res.setHeader as Function)('Access-Control-Allow-Origin', '*');

      for await (const chunk of sseStream) {
        (res.write as Function)(chunk);
      }

      (res.end as Function)();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      (res.status as Function)(500).json({ error: errorMessage });
    }
  };
}

/**
 * Helper to create a Hono handler for streaming AG-UI events.
 *
 * @param streamGenerator - Function that returns an AsyncGenerator of AG-UI events
 * @returns Hono handler
 */
export function createHonoHandler(streamGenerator: (runId: string) => AsyncGenerator<AgUiEvent>) {
  return async (c: Record<string, unknown>) => {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    try {
      const events = streamGenerator(runId);
      const sseStream = createSSEStream(events);

      const bodyFn = c.body as unknown as (stream: ReadableStream<Uint8Array> | AsyncGenerator<Uint8Array>, options: Record<string, unknown>) => unknown;

      return bodyFn(sseStream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const _jsonFn = c.json as unknown as (data: Record<string, unknown>, status: number) => unknown;
      return _jsonFn({ error: errorMessage }, 500);
    }
  };
}
