// MCP module — Model Context Protocol server, tools, and daemon

export {
  type DaemonConfig,
  type DaemonStatus,
  getDaemonStatus,
  isDaemonRunning,
  startDaemon,
  stopDaemon
} from './daemon.js';
export {
  createMcpServer,
  type JsonRpcRequest,
  type JsonRpcResponse,
  MCP_PROTOCOL_VERSION,
  type McpNotification,
  type McpServer,
  type McpServerOptions,
  type McpToolDefinition,
  type McpToolHandler
} from './protocol.js';

export {
  createMemoryMCPServer,
  type MemoryMCPServer,
  type MemoryMCPServerOptions
} from './server.js';
export { createMemoryMcpTools, type MemoryMcpToolSet } from './tools.js';
