import { Readable, Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { adaptTransportToStream, createCompatibilityAdapter } from './transport.js';

describe('MCP Transport', () => {
  describe('adaptTransportToStream', () => {
    it('should adapt HTTP transport to ReadableStream', async () => {
      const mockStream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue('data: test\n\n');
          controller.close();
        },
      });

      const adapted = adaptTransportToStream({ type: 'http', stream: mockStream });
      const reader = adapted.getReader();
      const result = await reader.read();

      expect(result.value).toBe('data: test\n\n');
      expect(result.done).toBe(false);
    });

    it('should adapt stdio transport to ReadableStream', async () => {
      const readable = new Readable({
        read() {
          // Push data synchronously when read is called
          if (!this.push('data: stdio test\n\n')) {
            this.push(null);
          }
        },
      });

      const writable = new Writable({
        write(_chunk: unknown, _encoding: BufferEncoding, callback: () => void) {
          callback();
        },
      });

      const adapted = adaptTransportToStream({ type: 'stdio', readable, writable });
      const reader = adapted.getReader();
      const result = await reader.read();

      expect(result.value).toBe('data: stdio test\n\n');
      expect(result.done).toBe(false);
    });
  });

  describe('createCompatibilityAdapter', () => {
    it('should create adapter for HTTP transport', () => {
      const mockStream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue('data: http\n\n');
          controller.close();
        },
      });

      const adapter = createCompatibilityAdapter({ type: 'http', stream: mockStream });
      expect(adapter.stream).toBeDefined();
      expect(adapter.cleanup).toBeUndefined();
    });

    it('should create adapter for stdio transport with cleanup', () => {
      const readable = new Readable({
        read() {
          this.push('data: stdio\n\n');
          this.push(null);
        },
      });

      const writable = new Writable({
        write(_chunk: unknown, _encoding: BufferEncoding, callback: () => void) {
          callback();
        },
      });

      const adapter = createCompatibilityAdapter({ type: 'stdio', readable, writable });
      expect(adapter.stream).toBeDefined();
      expect(adapter.cleanup).toBeDefined();

      const destroySpy = vi.spyOn(readable, 'destroy');
      adapter.cleanup();
      expect(destroySpy).toHaveBeenCalled();
    });
  });
});
