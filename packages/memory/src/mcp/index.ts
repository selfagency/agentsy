// MCP module — Model Context Protocol server, tools, and daemon
export {
  createMcpServer,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpNotification,
  type McpServer,
  type McpServerOptions,
  type McpToolDefinition,
  type McpToolHandler,
  MCP_PROTOCOL_VERSION
} from './protocol.js';

export { createMemoryMcpTools, type MemoryMcpToolSet } from './tools.js';

export { createMemoryMCPServer, type MemoryMCPServer, type MemoryMCPServerOptions } from './server.js';

export {
  startDaemon,
  stopDaemon,
  isDaemonRunning,
  getDaemonStatus,
  type DaemonConfig,
  type DaemonStatus
} from './daemon.js';
