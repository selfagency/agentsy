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
  const stdout = io.stdout ?? console.log;
  const stderr = io.stderr ?? console.error;
  const path = argv[0];
  if (path === undefined || path.length === 0) {
    stderr('Usage: agentsy index <path>');
    return 1;
  }

  stdout('⚠ Indexing is a preview feature. No documents were actually indexed.');
  stdout(`  Path: ${path}`);
  stdout('  To enable real indexing, wire @agentsy/memory KnowledgeBaseManager into this command.');
  return 0;
}

export function runSearchCommand(argv: readonly string[], io: CliIO): number {
  const stdout = io.stdout ?? console.log;
  const stderr = io.stderr ?? console.error;
  const query = argv.join(' ');
  if (query.length === 0) {
    stderr('Usage: agentsy search <query>');
    return 1;
  }

  stdout('⚠ Search is a preview feature. No indexed documents to search.');
  stdout(`  Query: ${query}`);
  stdout("  Use 'agentsy index <path>' to index a document.");
  return 0;
}

export function runSourcesCommand(_argv: readonly string[], io: CliIO): number {
  const stdout = io.stdout ?? console.log;
  stdout('⚠ Sources is a preview feature. No index engine connected.');
  stdout('Indexed sources (0):');
  stdout('  No sources indexed yet.');
  return 0;
}
