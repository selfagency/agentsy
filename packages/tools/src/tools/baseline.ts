import type { ToolRegistry } from '../registry.js';
import { createFsTools } from './fs/index.js';
import { createHttpTool } from './http/index.js';
import { createMcpBridgeTool } from './mcp/index.js';
import { createReplTool } from './repl/index.js';
import { createShellTool } from './shell/index.js';

/**
 * Register all baseline tools into a ToolRegistry.
 */
export function registerBaselineTools(registry: ToolRegistry): void {
  registry.register(createReplTool());

  for (const fsTool of createFsTools()) {
    registry.register(fsTool);
  }

  registry.register(createShellTool());
  registry.register(createHttpTool());
  registry.register(createMcpBridgeTool());
}
