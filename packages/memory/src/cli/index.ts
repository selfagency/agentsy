// CLI barrel — programmatic access to CLI functions
// oclif discovers commands from src/commands/ directory, not from this file.
export { main as runInitMain, runInitCli } from './init-cli.js';
export { main as runMcpServerMain, runMcpServerCli } from './mcp-server-cli.js';
