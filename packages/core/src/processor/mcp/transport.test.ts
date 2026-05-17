import { Readable, Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { adaptTransportToStream } from './transport.js';

describe('MCP Transport', () => {
  describe('adaptTransportToStream', () => {
    it('should adapt HTTP transport to ReadableStream', async () => {
      const mockStream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue('data: test\n\n');
          controller.close();
        }
      });

      const adapted = adaptTransportToStream({
        stream: mockStream,
        type: 'http'
      });
      const reader = adapted.getReader();
      const result = await reader.read();

      expect(result.value).toBe('data: test\n\n');
      expect(result.done).toBeFalsy();
    });

    it('should adapt stdio transport to ReadableStream', async () => {
      const readable = new Readable({
        read() {
          // Push data synchronously when read is called
          if (!this.push('data: stdio test\n\n')) {
            this.push(null);
          }
        }
      });

      const writable = new Writable({
        write(_chunk: unknown, _encoding: BufferEncoding, callback: () => void) {
          callback();
        }
      });

      const adapted = adaptTransportToStream({
        readable,
        type: 'stdio',
        writable
      });
      const reader = adapted.getReader();
      const result = await reader.read();

      expect(result.value).toBe('data: stdio test\n\n');
      expect(result.done).toBeFalsy();
    });
  });
});
