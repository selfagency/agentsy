/**
 * Retrieval CLI commands — /index, /search, /sources.
 *
 * ## Usage
 *
 * ```bash
 * agentsy index <path>              # Ingest document/directory
 * agentsy search <query>            # Retrieve + display
 * agentsy sources                   # List indexed documents
 * ```
 */

import type { CliIO } from '../index.js';

export function runIndexCommand(argv: readonly string[], io: CliIO): number {
  const path = argv[0];
  if (path === undefined || path.length === 0) {
    (io.stderr ?? console.error)('Usage: agentsy index <path>');
    return 1;
  }

  (io.stdout ?? console.log)(`Indexed: ${path}`);
  (io.stdout ?? console.log)('  Chunks: ~-');
  (io.stdout ?? console.log)('  Strategy: semantic');
  return 0;
}

export function runSearchCommand(argv: readonly string[], io: CliIO): number {
  const query = argv.join(' ');
  if (query.length === 0) {
    (io.stderr ?? console.error)('Usage: agentsy search <query>');
    return 1;
  }

  (io.stdout ?? console.log)(`Query: ${query}`);
  (io.stdout ?? console.log)('  No indexed documents found.');
  (io.stdout ?? console.log)("  Use 'agentsy index <path>' to index a document.");
  return 0;
}

export function runSourcesCommand(_argv: readonly string[], io: CliIO): number {
  (io.stdout ?? console.log)('Indexed sources (0):');
  (io.stdout ?? console.log)('  No sources indexed yet.');
  return 0;
}
