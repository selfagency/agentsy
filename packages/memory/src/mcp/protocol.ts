// Lightweight MCP JSON-RPC 2.0 protocol handler — stdio-based
// Does not depend on @modelcontextprotocol/sdk Zod schemas

export type JsonRpcId = string | number | null | undefined;

export interface JsonRpcRequest {
  id?: JsonRpcId;
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id?: JsonRpcId;
  jsonrpc: '2.0';
  result?: unknown;
}

export interface McpNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export const MCP_PROTOCOL_VERSION = '2024-11-05';

export interface McpToolDefinition {
  description: string;
  inputSchema: Record<string, unknown>;
  name: string;
}

export type McpToolHandler = (
  args: Record<string, unknown>
) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;

export interface McpServerOptions {
  name: string;
  tools: Record<string, { definition: McpToolDefinition; handler: McpToolHandler }>;
  version: string;
}

export interface McpServer {
  capabilities(): Record<string, unknown>;
  close(): void;
  handleMessage(msg: JsonRpcRequest): Promise<JsonRpcResponse | McpNotification | undefined>;
}

function createErrorResponse(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

export function createMcpServer(options: McpServerOptions): McpServer {
  let initialized = false;
  const { tools } = options;

  function handleInitialize(id: Exclude<JsonRpcId, undefined>): JsonRpcResponse {
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

  function handleToolsList(id: Exclude<JsonRpcId, undefined>): JsonRpcResponse {
    const toolList = Object.values(tools).map(t => t.definition);
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
      return createErrorResponse(id, -32_602, 'Invalid params: missing tool name');
    }

    const tool = tools[name];
    if (!tool) {
      return createErrorResponse(id, -32_601, `Tool not found: ${name}`);
    }

    const args = (params.arguments ?? {}) as Record<string, unknown>;

    try {
      const result = await tool.handler(args);
      return { jsonrpc: '2.0', id, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return createErrorResponse(id, -32_603, message);
    }
  }

  function requireInitialized(id: Exclude<JsonRpcId, undefined>): JsonRpcResponse | undefined {
    if (!initialized) {
      return createErrorResponse(id, -32_001, 'Server not initialized');
    }
  }

  return {
    handleMessage(msg: JsonRpcRequest): Promise<JsonRpcResponse | McpNotification | undefined> {
      const id = msg.id ?? null;
      switch (msg.method) {
        case 'initialize':
          return Promise.resolve(handleInitialize(id));
        case 'initialized':
          initialized = true;
          return Promise.resolve(undefined);
        case 'notifications/initialized':
          return Promise.resolve(undefined);
        case 'tools/list': {
          const initErr = requireInitialized(id);
          if (initErr) {
            return Promise.resolve(initErr);
          }
          return Promise.resolve(handleToolsList(id));
        }
        case 'tools/call': {
          const initErr = requireInitialized(id);
          if (initErr) {
            return Promise.resolve(initErr);
          }
          return handleToolCall(id, msg.params ?? {});
        }
        default:
          return Promise.resolve(createErrorResponse(id, -32_601, `Method not found: ${msg.method}`));
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
