import { loadConfig } from '../config.js';
import type { MemoryDiagnosticCheck } from './types.js';

export function runMemoryMcpDiagnostics(): MemoryDiagnosticCheck[] {
  const config = loadConfig();
  return [
    {
      id: 'mcp-transport',
      level: 'info',
      message: `MCP transport is configured as ${config.mcp.transport}.`
    },
    {
      id: 'mcp-port',
      level: config.mcp.transport === 'http' && !config.mcp.port ? 'error' : 'info',
      message:
        config.mcp.transport === 'http'
          ? `MCP HTTP port is ${config.mcp.port}.`
          : 'MCP stdio transport does not require a port.'
    }
  ];
}
