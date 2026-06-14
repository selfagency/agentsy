/**
 * MCP CLI commands — manage MCP server configurations.
 *
 * ## Usage
 *
 * ```bash
 * agentsy mcp list              # List configured MCP servers
 * agentsy mcp add <uri>         # Register an MCP server
 * agentsy mcp remove <id>       # Remove an MCP server
 * agentsy mcp check             # Health-check all configured servers
 * ```
 *
 * MCP server configurations are stored in the user config file under
 * a top-level `mcpServers` key and are loaded/merged via the layered
 * config system.
 */

import type { CliIO } from '../index.js';

// =============================================================================
// In-memory MCP server registry (placeholder for config-backed storage)
// =============================================================================

interface McpServerEntry {
  addedAt: string;
  id: string;
  name?: string;
  uri: string;
}

const mcpServers: McpServerEntry[] = [];

// =============================================================================
// Handlers
// =============================================================================

export function handleMcpListCommand(_argv: readonly string[], io: CliIO): number {
  const stdout = io.stdout ?? console.log;

  if (mcpServers.length === 0) {
    stdout('No MCP servers configured.');
    stdout('');
    stdout('Use `agentsy mcp add <uri>` to register a server.');
    stdout('Example: agentsy mcp add http://localhost:8080/mcp');
    return 0;
  }

  stdout(`Configured MCP servers (${mcpServers.length}):`);
  stdout('');
  for (const server of mcpServers) {
    stdout(`  ${server.id}`);
    stdout(`    URI:   ${server.uri}`);
    if (server.name) {
      stdout(`    Name:  ${server.name}`);
    }
    stdout(`    Added: ${server.addedAt}`);
    stdout('');
  }
  return 0;
}

export function handleMcpAddCommand(argv: readonly string[], io: CliIO): number {
  const stdout = io.stdout ?? console.log;
  const stderr = io.stderr ?? console.error;

  const uri = argv[0];
  if (!uri) {
    stderr('Usage: agentsy mcp add <uri> [--name <name>]');
    stderr('');
    stderr('Examples:');
    stderr('  agentsy mcp add http://localhost:8080/mcp');
    stderr('  agentsy mcp add http://localhost:8080/mcp --name "local-dev"');
    return 1;
  }

  const nameIndex = argv.indexOf('--name');
  const name = nameIndex >= 0 && nameIndex < argv.length - 1 ? argv[nameIndex + 1] : undefined;
  const id = name ?? `mcp-${mcpServers.length + 1}`;

  const entry: McpServerEntry = { id, uri, addedAt: new Date().toISOString() };
  if (name) {
    entry.name = name;
  }
  mcpServers.push(entry);
  stdout(`Added MCP server: ${id}`);
  stdout(`  URI: ${uri}`);
  stdout('');
  stdout('Note: Server configurations are in-memory. To persist,');
  stdout('add them to your config file under the "mcpServers" key.');
  return 0;
}

export function handleMcpRemoveCommand(argv: readonly string[], io: CliIO): number {
  const stdout = io.stdout ?? console.log;
  const stderr = io.stderr ?? console.error;

  const id = argv[0];
  if (!id) {
    stderr('Usage: agentsy mcp remove <id>');
    stderr('Use `agentsy mcp list` to see configured server IDs.');
    return 1;
  }

  const index = mcpServers.findIndex(s => s.id === id);
  if (index === -1) {
    stderr(`MCP server not found: ${id}`);
    return 1;
  }

  mcpServers.splice(index, 1);
  stdout(`Removed MCP server: ${id}`);
  return 0;
}

export async function handleMcpCheckCommand(_argv: readonly string[], io: CliIO): Promise<number> {
  const stdout = io.stdout ?? console.log;

  if (mcpServers.length === 0) {
    stdout('No MCP servers to check.');
    stdout('Use `agentsy mcp add <uri>` to register a server first.');
    return 0;
  }

  stdout(`Checking ${mcpServers.length} MCP server(s)...`);
  stdout('');

  let allHealthy = true;
  for (const server of mcpServers) {
    try {
      const response = await fetch(server.uri, { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        stdout(`  ✅ ${server.id} — ${server.uri} (${response.status})`);
      } else {
        stdout(`  ❌ ${server.id} — ${server.uri} (HTTP ${response.status})`);
        allHealthy = false;
      }
    } catch {
      stdout(`  ❌ ${server.id} — ${server.uri} (unreachable)`);
      allHealthy = false;
    }
  }

  return allHealthy ? 0 : 1;
}

// =============================================================================
// Router
// =============================================================================

export async function runMcpCommand(argv: readonly string[], io: CliIO): Promise<number> {
  const subcommand = argv[0];
  const rest = argv.slice(1);

  switch (subcommand) {
    case 'list': {
      return handleMcpListCommand(rest, io);
    }
    case 'add': {
      return handleMcpAddCommand(rest, io);
    }
    case 'remove': {
      return handleMcpRemoveCommand(rest, io);
    }
    case 'check': {
      return await handleMcpCheckCommand(rest, io);
    }
    default: {
      const stderr = io.stderr ?? console.error;
      stderr(`Unknown mcp subcommand: ${subcommand ?? '(none)'}`);
      stderr('Supported: list, add, remove, check');
      return 1;
    }
  }
}
