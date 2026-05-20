// Lightweight MCP JSON-RPC 2.0 protocol handler — stdio-based
// Does not depend on @modelcontextprotocol/sdk Zod schemas

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
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

export const MCP_PROTOCOL_VERSION = '2024-11-05';

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

function createErrorResponse(id: string | number | null | undefined, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

export function createMcpServer(options: McpServerOptions): McpServer {
  let initialized = false;
  const { tools } = options;

  async function handleInitialize(id: string | number | null): Promise<JsonRpcResponse> {
    initialized = true;
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {},
          logging: {}
        },
        serverInfo: {
          name: options.name,
          version: options.version
        }
      }
    };
  }

  function handleToolsList(id: string | number | null): JsonRpcResponse {
    const toolList = Object.values(tools).map(t => t.definition);
    return {
      jsonrpc: '2.0',
      id,
      result: { tools: toolList }
    };
  }

  async function handleToolCall(id: string | number | null, params: Record<string, unknown>): Promise<JsonRpcResponse> {
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

  return {
    async handleMessage(msg: JsonRpcRequest): Promise<JsonRpcResponse | McpNotification | undefined> {
      switch (msg.method) {
        case 'initialize':
          return handleInitialize(msg.id ?? null);
        case 'initialized':
          initialized = true;
          return undefined;
        case 'notifications/initialized':
          return undefined;
        case 'tools/list':
          if (!initialized) return createErrorResponse(msg.id, -32001, 'Server not initialized');
          return handleToolsList(msg.id ?? null);
        case 'tools/call':
          if (!initialized) return createErrorResponse(msg.id, -32001, 'Server not initialized');
          return handleToolCall(msg.id ?? null, msg.params ?? {});
        default:
          return createErrorResponse(msg.id, -32601, `Method not found: ${msg.method}`);
      }
    },

    capabilities(): Record<string, unknown> {
      return {
        tools: {},
        logging: {}
      };
    },

    close(): void {
      initialized = false;
    }
  };
}
