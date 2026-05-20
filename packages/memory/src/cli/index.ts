// CLI barrel — programmatic access to CLI functions
// oclif discovers commands from src/commands/ directory, not from this file.
export { runInitCli, main as runInitMain } from './init-cli.js';
export { runMcpServerCli, main as runMcpServerMain } from './mcp-server-cli.js';
