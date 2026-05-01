/**
 * HTTP Server SSE Stream Tests
 *
 * Verifies SSE streaming, CORS preflight, and error handling
 */

import { describe, expect, it, vi } from 'vitest';
import { createAgentRunHandler, createExpressMiddleware, createHonoHandler, createSSEStream } from './http-server.js';
import type { AgUiEvent } from './types.js';
import { EventType } from './types.js';

// Test fixtures
async function* mockEventGenerator() {
  yield {
    type: EventType.RUN_STARTED,
    runId: 'run_123',
    timestamp: '2024-01-01T00:00:00Z',
  } as AgUiEvent;
}

async function* emptyGenerator() {
  // Empty generator for testing - yield statement required for generator syntax
  if (false) {
    yield undefined as unknown as AgUiEvent;
  }
  // Generator completes immediately
}

async function* errorGeneratorWithYield() {
  yield {
    type: EventType.RUN_STARTED,
    runId: 'run_123',
    timestamp: '2024-01-01T00:00:00Z',
  } as AgUiEvent;
  throw new Error('Generator error');
}

async function* mockErrorGenerator() {
  throw new Error('Mock generator error');
}

describe('createSSEStream', () => {
  it('should convert async generator to SSE stream', async () => {
    const stream = createSSEStream(mockEventGenerator());
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
    const stream = createSSEStream(emptyGenerator());
    const chunks = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(0);
  });

  it('should handle stream errors gracefully', async () => {
    const stream = createSSEStream(errorGeneratorWithYield());
    const readableChunks = [];

    try {
      for await (const chunk of stream) {
        readableChunks.push(chunk);
      }
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('Generator error');
    }
  });

  it('should support async iteration directly', async () => {
    const stream = createSSEStream(mockEventGenerator());

    // Use Symbol.asyncIterator
    const iterator = stream[Symbol.asyncIterator]();
    const { value } = await iterator.next();

    expect(value).toBeInstanceOf(Uint8Array);
  });
});

describe('createAgentRunHandler', () => {
  it('should handle CORS OPTIONS preflight request', async () => {
    const handler = createAgentRunHandler(() => mockEventGenerator());

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
    const handler = createAgentRunHandler(() => mockEventGenerator());

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
    const handler = createAgentRunHandler(() => mockEventGenerator());

    const writeHeadHeaders: Record<string, unknown> = {};
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
    const handler = createAgentRunHandler(() => mockErrorGenerator());

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
    const middleware = createExpressMiddleware(() => mockEventGenerator());

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
    const middleware = createExpressMiddleware(() => mockErrorGenerator());

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
    const handler = createHonoHandler(() => mockEventGenerator());

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
    const handler = createHonoHandler(() => mockErrorGenerator());

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
