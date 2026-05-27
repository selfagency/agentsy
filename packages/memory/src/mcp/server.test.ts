import { beforeEach, describe, expect, it, vi } from 'vitest';

// ===== Hoisted shared state for module mocks =====
// These must be created before vi.mock factories reference them (hoisted execution order)
const { readlineMock, httpMock } = vi.hoisted(() => {
  // Readline mock: capture event listeners so tests can trigger events
  const rlEvents: Record<string, Array<(...args: unknown[]) => void>> = {};
  const rl = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!rlEvents[event]) {
        rlEvents[event] = [];
      }
      rlEvents[event].push(handler);
      return rl;
    }),
    close: vi.fn()
  };

  // HTTP mock: capture the request handler callback
  const requestHandlerRef: { current?: (req: unknown, res: unknown) => void } = {};
  const server = {
    listen: vi.fn((_port: number, cb: () => void) => cb()),
    close: vi.fn((cb: () => void) => cb())
  };

  return {
    readlineMock: { rl, events: rlEvents },
    httpMock: { server, requestHandlerRef }
  };
});

// ===== Module-level mocks (hoisted by Vitest) =====
vi.mock('./protocol.js', () => ({
  createMcpServer: vi.fn()
}));

vi.mock('./tools.js', () => ({
  createMemoryMcpTools: vi.fn()
}));

vi.mock('node:readline', () => ({
  createInterface: vi.fn(() => readlineMock.rl)
}));

vi.mock('node:http', () => ({
  createServer: vi.fn((handler: (req: unknown, res: unknown) => void) => {
    httpMock.requestHandlerRef.current = handler;
    return httpMock.server;
  })
}));

// ===== Dynamic imports (after vi.mock) =====
const { createMcpServer } = await import('./protocol.js');
const { createMemoryMcpTools } = await import('./tools.js');
const { createMemoryMCPServer } = await import('./server.js');

// ===== Test Helpers =====

function mockEngine() {
  return {
    stats: vi.fn().mockReturnValue({ totalItems: 0 }),
    ingest: vi.fn(),
    recall: vi.fn(),
    awaken: vi.fn(),
    snapshot: vi.fn()
  } as never;
}

function setupBasicMocks(handleMessageResult?: unknown) {
  vi.mocked(createMcpServer).mockReturnValue({
    handleMessage: vi.fn().mockResolvedValue(handleMessageResult ?? { jsonrpc: '2.0', id: 1, result: 'ok' }),
    close: vi.fn(),
    capabilities: vi.fn()
  });
  vi.mocked(createMemoryMcpTools).mockReturnValue({ definitions: {}, handlers: {} });
}

function makeMockRes() {
  return {
    writeHead: vi.fn(),
    end: vi.fn()
  };
}

