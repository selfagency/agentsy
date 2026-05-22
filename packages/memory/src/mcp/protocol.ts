// Lightweight MCP JSON-RPC 2.0 protocol handler — stdio-based
// Aligned with MCP specification 2025-11-25
// Does not depend on @modelcontextprotocol/sdk Zod schemas

export type JsonRpcId = string | number | null | undefined;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type McpNotification = {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
};

export const MCP_PROTOCOL_VERSION = '2025-11-25';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type McpToolHandler = (
  args: Record<string, unknown>
) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;

export interface McpServerOptions {
  name: string;
  version: string;
  tools: Record<string, { definition: McpToolDefinition; handler: McpToolHandler }>;
}

export interface McpServer {
  handleMessage(msg: JsonRpcRequest): Promise<JsonRpcResponse | McpNotification | undefined>;
  capabilities(): Record<string, unknown>;
  close(): void;
}

function createErrorResponse(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

export function createMcpServer(options: McpServerOptions): McpServer {
  let initialized = false;
  const { tools } = options;

  async function handleInitialize(id: Exclude<JsonRpcId, undefined>): Promise<JsonRpcResponse> {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false }
        },
        serverInfo: {
          name: options.name,
          version: options.version
        }
      }
    };
  }

  function handlePing(id: Exclude<JsonRpcId, undefined>): JsonRpcResponse {
    return { jsonrpc: '2.0', id, result: {} };
  }

  function handleToolsList(id: Exclude<JsonRpcId, undefined>, params: Record<string, unknown>): JsonRpcResponse {
    const toolList = Object.values(tools).map(t => t.definition);
    // Pagination: if cursor provided, return empty to signal end of list
    const cursor = typeof params.cursor === 'string' ? params.cursor : undefined;
    if (cursor) {
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: [], nextCursor: undefined }
      };
    }
    return {
      jsonrpc: '2.0',
      id,
      result: { tools: toolList }
    };
  }

  async function handleToolCall(
    id: Exclude<JsonRpcId, undefined>,
    params: Record<string, unknown>
  ): Promise<JsonRpcResponse> {
    const name = params.name as string | undefined;
    if (!name || typeof name !== 'string') {
      return createErrorResponse(id, -32602, 'Invalid params: missing tool name');
    }

    const tool = tools[name];
    if (!tool) {
      return createErrorResponse(id, -32601, `Tool not found: ${name}`);
    }

    const args = (params.arguments ?? {}) as Record<string, unknown>;

    try {
      const result = await tool.handler(args);
      return { jsonrpc: '2.0', id, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return createErrorResponse(id, -32603, message);
    }
  }

  function requireInitialized(id: Exclude<JsonRpcId, undefined>): JsonRpcResponse | undefined {
    if (!initialized) return createErrorResponse(id, -32001, 'Server not initialized');
    return undefined;
  }

  return {
    async handleMessage(msg: JsonRpcRequest): Promise<JsonRpcResponse | McpNotification | undefined> {
      const id = msg.id ?? null;
      switch (msg.method) {
        case 'initialize':
          return handleInitialize(id);
        case 'initialized':
        case 'notifications/initialized':
          initialized = true;
          return undefined;
        case 'ping': {
          const initErr = requireInitialized(id);
          if (initErr) return initErr;
          return handlePing(id);
        }
        case 'tools/list': {
          const initErr = requireInitialized(id);
          if (initErr) return initErr;
          return handleToolsList(id, msg.params ?? {});
        }
        case 'tools/call': {
          const initErr = requireInitialized(id);
          if (initErr) return initErr;
          return handleToolCall(id, msg.params ?? {});
        }
        default:
          return createErrorResponse(id, -32601, `Method not found: ${msg.method}`);
      }
    },

    capabilities(): Record<string, unknown> {
      return {
        tools: { listChanged: false }
      };
    },

    close(): void {
      initialized = false;
    }
  };
}
