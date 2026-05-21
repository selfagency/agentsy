// CLI: @agentsy/memory init — standalone initialization entrypoint

import { initMemory } from '../init.js';
import type { InitOptions, InitResult } from '../init.js';

export { initMemory, type InitOptions, type InitResult };

/**
 * Run the init CLI with parsed arguments.
 * Returns the InitResult on success, throws on failure.
 */
export async function runInitCli(args: string[] = process.argv.slice(2)): Promise<InitResult> {
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
@agentsy/memory init — Initialize memory engine

Usage: agentsy-memory init [options]

Options:
  --transport <stdio|http>   MCP transport mode (default: stdio)
  --port <number>            HTTP port (default: 4231)
  --skip-mcp                 Skip MCP server creation
  --skip-db                  Skip database initialization
  --force                    Overwrite existing files
  --help, -h                 Show this help message

Environment variables:
  AGENTSY_MEMORY_DB              Database path (default: .agentsy/memory.db)
  AGENTSY_MEMORY_TRANSPORT       Transport mode (default: stdio)
  AGENTSY_MEMORY_PORT            HTTP port (default: 4231)
  AGENTSY_MEMORY_SYNC_URL        Turso sync URL (optional)
  AGENTSY_MEMORY_SYNC_AUTH_TOKEN Turso auth token (optional)
`);
    process.exit(0);
  }

  const options: InitOptions = {};

  for (let i = 0; i < args.length; i++) {
    // nosemgrep: args[i] is from process.argv with loop bounds check
    const arg = args[i];
    switch (arg) {
      case '--transport': {
        options.config = options.config ?? {};
        options.config.mcp = options.config.mcp ?? {};
        // nosemgrep: args[++i] incremented index is verified to be in bounds
        const transportVal = args[++i];
        if (transportVal && typeof transportVal === 'string') {
          options.config.mcp.transport = transportVal as 'stdio' | 'http';
        }
        break;
      }
      case '--port': {
        options.config = options.config ?? {};
        options.config.mcp = options.config.mcp ?? {};
        // nosemgrep: args[++i] incremented index is verified to be in bounds
        const portVal = args[++i];
        if (portVal && typeof portVal === 'string') {
          options.config.mcp.port = Number.parseInt(portVal, 10);
        }
        break;
      }
      case '--skip-mcp':
        options.skipMcp = true;
        break;
      case '--skip-db':
        options.skipDb = true;
        break;
      case '--force':
        options.force = true;
        break;
    }
  }

  return await initMemory(options);
}

/** Main entrypoint for `agentsy-memory init` CLI. */
export async function main(): Promise<void> {
  try {
    const result = await runInitCli();

    const hasServer = 'server' in result && result.server !== undefined;
    console.log('✓ @agentsy/memory initialized');
    console.log(
      `  Engine: ${result.engine.stats().totalItems} items, ${(result.engine.stats().budgetUtilization * 100).toFixed(1)}% budget used`
    );
    console.log(`  Config: db=${result.config.db.path}, transport=${result.config.mcp.transport ?? 'stdio'}`);

    if (hasServer) {
      console.log('  MCP server created. Call server.start() to begin listening.');
    }
  } catch (err) {
    console.error('✗ Failed to initialize @agentsy/memory:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
