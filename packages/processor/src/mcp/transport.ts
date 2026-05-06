import type { ReadableStream } from 'stream/web';

/**
 * Typed union representing the two supported MCP transport modes.
 * - 'http': Standard HTTP/HTTPS transport using fetch-compatible streams.
 * - 'stdio': Direct stdio pipe transport for local/embedded MCP servers.
 */
export type MCPTransport =
  | { type: 'http'; stream: ReadableStream<string> }
  | { type: 'stdio'; readable: NodeJS.ReadableStream; writable: NodeJS.WritableStream };

/**
 * Adapts any MCPTransport to a unified ReadableStream<string> interface
 * for use with existing SSE/stream processors.
 */
export function adaptTransportToStream(transport: MCPTransport): ReadableStream<string> {
  if (transport.type === 'http') {
    return transport.stream;
  }

  // For stdio transport, we create a transform stream that bridges
  // Node stdio streams to web ReadableStream
  const { readable, writable } = new TransformStream<string, string>();

  transport.readable.on('data', chunk => {
    const writer = writable.getWriter();
    writer.write(chunk.toString()).catch(() => {
      // Ignore write errors to maintain backpressure resilience
    });
    writer.releaseLock();
  });

  transport.readable.on('end', () => {
    writable.close().catch(() => {
      // Ignore close errors
    });
  });

  transport.readable.on('error', err => {
    writable.abort(err).catch(() => {
      // Ignore abort errors
    });
  });

  return readable;
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
        (transport.readable as any).destroy?.();
        (transport.writable as any).destroy?.();
      },
    };
  }

  return { stream };
}