// ===== Tests =====
describe('MemoryMCPServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up custom mock state
    for (const k of Object.keys(readlineMock.events)) {
      delete readlineMock.events[k];
    }
    httpMock.requestHandlerRef.current = undefined;
  });

  // -------- Existing tests (preserved) --------

  it('throws if a tool definition has no matching handler', () => {
    vi.mocked(createMemoryMcpTools).mockReturnValue({
      definitions: {
        memory_ingest: { name: 'memory_ingest', description: '', inputSchema: {} },
        memory_recall: { name: 'memory_recall', description: '', inputSchema: {} }
      },
      handlers: { memory_ingest: vi.fn() }
    });

    expect(() => createMemoryMCPServer(mockEngine())).toThrow('Missing handler for tool: memory_recall');
  });

  it('creates server with default options', () => {
    let capturedOptions: unknown;
    vi.mocked(createMcpServer).mockImplementation((opts: unknown) => {
      capturedOptions = opts;
      return { handleMessage: vi.fn(), close: vi.fn(), capabilities: vi.fn() };
    });
    vi.mocked(createMemoryMcpTools).mockReturnValue({ definitions: {}, handlers: {} });

    const server = createMemoryMCPServer(mockEngine());

    expect(server.server).toBeDefined();
    expect(capturedOptions).toMatchObject({ name: 'agentsy-memory', version: '0.1.0' });
  });

  it('close does not throw when no readline or http server started', async () => {
    setupBasicMocks();
    const server = createMemoryMCPServer(mockEngine());
    await expect(server.close()).resolves.toBeUndefined();
  });

  it('close calls mcpServer.close', async () => {
    const closeFn = vi.fn();
    vi.mocked(createMcpServer).mockReturnValue({
      handleMessage: vi.fn(),
      close: closeFn,
      capabilities: vi.fn()
    });
    vi.mocked(createMemoryMcpTools).mockReturnValue({ definitions: {}, handlers: {} });

    const server = createMemoryMCPServer(mockEngine());
    await server.close();
    expect(closeFn).toHaveBeenCalled();
  });

  it('start in stdio mode resolves successfully', async () => {
    setupBasicMocks();
    const server = createMemoryMCPServer(mockEngine());
    await expect(server.start()).resolves.toBeUndefined();
  });

  it('start in http mode creates an http server', async () => {
    setupBasicMocks();
    const server = createMemoryMCPServer(mockEngine(), { transport: 'http', port: 0 });
    await expect(server.start()).resolves.toBeUndefined();
  });

  // -------- readline 'line' event handler --------

  describe('readline line event', () => {
    it('handles valid JSON-RPC message and writes response to stdout', async () => {
      const expectedResponse = { jsonrpc: '2.0', id: 1, result: 'handled' };
      const handleMessage = vi.fn().mockResolvedValue(expectedResponse);
      vi.mocked(createMcpServer).mockReturnValue({
        handleMessage,
        close: vi.fn(),
        capabilities: vi.fn()
      });
      vi.mocked(createMemoryMcpTools).mockReturnValue({ definitions: {}, handlers: {} });

      const server = createMemoryMCPServer(mockEngine());
      await server.start();
      const lineHandler = readlineMock.events.line?.[0];
      expect(lineHandler).toBeDefined();

      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await lineHandler?.('{"jsonrpc":"2.0","id":1,"method":"test"}');

        expect(handleMessage).toHaveBeenCalledWith({
          jsonrpc: '2.0',
          id: 1,
          method: 'test'
        });
        expect(stdoutSpy).toHaveBeenCalledWith(`${JSON.stringify(expectedResponse)}\n`);
      } finally {
        stdoutSpy.mockRestore();
      }
    });

    it('skips empty lines', async () => {
      const handleMessage = vi.fn();
      vi.mocked(createMcpServer).mockReturnValue({
        handleMessage,
        close: vi.fn(),
        capabilities: vi.fn()
      });
      vi.mocked(createMemoryMcpTools).mockReturnValue({ definitions: {}, handlers: {} });

      const server = createMemoryMCPServer(mockEngine());
      await server.start();
      const lineHandler = readlineMock.events.line?.[0];
      expect(lineHandler).toBeDefined();

      await lineHandler?.('');
      await lineHandler?.('   ');
      await lineHandler?.('\t');

      expect(handleMessage).not.toHaveBeenCalled();
    });

    it('writes parse error response for invalid JSON', async () => {
      const handleMessage = vi.fn();
      vi.mocked(createMcpServer).mockReturnValue({
        handleMessage,
        close: vi.fn(),
        capabilities: vi.fn()
      });
      vi.mocked(createMemoryMcpTools).mockReturnValue({ definitions: {}, handlers: {} });

      const server = createMemoryMCPServer(mockEngine());
      await server.start();
      const lineHandler = readlineMock.events.line?.[0];
      expect(lineHandler).toBeDefined();

      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await lineHandler?.('not valid json');

        expect(handleMessage).not.toHaveBeenCalled();
        expect(stdoutSpy).toHaveBeenCalledOnce();
        const callArg = stdoutSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(callArg);
        expect(parsed).toMatchObject({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32_700 }
        });
        expect(parsed.error.message).toContain('Parse error');
      } finally {
        stdoutSpy.mockRestore();
      }
    });

    it('writes error response when handleMessage throws', async () => {
      const handleMessage = vi.fn().mockRejectedValue(new Error('Internal failure'));
      vi.mocked(createMcpServer).mockReturnValue({
        handleMessage,
        close: vi.fn(),
        capabilities: vi.fn()
      });
      vi.mocked(createMemoryMcpTools).mockReturnValue({ definitions: {}, handlers: {} });

      const server = createMemoryMCPServer(mockEngine());
      await server.start();
      const lineHandler = readlineMock.events.line?.[0];
      expect(lineHandler).toBeDefined();

      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await lineHandler?.('{"jsonrpc":"2.0","id":1,"method":"test"}');

        expect(handleMessage).toHaveBeenCalled();
        expect(stdoutSpy).toHaveBeenCalledOnce();
        const callArg = stdoutSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(callArg);
        expect(parsed).toMatchObject({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32_700 }
        });
        expect(parsed.error.message).toContain('Parse error');
      } finally {
        stdoutSpy.mockRestore();
      }
    });

    it('does not write to stdout when handleMessage returns undefined', async () => {
      const handleMessage = vi.fn().mockResolvedValue(undefined);
      vi.mocked(createMcpServer).mockReturnValue({
        handleMessage,
        close: vi.fn(),
        capabilities: vi.fn()
      });
      vi.mocked(createMemoryMcpTools).mockReturnValue({ definitions: {}, handlers: {} });

      const server = createMemoryMCPServer(mockEngine());
      await server.start();
      const lineHandler = readlineMock.events.line?.[0];
      expect(lineHandler).toBeDefined();

      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await lineHandler?.('{"jsonrpc":"2.0","id":1,"method":"test"}');

        expect(handleMessage).toHaveBeenCalled();
        expect(stdoutSpy).not.toHaveBeenCalled();
      } finally {
        stdoutSpy.mockRestore();
      }
    });
  });

  // -------- readline 'close' event --------

  describe('readline close event', () => {
    it('logs info message when stdin closes', async () => {
      setupBasicMocks();
      const server = createMemoryMCPServer(mockEngine());
      await server.start();

      const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      try {
        const closeHandler = readlineMock.events.close?.[0];
        expect(closeHandler).toBeDefined();
        closeHandler?.();

        expect(stderrSpy).toHaveBeenCalledWith('[agentsy-memory:info] Stdin closed, shutting down\n');
      } finally {
        stderrSpy.mockRestore();
      }
    });
  });

  // -------- HTTP mode request handler --------

  describe('HTTP mode', () => {
    it('GET /health returns engine stats', async () => {
      const statsResult = { totalItems: 42, totalTokens: 1000, budgetUtilization: 0.5 };
      const statsFn = vi.fn().mockReturnValue(statsResult);
      const engine = {
        stats: statsFn,
        ingest: vi.fn(),
        recall: vi.fn(),
        awaken: vi.fn(),
        snapshot: vi.fn()
      } as never;

      setupBasicMocks();
      const server = createMemoryMCPServer(engine, { transport: 'http', port: 0 });
      await server.start();

      const handler = httpMock.requestHandlerRef.current as (req: unknown, res: unknown) => void;
      expect(handler).toBeDefined();
      const req = { method: 'GET', url: '/health' };
      const res = makeMockRes();

      handler(req, res);

      expect(statsFn).toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: 'ok', engine: statsResult }));
    });

    it('POST /message handles valid JSON-RPC body', async () => {
      const mockResult = { jsonrpc: '2.0', id: 1, result: 'completed' };
      const handleMessage = vi.fn().mockResolvedValue(mockResult);
      vi.mocked(createMcpServer).mockReturnValue({
        handleMessage,
        close: vi.fn(),
        capabilities: vi.fn()
      });
      vi.mocked(createMemoryMcpTools).mockReturnValue({ definitions: {}, handlers: {} });

      const server = createMemoryMCPServer(mockEngine(), { transport: 'http', port: 0 });
      await server.start();

      const handler = httpMock.requestHandlerRef.current as (req: unknown, res: unknown) => void;
      expect(handler).toBeDefined();

      // Build an async-iterable request (simulates IncomingMessage stream)
      const body = '{"jsonrpc":"2.0","id":1,"method":"test"}';
      let sent = false;
      const req = {
        method: 'POST' as const,
        url: '/message',
        [Symbol.asyncIterator]: () => ({
          next: () => {
            if (!sent) {
              sent = true;
              return Promise.resolve({ done: false, value: Buffer.from(body) });
            }
            return Promise.resolve({ done: true, value: undefined as unknown as Buffer });
          }
        })
      };
      const res = makeMockRes();

      handler(req, res);

      expect(handleMessage).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 1,
        method: 'test'
      });
      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      const endArg = res.end.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(endArg);
      expect(parsed).toMatchObject({ jsonrpc: '2.0', result: 'completed' });
    });

    it('POST /message returns 400 on body parse error', async () => {
      const handleMessage = vi.fn();
      vi.mocked(createMcpServer).mockReturnValue({
        handleMessage,
        close: vi.fn(),
        capabilities: vi.fn()
      });
      vi.mocked(createMemoryMcpTools).mockReturnValue({ definitions: {}, handlers: {} });

      const server = createMemoryMCPServer(mockEngine(), { transport: 'http', port: 0 });
      await server.start();

      const handler = httpMock.requestHandlerRef.current as (req: unknown, res: unknown) => void;
      expect(handler).toBeDefined();

      let sent = false;
      const req = {
        method: 'POST' as const,
        url: '/message',
        [Symbol.asyncIterator]: () => ({
          next: () => {
            if (!sent) {
              sent = true;
              return Promise.resolve({ done: false, value: Buffer.from('not valid json') });
            }
            return Promise.resolve({ done: true, value: undefined as unknown as Buffer });
          }
        })
      };
      const res = makeMockRes();

      handler(req, res);

      expect(handleMessage).not.toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
      const endArg = res.end.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(endArg);
      expect(parsed).toMatchObject({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32_700 }
      });
      expect(parsed.error.message).toContain('Parse error');
    });

    it('POST /message returns 400 when handleMessage throws', async () => {
      const handleMessage = vi.fn().mockRejectedValue(new Error('processing failed'));
      vi.mocked(createMcpServer).mockReturnValue({
        handleMessage,
        close: vi.fn(),
        capabilities: vi.fn()
      });
      vi.mocked(createMemoryMcpTools).mockReturnValue({ definitions: {}, handlers: {} });

      const server = createMemoryMCPServer(mockEngine(), { transport: 'http', port: 0 });
      await server.start();

      const handler = httpMock.requestHandlerRef.current as (req: unknown, res: unknown) => void;
      expect(handler).toBeDefined();

      let sent = false;
      const req = {
        method: 'POST' as const,
        url: '/message',
        [Symbol.asyncIterator]: () => ({
          next: () => {
            if (!sent) {
              sent = true;
              return Promise.resolve({
                done: false,
                value: Buffer.from('{"jsonrpc":"2.0","id":1,"method":"test"}')
              });
            }
            return Promise.resolve({ done: true, value: undefined as unknown as Buffer });
          }
        })
      };
      const res = makeMockRes();

      handler(req, res);

      expect(handleMessage).toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
      const endArg = res.end.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(endArg);
      expect(parsed).toMatchObject({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32_700 }
      });
    });

    it('GET /message (non-POST) returns 404', async () => {
      setupBasicMocks();
      const server = createMemoryMCPServer(mockEngine(), { transport: 'http', port: 0 });
      await server.start();

      const handler = httpMock.requestHandlerRef.current as (req: unknown, res: unknown) => void;
      expect(handler).toBeDefined();
      const req = { method: 'GET', url: '/message' };
      const res = makeMockRes();

      handler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(404);
      expect(res.end).toHaveBeenCalledWith('Not found');
    });

    it('returns 404 for unrecognized routes', async () => {
      setupBasicMocks();
      const server = createMemoryMCPServer(mockEngine(), { transport: 'http', port: 0 });
      await server.start();

      const handler = httpMock.requestHandlerRef.current as (req: unknown, res: unknown) => void;
      expect(handler).toBeDefined();
      const req = { method: 'PUT', url: '/unknown' };
      const res = makeMockRes();

      handler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(404);
      expect(res.end).toHaveBeenCalledWith('Not found');
    });

    it('POST /message with null result writes fallback response', async () => {
      const handleMessage = vi.fn().mockResolvedValue(null);
      vi.mocked(createMcpServer).mockReturnValue({
        handleMessage,
        close: vi.fn(),
        capabilities: vi.fn()
      });
      vi.mocked(createMemoryMcpTools).mockReturnValue({ definitions: {}, handlers: {} });

      const server = createMemoryMCPServer(mockEngine(), { transport: 'http', port: 0 });
      await server.start();

      const handler = httpMock.requestHandlerRef.current as (req: unknown, res: unknown) => void;
      expect(handler).toBeDefined();

      let sent = false;
      const req = {
        method: 'POST' as const,
        url: '/message',
        [Symbol.asyncIterator]: () => ({
          next: () => {
            if (!sent) {
              sent = true;
              return Promise.resolve({
                done: false,
                value: Buffer.from('{"jsonrpc":"2.0","id":1,"method":"test"}')
              });
            }
            return Promise.resolve({ done: true, value: undefined as unknown as Buffer });
          }
        })
      };
      const res = makeMockRes();

      handler(req, res);

      expect(handleMessage).toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      const endArg = res.end.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(endArg);
      // Should have used the fallback when result is null
      expect(parsed).toEqual({ jsonrpc: '2.0', id: null, result: null });
    });
  });

  // -------- close() cleanup --------

  describe('close cleanup', () => {
    it('closes readline interface when in stdio mode', async () => {
      setupBasicMocks();
      const server = createMemoryMCPServer(mockEngine());
      await server.start();

      expect(readlineMock.rl.close).not.toHaveBeenCalled();
      await server.close();
      expect(readlineMock.rl.close).toHaveBeenCalled();
    });

    it('closes http server when in HTTP mode', async () => {
      setupBasicMocks();
      const server = createMemoryMCPServer(mockEngine(), { transport: 'http', port: 0 });
      await server.start();

      await server.close();
      expect(httpMock.server.close).toHaveBeenCalled();
    });

    it('calls mcpServer.close() after transport cleanup', async () => {
      const mockClose = vi.fn();
      vi.mocked(createMcpServer).mockReturnValue({
        handleMessage: vi.fn(),
        close: mockClose,
        capabilities: vi.fn()
      });
      vi.mocked(createMemoryMcpTools).mockReturnValue({ definitions: {}, handlers: {} });

      const server = createMemoryMCPServer(mockEngine());
      await server.start();
      await server.close();
      expect(mockClose).toHaveBeenCalled();
    });
  });

  // -------- log() function coverage --------

  describe('logging', () => {
    it('logs startup message in stdio mode', async () => {
      setupBasicMocks();
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      try {
        const server = createMemoryMCPServer(mockEngine());
        await server.start();

        expect(stderrSpy).toHaveBeenCalledWith('[agentsy-memory:info] Starting MCP server (stdio mode)\n');
      } finally {
        stderrSpy.mockRestore();
      }
    });

    it('logs startup message in HTTP mode with correct port', async () => {
      setupBasicMocks();
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      try {
        const server = createMemoryMCPServer(mockEngine(), { transport: 'http', port: 9999 });
        await server.start();

        expect(stderrSpy).toHaveBeenCalledWith('[agentsy-memory:info] MCP server (HTTP mode) listening on port 9999\n');
      } finally {
        stderrSpy.mockRestore();
      }
    });

    it('logs close message when server is closed', async () => {
      setupBasicMocks();
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      try {
        const server = createMemoryMCPServer(mockEngine());
        await server.close();

        expect(stderrSpy).toHaveBeenCalledWith('[agentsy-memory:info] MCP server closed\n');
      } finally {
        stderrSpy.mockRestore();
      }
    });
  });
});
