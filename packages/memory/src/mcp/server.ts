// MCP stdio server — lightweight JSON-RPC 2.0 transport over stdin/stdout
// No dependency on @modelcontextprotocol/sdk (Zod v4 heavy); uses protocol.ts

import type { MemoryEngine } from '../cognitive/memory-engine.js';
import type { KnowledgeBaseManager } from '../retrieval/rag/knowledge-base.js';
import type { WikiManager } from '../wiki/wiki-manager.js';
import { createMcpServer, type JsonRpcRequest, type McpServer, type McpServerOptions } from './protocol.js';
import { createMemoryMcpTools } from './tools.js';

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB

export interface MemoryMCPServerOptions {
  /** Transport mode. Default: 'stdio' */
  transport?: 'stdio' | 'http';
  /** Port for HTTP mode. Default: 4231 */
  port?: number;
  /** Database path for standalone mode */
  dbPath?: string;
  /** Turso sync URL */
  syncUrl?: string;
  /** Turso auth token */
  syncAuthToken?: string;
  /** Log level. Default: 'info' */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface CreateMemoryMCPServerInput {
  engine: MemoryEngine;
  wiki?: WikiManager;
  kb?: KnowledgeBaseManager;
  options?: MemoryMCPServerOptions;
}

export interface MemoryMCPServer {
  server: McpServer;
  start(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Create a memory MCP server backed by a MemoryEngine instance.
 * In stdio mode, reads JSON-RPC from stdin and writes to stdout.
 * In HTTP mode, starts a simple HTTP server (SSE-based).
 */
export async function createMemoryMCPServer(
  engine: MemoryEngine,
  options?: MemoryMCPServerOptions
): Promise<MemoryMCPServer>;
export async function createMemoryMCPServer(input: CreateMemoryMCPServerInput): Promise<MemoryMCPServer>;
export async function createMemoryMCPServer(
  engineOrInput: MemoryEngine | CreateMemoryMCPServerInput,
  maybeOptions?: MemoryMCPServerOptions
): Promise<MemoryMCPServer> {
  let engine: MemoryEngine;
  let wiki: WikiManager | undefined;
  let kb: KnowledgeBaseManager | undefined;
  let options: MemoryMCPServerOptions;

  if ('engine' in engineOrInput) {
    engine = engineOrInput.engine;
    wiki = engineOrInput.wiki;
    kb = engineOrInput.kb;
    options = engineOrInput.options ?? {};
  } else {
    engine = engineOrInput;
    options = maybeOptions ?? {};
  }

  const { transport = 'stdio', port = 4231, logLevel = 'info' } = options;

  const { definitions, handlers } = createMemoryMcpTools({ engine, wiki, kb });

  const serverOptions: McpServerOptions = {
    name: 'agentsy-memory',
    version: '0.1.0',
    tools: Object.fromEntries(
      Object.entries(definitions).map(([name, def]) => {
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
  // nosemgrep: logLevel is from MemoryConfig type with safe fallback
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
        if (!trimmed) return;

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
              code: -32700,
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

      const httpInstance = http.createServer(async (req, res) => {
        if (req.method === 'GET' && req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', engine: engine.stats() }));
          return;
        }

        if (req.method === 'POST' && req.url === '/message') {
          const chunks: Buffer[] = [];
          let totalSize = 0;
          for await (const chunk of req) {
            totalSize += (chunk as Buffer).length;
            if (totalSize > MAX_BODY_SIZE) {
              res.writeHead(413, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: null,
                  error: {
                    code: -32700,
                    message: 'Request body exceeds maximum size of 10 MB'
                  }
                })
              );
              return;
            }
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
                  code: -32700,
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
