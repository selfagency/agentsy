/**
 * MCP add command argument parser.
 *
 * Parses flags (--transport, --name) and positional args from the CLI argv.
 * Extracted from mcp.ts to reduce file-level cyclomatic complexity.
 */

export interface ParsedMcpAddArgs {
  name: string | undefined;
  transport: 'stdio' | 'http';
  uri: string;
}

interface TransportParseResult {
  nextIndex: number;
  transport: 'stdio' | 'http';
}

/**
 * Parse argv for `agentsy mcp add` command.
 * Returns null with error messages written to stderr on failure.
 */
export function parseMcpAddArgs(argv: readonly string[], stderr: (msg: string) => void): ParsedMcpAddArgs | null {
  let transport: 'stdio' | 'http' = 'http';
  let name: string | undefined;
  let uri: string | undefined;

  let i = 0;
  while (i < argv.length) {
    const arg = String(argv.at(i) ?? '');

    if (arg === '--transport') {
      const result = parseTransportFlag(argv, i, stderr);
      if (result === null) {
        return null;
      }
      transport = result.transport;
      i = result.nextIndex;
      continue;
    }

    if (arg === '--name') {
      name = String(argv.at(i + 1) ?? '');
      i += 2;
      continue;
    }

    uri ??= arg;
    i++;
  }

  if (!uri) {
    stderr('Usage: agentsy mcp add [--transport stdio|http] <uri> [--name <name>]');
    stderr('');
    stderr('Examples:');
    stderr('  agentsy mcp add --transport http http://localhost:8080/mcp');
    stderr('  agentsy mcp add --transport stdio file:///path/to/server');
    stderr('  agentsy mcp add http://localhost:8080/mcp --name "local-dev"');
    return null;
  }

  return { uri, transport, name };
}

function parseTransportFlag(
  argv: readonly string[],
  i: number,
  stderr: (msg: string) => void
): TransportParseResult | null {
  const raw = String(argv.at(i + 1) ?? '');
  if (raw === 'stdio') {
    return { transport: 'stdio', nextIndex: i + 1 };
  }
  if (raw === 'http') {
    return { transport: 'http', nextIndex: i + 1 };
  }
  stderr(`Invalid transport: ${raw}. Must be 'stdio' or 'http'.`);
  return null;
}
