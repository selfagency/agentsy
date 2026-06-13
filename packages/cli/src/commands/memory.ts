/**
 * Memory CLI — query, search, list, and inspect memory.
 *
 * ## Usage
 *
 * ```bash
 * agentsy memory search <query>
 * agentsy memory stats
 * agentsy memory lint
 * ```
 */

import type { CliIO } from '../index.js';

/**
 * Run a memory-related subcommand.
 */
export function runMemoryCommand(rest: readonly string[], io: CliIO): number {
  const sub = rest[0];
  const stdout = io.stdout ?? ((m: string) => console.log(m));
  const stderr = io.stderr ?? ((m: string) => console.error(m));

  if (!sub) {
    stderr('Usage: agentsy memory <search|stats|lint> [options]');
    return 1;
  }

  switch (sub) {
    case 'search': {
      const query = rest.slice(1).join(' ');
      if (!query) {
        stderr('Usage: agentsy memory search <query>');
        return 1;
      }
      stdout(`Searching memory for: ${query}`);
      stdout('(Memory search requires an active session with a memory engine)');
      return 0;
    }

    case 'stats': {
      stdout('Memory usage report:');
      stdout('  (Memory stats require an active session with a memory engine)');
      return 0;
    }

    case 'lint': {
      stdout('Memory quality check:');
      stdout('  (Memory lint requires an initialized memory store)');
      return 0;
    }

    default: {
      stderr(`Unknown memory subcommand: ${sub}`);
      stderr('Supported: search, stats, lint');
      return 1;
    }
  }
}
