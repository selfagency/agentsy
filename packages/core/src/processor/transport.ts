import { ReadableStream } from 'node:stream/web';

/**
 * Typed union representing the two supported MCP transport modes.
 * - 'http': Standard HTTP/HTTPS transport using fetch-compatible streams.
 * - 'stdio': Direct stdio pipe transport for local/embedded MCP servers.
 */
export type MCPTransport =
  | { type: 'http'; stream: ReadableStream<string> }
  | { type: 'stdio'; readable: NodeJS.ReadableStream; writable: NodeJS.WritableStream };

type StdioTransport = Extract<MCPTransport, { type: 'stdio' }>;
type StreamReader = StdioTransport['readable'];
type StreamWriter = StdioTransport['writable'];

import { Readable } from 'node:stream';

/**
 * Adapts any MCPTransport to a unified ReadableStream<string> interface
 * for use with existing SSE/stream processors.
 * Uses Readable.toWeb() for native backpressure support (Node.js 22+).
 */
export function adaptTransportToStream(transport: MCPTransport): ReadableStream<string> {
  if (transport.type === 'http') {
    return transport.stream;
  }

  // For stdio transport, use Readable.toWeb() for native backpressure support
  // This is available in Node.js 22+ and properly handles backpressure
  if (typeof Readable.toWeb === 'function') {
    const webStream = Readable.toWeb(transport.readable) as ReadableStream<Uint8Array>;
    // Decode Uint8Array to string
    return new ReadableStream({
      async start(controller) {
        const reader = webStream.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(decoder.decode(value, { stream: true }));
          }
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }

  // Fallback: create backpressure-aware bridge for older Node versions
  // We maintain a single persistent writer and await all writes to handle backpressure properly
  const { readable: webReadable, writable } = new TransformStream<string>();

  // Single writer - maintains backpressure by awaiting each write
  const writer = writable.getWriter();

  const onData = async (chunk: unknown) => {
    try {
      // Decode chunks from Buffer/string to ensure consistent string output
      const decoded = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
      await writer.write(decoded);
    } catch (err) {
      // Re-throw non-stream errors to maintain error propagation
      if (err instanceof Error && !('code' in err && err.code === 'ERR_STREAM_WRITE_AFTER_END')) {
        throw err;
      }
    }
  };

  const onEnd = () => {
    writer.close().catch(() => {
      // Suppress errors during normal closure
    });
  };

  const onError = (err: Error) => {
    writer.abort(err).catch(() => {
      // Suppress errors during abort
    });
  };

  transport.readable.on('data', onData);
  transport.readable.on('end', onEnd);
  transport.readable.on('error', onError);

  // Cleanup on stream cancellation - destroy the underlying readable and its listeners
  webReadable.cancel = async () => {
    const readableStream = transport.readable as Readable;
    readableStream.destroy();
    readableStream.off('data', onData);
    readableStream.off('end', onEnd);
    readableStream.off('error', onError);
    await writer.close().catch(() => {});
  };

  return webReadable as unknown as ReadableStream<string>;
}

/**
 * Creates a compatibility adapter that ensures backward compatibility
 * with existing code expecting ReadableStream<string>.
 */
export function createCompatibilityAdapter(transport: MCPTransport): {
  stream: ReadableStream<string>;
  cleanup?: () => void;
} {
  const stream = adaptTransportToStream(transport);

  if (transport.type === 'stdio') {
    return {
      stream,
      cleanup: () => {
        const readable = transport.readable as NodeJS.ReadableStream;
        const writable = transport.writable as NodeJS.WritableStream;
        (readable as unknown as { destroy?: () => void }).destroy?.();
        (writable as unknown as { destroy?: () => void }).destroy?.();
      },
    };
  }

  return { stream };
}
