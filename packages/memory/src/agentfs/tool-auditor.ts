import type { MemoryDatabase } from '../database/connection.js';
import { toolCalls } from '../database/schema.js';
import type { McpToolHandler } from '../mcp/protocol.js';

export interface ToolAuditorOptions {
  db: MemoryDatabase;
}

/**
 * Wrap an MCP tool handler to record every invocation in the AgentFS
 * `tool_calls` audit table.
 */
export function createToolAuditor(options: ToolAuditorOptions) {
  const { db } = options;

  return function wrapHandler(name: string, handler: McpToolHandler): McpToolHandler {
    return async args => {
      const startedAt = Date.now();
      let result: Awaited<ReturnType<McpToolHandler>> | undefined;
      let error: string | undefined;

      try {
        result = await handler(args);
        return result;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        const completedAt = Date.now();
        db.insert(toolCalls)
          .values({
            name,
            parameters: JSON.stringify(args),
            result: result !== undefined ? JSON.stringify(result) : undefined,
            error,
            startedAt,
            completedAt,
            durationMs: completedAt - startedAt
          })
          .run();
      }
    };
  };
}
