// MCP stdio server — lightweight JSON-RPC 2.0 transport over stdin/stdout
// No dependency on @modelcontextprotocol/sdk (Zod v4 heavy); uses protocol.ts

import type { MemoryEngine } from '../cognitive/memory-engine.js';
import { createMcpServer, type JsonRpcRequest, type McpServer, type McpServerOptions } from './protocol.js';
import { createMemoryMcpTools } from './tools.js';

export interface MemoryMCPServerOptions {
  /** Database path for standalone mode */
  dbPath?: string;
  /** Log level. Default: 'info' */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Port for HTTP mode. Default: 4231 */
  port?: number;
  /** Turso auth token */
  syncAuthToken?: string;
  /** Turso sync URL */
  syncUrl?: string;
  /** Transport mode. Default: 'stdio' */
  transport?: 'stdio' | 'http';
}

export interface MemoryMCPServer {
  close(): Promise<void>;
  server: McpServer;
  start(): Promise<void>;
}

/**
 * Create a memory MCP server backed by a MemoryEngine instance.
 * In stdio mode, reads JSON-RPC from stdin and writes to stdout.
 * In HTTP mode, starts a simple HTTP server (SSE-based).
 */
export function createMemoryMCPServer(engine: MemoryEngine, options: MemoryMCPServerOptions = {}): MemoryMCPServer {
  const { transport = 'stdio', port = 4231, logLevel = 'info' } = options;

  const { definitions, handlers } = createMemoryMcpTools(engine);

  const serverOptions: McpServerOptions = {
    name: 'agentsy-memory',
    version: '0.1.0',
    tools: Object.fromEntries(
      Object.entries(definitions).map(([name, def]) => {
        // nosemgrep: typescript.lang.security.detect-object-injection.detect-object-injection -- name from Object.entries() on own definitions object
        const handler = handlers[name];
        if (!handler) {
          throw new Error(`Missing handler for tool: ${name}`);
        }
        return [name, { definition: def, handler }];
      })
    )
  };

  const mcpServer = createMcpServer(serverOptions);

  let readlineInterface: ReturnType<typeof import('node:readline').createInterface> | null = null;
  let httpServer: ReturnType<typeof import('node:http').createServer> | null = null;

  const LOG_LEVELS: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  const currentLevel = LOG_LEVELS[logLevel] ?? 1;

  function log(level: string, msg: string) {
    if ((LOG_LEVELS[level] ?? 1) >= currentLevel) {
      process.stderr.write(`[agentsy-memory:${level}] ${msg}\n`);
    }
  }

  async function start(): Promise<void> {
    if (transport === 'stdio') {
      const readline = await import('node:readline');
      readlineInterface = readline.createInterface({
        input: process.stdin,
        terminal: false
      });

      log('info', 'Starting MCP server (stdio mode)');

      readlineInterface.on('line', async (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return;
        }

        try {
          const msg = JSON.parse(trimmed) as JsonRpcRequest;
          const result = await mcpServer.handleMessage(msg);

          if (result) {
            process.stdout.write(`${JSON.stringify(result)}\n`);
          }
        } catch (err) {
          const errorResp = {
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32_700,
              message: `Parse error: ${err instanceof Error ? err.message : String(err)}`
            }
          };
          process.stdout.write(`${JSON.stringify(errorResp)}\n`);
        }
      });

      readlineInterface.on('close', () => {
        log('info', 'Stdin closed, shutting down');
      });
    } else {
      // HTTP mode — simple JSON-RPC over POST /message
      const http = await import('node:http');

      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: refactor planned
      const httpInstance = http.createServer(async (req, res) => {
        if (req.method === 'GET' && req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', engine: engine.stats() }));
          return;
        }

        if (req.method === 'POST' && req.url === '/message') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk as Buffer);
          }
          const body = Buffer.concat(chunks).toString('utf-8');

          try {
            const msg = JSON.parse(body) as JsonRpcRequest;
            const result = await mcpServer.handleMessage(msg);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result ?? { jsonrpc: '2.0', id: null, result: null }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: {
                  code: -32_700,
                  message: `Parse error: ${err instanceof Error ? err.message : String(err)}`
                }
              })
            );
          }
          return;
        }

        res.writeHead(404);
        res.end('Not found');
      });

      httpServer = httpInstance;

      await new Promise<void>(resolve => {
        httpInstance.listen(port, () => {
          log('info', `MCP server (HTTP mode) listening on port ${port}`);
          resolve();
        });
      });
    }
  }

  async function close(): Promise<void> {
    if (readlineInterface) {
      readlineInterface.close();
      readlineInterface = null;
    }
    if (httpServer) {
      const toClose = httpServer;
      await new Promise<void>(resolve => {
        toClose.close(() => resolve());
      });
      httpServer = null;
    }
    mcpServer.close();
    log('info', 'MCP server closed');
  }

  return { server: mcpServer, start, close };
}
