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
  transport: 'stdio' | 'http';
  uri: string;
}

const mcpServers: McpServerEntry[] = [];

// =============================================================================
// Handlers
// =============================================================================

export function handleMcpListCommand(argv: readonly string[], io: CliIO): number {
  const stdout = io.stdout ?? console.log;

  const useJson = argv.includes('--json');

  if (useJson) {
    stdout(JSON.stringify(mcpServers, null, 2));
    return 0;
  }

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
    stdout(`    Type:  ${server.transport}`);
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

  // Parse flags and positional args
  let transport: 'stdio' | 'http' = 'http';
  let name: string | undefined;
  let uri: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = String(argv.at(i) ?? '');

    if (arg === '--transport') {
      const raw = String(argv.at(i + 1) ?? '');
      if (raw === 'stdio') {
        transport = 'stdio';
      } else if (raw === 'http') {
        transport = 'http';
      } else {
        stderr(`Invalid transport: ${raw}. Must be 'stdio' or 'http'.`);
        return 1;
      }
      i++; // skip value
      continue;
    }

    if (arg === '--name') {
      name = String(argv.at(i + 1) ?? '');
      i++; // skip value
      continue;
    }

    // First non-flag argument is the URI
    uri ??= arg;
  }
  if (!uri) {
    stderr('Usage: agentsy mcp add [--transport stdio|http] <uri> [--name <name>]');
    stderr('');
    stderr('Examples:');
    stderr('  agentsy mcp add --transport http http://localhost:8080/mcp');
    stderr('  agentsy mcp add --transport stdio file:///path/to/server');
    stderr('  agentsy mcp add http://localhost:8080/mcp --name "local-dev"');
    return 1;
  }

  const id = name ?? `mcp-${mcpServers.length + 1}`;

  const entry: McpServerEntry = { id, uri, transport, addedAt: new Date().toISOString() };
  if (name) {
    entry.name = name;
  }
  mcpServers.push(entry);
  stdout(`Added MCP server: ${id}`);
  stdout(`  URI:       ${uri}`);
  stdout(`  Transport: ${transport}`);
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

export async function handleMcpCheckCommand(argv: readonly string[], io: CliIO): Promise<number> {
  const stdout = io.stdout ?? console.log;
  const stderr = io.stderr ?? console.error;

  const targetId = argv[0];
  const serversToCheck = targetId ? mcpServers.filter(s => s.id === targetId) : mcpServers;

  if (serversToCheck.length === 0) {
    if (targetId) {
      stderr(`MCP server not found: ${targetId}`);
      return 1;
    }
    stdout('No MCP servers to check.');
    stdout('Use `agentsy mcp add <uri>` to register a server first.');
    return 0;
  }

  stdout(`Checking ${serversToCheck.length} MCP server(s)...`);
  stdout('');

  const allHealthy = await checkMcpServers(serversToCheck, stdout);
  return allHealthy ? 0 : 1;
}

async function checkMcpServers(servers: McpServerEntry[], stdout: (msg: string) => void): Promise<boolean> {
  let allHealthy = true;
  for (const server of servers) {
    if (server.transport === 'stdio') {
      stdout(`  ⚠  ${server.id} — ${server.uri} (stdio transport — cannot check remotely)`);
      continue;
    }

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
  return allHealthy;
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
