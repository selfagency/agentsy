import type { ToolDefinition } from '../../definitions.js';

export function createMcpBridgeTool(): ToolDefinition {
  return {
    name: 'mcp_call',
    description: 'Call an external MCP tool via a registered MCP server bridge.',
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      requiresApproval: true
    },
    parameters: [
      { name: 'server', type: 'string', required: true, description: 'MCP server name' },
      { name: 'tool', type: 'string', required: true, description: 'Tool name on that server' },
      { name: 'args', type: 'object', required: false, description: 'Arguments to pass to the tool' }
    ],
    handler: input => {
      const server = typeof input.server === 'string' ? input.server : '';
      const tool = typeof input.tool === 'string' ? input.tool : '';
      if (!(server && tool)) {
        return { ok: false, data: null, error: 'Missing required parameters: server and tool' };
      }
      return { ok: true, data: { result: `[mcp_call placeholder] ${server}/${tool}` } };
    }
  };
}
