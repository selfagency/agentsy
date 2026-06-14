/**
 * MSW request handlers for MCP (Model Context Protocol) server endpoints.
 *
 * Simulates MCP server health checks, tool listing, and tool call
 * invocations used by @agentsy/mcp and related integration code.
 *
 * @module @agentsy/testing/msw/handlers/mcp
 */

import { type HttpHandler, HttpResponse, http } from 'msw';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpToolDefinition {
  description: string;
  inputSchema?: Record<string, unknown>;
  name: string;
}

export interface MockMcpState {
  healthy: boolean;
  tools: McpToolDefinition[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMockMcpState(): MockMcpState {
  return {
    healthy: true,
    tools: [{ description: 'A test tool', name: 'test-tool' }]
  };
}

// ---------------------------------------------------------------------------
// Handler factories
// ---------------------------------------------------------------------------

export interface McpHandlerOptions {
  /** Base URL for the MCP server (default: http://localhost:3000) */
  baseUrl?: string;
  /** Response delay in ms (default: 0) */
  delay?: number;
  /** Shared mutable state */
  state?: MockMcpState;
}

/**
 * Create MCP server handlers backed by shared mutable state.
 *
 * Supports:
 * - GET  /mcp              → health check
 * - POST /mcp (tools/list) → list available tools
 * - POST /mcp (tools/call) → invoke a tool
 */
export function createMcpHandlers(options?: McpHandlerOptions): HttpHandler[] {
  const baseUrl = options?.baseUrl ?? 'http://localhost:3000';
  const state = options?.state ?? createMockMcpState();
  const delay = options?.delay ?? 0;

  return [
    http.get(`${baseUrl}/mcp`, async () => {
      await sleep(delay);
      if (!state.healthy) {
        return HttpResponse.json({ status: 'error' }, { status: 503 });
      }
      return HttpResponse.json({ status: 'ok' }, { status: 200 });
    }),

    http.post(`${baseUrl}/mcp`, async ({ request }) => {
      await sleep(delay);

      const payload = (await request.json()) as {
        id?: number | string;
        method?: string;
        params?: Record<string, unknown>;
      };
      const method = payload.method ?? '';
      const requestId = payload.id ?? 1;

      if (method === 'tools/list') {
        return handleMcpListRequest(requestId, state);
      }

      if (method === 'tools/call') {
        return handleMcpCallRequest(requestId, payload, state);
      }

      return handleMcpUnknownMethod(requestId, method);
    })
  ];
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve();
}

function handleMcpListRequest(requestId: number | string, state: MockMcpState) {
  return HttpResponse.json({ id: requestId, result: { tools: state.tools }, jsonrpc: '2.0' }, { status: 200 });
}

function handleMcpCallRequest(requestId: number | string, payload: Record<string, unknown>, state: MockMcpState) {
  const toolName = (payload.params as { name?: string } | undefined)?.name ?? 'unknown';
  const tool = state.tools.find(t => t.name === toolName);

  if (!tool) {
    return HttpResponse.json(
      { error: { code: -32_602, message: `Tool not found: ${toolName}` }, id: requestId, jsonrpc: '2.0' },
      { status: 200 }
    );
  }

  return HttpResponse.json(
    { id: requestId, result: { content: [{ text: 'result', type: 'text' }], isError: false }, jsonrpc: '2.0' },
    { status: 200 }
  );
}

function handleMcpUnknownMethod(requestId: number | string, method: string) {
  return HttpResponse.json(
    { error: { code: -32_601, message: `Method not found: ${method}` }, id: requestId, jsonrpc: '2.0' },
    { status: 200 }
  );
}
