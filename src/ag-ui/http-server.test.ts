/**
 * HTTP Server SSE Stream Tests
 *
 * Verifies SSE streaming, CORS preflight, and error handling
 */

import { describe, expect, it, vi } from 'vitest';
import { createAgentRunHandler, createExpressMiddleware, createHonoHandler, createSSEStream } from './http-server.js';
import type { AgUiEvent } from './types.js';
import { EventType } from './types.js';

describe('createSSEStream', () => {
  it('should convert async generator to SSE stream', async () => {
    async function* eventGenerator() {
      yield {
        type: EventType.RUN_STARTED,
        runId: 'run_123',
        timestamp: '2024-01-01T00:00:00Z',
      } as AgUiEvent;
      yield {
        type: EventType.RUN_FINISHED,
        runId: 'run_123',
        outcome: { type: 'success' as const },
        timestamp: '2024-01-01T00:00:01Z',
      } as AgUiEvent;
    }

    const stream = createSSEStream(eventGenerator());
    const chunks = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    // Verify SSE format (contains "data:" prefix)
    const text = new TextDecoder().decode(chunks[0]);
    expect(text).toContain('data:');
  });

  it('should handle empty event stream', async () => {
    async function* emptyGenerator() {
      // Empty
    }

    const stream = createSSEStream(emptyGenerator());
    const chunks = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(0);
  });

  it('should handle stream errors gracefully', async () => {
    async function* errorGenerator() {
      yield {
        type: EventType.RUN_STARTED,
        runId: 'run_123',
        timestamp: '2024-01-01T00:00:00Z',
      } as AgUiEvent;
      throw new Error('Stream error');
    }

    const stream = createSSEStream(errorGenerator());
    const readableChunks = [];

    try {
      for await (const chunk of stream) {
        readableChunks.push(chunk);
      }
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('Stream error');
    }
  });

  it('should support async iteration directly', async () => {
    async function* eventGenerator() {
      yield {
        type: EventType.RUN_STARTED,
        runId: 'run_123',
        timestamp: '2024-01-01T00:00:00Z',
      } as AgUiEvent;
    }

    const stream = createSSEStream(eventGenerator());

    // Use Symbol.asyncIterator
    const iterator = stream[Symbol.asyncIterator]();
    const { value } = await iterator.next();

    expect(value).toBeInstanceOf(Uint8Array);
  });
});

describe('createAgentRunHandler', () => {
  it('should handle CORS OPTIONS preflight request', async () => {
    const streamGenerator = vi.fn(async function* () {
      yield { type: EventType.RUN_STARTED, runId: 'run_1', timestamp: '' } as AgUiEvent;
    });

    const handler = createAgentRunHandler(streamGenerator);

    const req = { method: 'OPTIONS' };
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    };

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      }),
    );
    expect(res.end).toHaveBeenCalled();
  });

  it('should reject unsupported HTTP methods', async () => {
    const streamGenerator = vi.fn(async function* () {
      yield { type: EventType.RUN_STARTED, runId: 'run_1', timestamp: '' } as AgUiEvent;
    });

    const handler = createAgentRunHandler(streamGenerator);

    const req = { method: 'DELETE' };
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
      write: vi.fn(),
    };

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });

  it('should handle POST requests and stream events', async () => {
    async function* mockGenerator() {
      yield {
        type: EventType.RUN_STARTED,
        runId: 'run_123',
        timestamp: '2024-01-01T00:00:00Z',
      } as AgUiEvent;
    }

    const streamGenerator = vi.fn(() => mockGenerator());
    const handler = createAgentRunHandler(streamGenerator);

    const writeHeadHeaders: any = {};
    const res = {
      writeHead: vi.fn((code, headers) => {
        Object.assign(writeHeadHeaders, headers);
      }),
      write: vi.fn(),
      end: vi.fn(),
    };
    const req = { method: 'POST' };

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(writeHeadHeaders['Content-Type']).toBe('text/event-stream');
    expect(res.write).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });

  it('should handle streaming errors', async () => {
    async function* errorGenerator() {
      throw new Error('Generator error');
    }

    const streamGenerator = vi.fn(() => errorGenerator());
    const handler = createAgentRunHandler(streamGenerator);

    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
      write: vi.fn(),
    };
    const req = { method: 'POST' };

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
  });
});

describe('createExpressMiddleware', () => {
  it('should stream events via Express response', async () => {
    async function* mockGenerator() {
      yield {
        type: EventType.RUN_STARTED,
        runId: 'run_123',
        timestamp: '2024-01-01T00:00:00Z',
      } as AgUiEvent;
    }

    const streamGenerator = vi.fn(() => mockGenerator());
    const middleware = createExpressMiddleware(streamGenerator);

    const res = {
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      status: vi.fn(() => ({
        json: vi.fn(),
      })),
    };
    const req = {};

    await middleware(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.write).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });

  it('should handle errors in Express middleware', async () => {
    async function* errorGenerator() {
      throw new Error('Middleware error');
    }

    const streamGenerator = vi.fn(() => errorGenerator());
    const middleware = createExpressMiddleware(streamGenerator);

    const res = {
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      status: vi.fn(() => ({
        json: vi.fn(),
      })),
    };
    const req = {};

    await middleware(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('createHonoHandler', () => {
  it('should return Hono body stream', async () => {
    async function* mockGenerator() {
      yield {
        type: EventType.RUN_STARTED,
        runId: 'run_123',
        timestamp: '2024-01-01T00:00:00Z',
      } as AgUiEvent;
    }

    const streamGenerator = vi.fn(() => mockGenerator());
    const handler = createHonoHandler(streamGenerator);

    const c = {
      body: vi.fn(() => ({ status: 200 })),
    };

    const result = await handler(c);

    expect(c.body).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'text/event-stream',
        }),
      }),
    );
    expect(result).toBeDefined();
  });

  it('should handle Hono errors', async () => {
    async function* errorGenerator() {
      throw new Error('Hono error');
    }

    const streamGenerator = vi.fn(() => errorGenerator());
    const handler = createHonoHandler(streamGenerator);

    const c = {
      body: vi.fn(() => ({ status: 200 })),
      status: vi.fn(() => ({
        json: vi.fn(),
      })),
    };

    await handler(c);

    // Handler should attempt to use body() or handle error gracefully
    expect(c.body).toHaveBeenCalled();
  });
});
