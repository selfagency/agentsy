import { Readable } from 'node:stream';
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

/**
 * Adapts any MCPTransport to a unified ReadableStream<string> interface
 * for use with existing SSE/stream processors.
 * Uses Readable.toWeb() for native backpressure support (Node.js 22+).
 */
export function adaptTransportToStream(transport: MCPTransport): ReadableStream<string> {
  if (transport.type === 'http') {
    return transport.stream;
  }

  // For stdio transport, use Readable.toWeb() for native backpressure support.
  if (typeof Readable.toWeb === 'function') {
    const webStream = Readable.toWeb(transport.readable as Readable) as ReadableStream<Uint8Array>;
    return new ReadableStream<string>({
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

  // Fallback bridge for older Node versions.
  const { readable: webReadable, writable } = new TransformStream<string>();
  const writer = writable.getWriter();

  const onData = async (chunk: unknown) => {
    try {
      const decoded = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
      await writer.write(decoded);
    } catch (err) {
      if (!(err instanceof Error && 'code' in err && err.code === 'ERR_STREAM_WRITE_AFTER_END')) {
        throw err;
      }
    }
  };

  const onEnd = () => {
    void writer.close();
  };

  const onError = (err: Error) => {
    void writer.abort(err);
  };

  transport.readable.on('data', onData);
  transport.readable.on('end', onEnd);
  transport.readable.on('error', onError);

  webReadable.cancel = async () => {
    const readableStream = transport.readable as Readable;
    readableStream.destroy();
    readableStream.off('data', onData);
    readableStream.off('end', onEnd);
    readableStream.off('error', onError);
    await writer.close().catch(() => {});
  };

  return webReadable;
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
        const stdio = transport as StdioTransport;
        (stdio.readable as Readable).destroy?.();
        const writable = stdio.writable as NodeJS.WritableStream & { destroy?: () => void };
        writable.destroy?.();
      },
    };
  }

  return { stream };
}
