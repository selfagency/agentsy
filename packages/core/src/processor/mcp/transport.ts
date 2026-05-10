import { ReadableStream } from 'node:stream/web';

/**
 * Typed union representing the two supported MCP transport modes.
 * - 'http': Standard HTTP/HTTPS transport using fetch-compatible streams.
 * - 'stdio': Direct stdio pipe transport for local/embedded MCP servers.
 */
export type MCPTransport =
  | { type: 'http'; stream: ReadableStream<string> }
  | { type: 'stdio'; readable: NodeJS.ReadableStream; writable: NodeJS.WritableStream };

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
          const flushed = decoder.decode();
          if (flushed.length > 0) {
            controller.enqueue(flushed);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        } finally {
          reader.releaseLock();
        }
      },
    });
  }

  // Fallback: bridge the Node readable through async iteration so the
  // ReadableStream pulls one chunk at a time and preserves backpressure.
  const readableStream = transport.readable as Readable;
  const iterator = readableStream[Symbol.asyncIterator]();
  const decoder = new TextDecoder();
  let finished = false;

  // Helper function to convert chunk to string
  function convertChunkToString(chunk: unknown): string {
    if (typeof chunk === 'string') {
      return chunk;
    }
    if (Buffer.isBuffer(chunk)) {
      return chunk.toString('utf-8');
    }
    if (chunk instanceof Uint8Array) {
      return decoder.decode(chunk, { stream: true });
    }
    return String(chunk);
  }

  return new ReadableStream<string>({
    async pull(controller) {
      if (finished) {
        return;
      }
      try {
        const { done, value } = await iterator.next();
        if (done) {
          finished = true;
          controller.close();
          return;
        }
        controller.enqueue(convertChunkToString(value));
      } catch (err) {
        finished = true;
        controller.error(err);
      }
    },
    async cancel() {
      finished = true;
      await iterator.return?.();
      readableStream.destroy();
    },
  });
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
        const readable = transport.readable;
        const writable = transport.writable;
        (readable as unknown as { destroy?: () => void }).destroy?.();
        (writable as unknown as { destroy?: () => void }).destroy?.();
      },
    };
  }

  return { stream };
}
