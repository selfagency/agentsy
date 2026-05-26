import type Database from 'better-sqlite3';

export interface SnapshotOptions {
  destinationPath: string;
  sqlite: Database.Database;
}

export interface RestoreOptions {
  sourcePath: string;
  sqlite: Database.Database;
}

export interface AgentFsSnapshotResult {
  destinationPath: string;
  pageCount: number;
}

export interface AgentFsRestoreResult {
  pageCount: number;
  sourcePath: string;
}

/**
 * Create a point-in-time snapshot of the SQLite database using `VACUUM INTO`.
 * This produces a compact, consistent copy of the database at the given path.
 */
export function createSnapshot(options: SnapshotOptions): AgentFsSnapshotResult {
  const { sqlite, destinationPath } = options;

  // VACUUM INTO creates a clean, defragmented copy at the destination
  sqlite.exec(`VACUUM INTO '${destinationPath.replaceAll("'", "''")}'`);

  // Count pages in the resulting database
  const pageRow = sqlite.prepare('SELECT page_count FROM pragma_page_count()').get() as
    | { page_count: number }
    | undefined;

  return {
    destinationPath,
    pageCount: pageRow?.page_count ?? 0
  };
}

/**
 * Restore the SQLite database from a snapshot file using `VACUUM INTO`.
 * The current database is replaced by the contents of the source snapshot.
 *
 * WARNING: This overwrites the current database. Use with care.
 */
export function restoreSnapshot(options: RestoreOptions): AgentFsRestoreResult {
  const { sqlite, sourcePath } = options;

  // Attach the source database, then replace the current main with it
  sqlite.exec(`ATTACH '${sourcePath.replaceAll("'", "''")}' AS restore_source`);

  try {
    // Get list of tables in the source (excluding sqlite internal tables and virtual tables)
    const tables = sqlite
      .prepare(
        "SELECT name FROM restore_source.sqlite_master WHERE type = 'table' AND sql IS NOT NULL AND sql NOT LIKE 'CREATE VIRTUAL%%' AND name NOT LIKE 'sqlite_%'"
      )
      .all() as Array<{
      name: string;
    }>;

    // For each table, drop the local one and recreate from source
    for (const { name } of tables) {
      try {
        sqlite.exec(`DROP TABLE IF EXISTS main.${name}`);
        sqlite.exec(`CREATE TABLE main.${name} AS SELECT * FROM restore_source.${name}`);
      } catch {
        // Skip tables that cannot be dropped/recreated (e.g. FTS5 shadow tables)
      }
    }

    const pageRow = sqlite.prepare('SELECT page_count FROM pragma_page_count()').get() as
      | { page_count: number }
      | undefined;

    return {
      sourcePath,
      pageCount: pageRow?.page_count ?? 0
    };
  } finally {
    sqlite.exec('DETACH restore_source');
  }
}
