import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema.js';

export type MemoryDatabase = BetterSQLite3Database<typeof schema>;

export interface ConnectionOptions {
  /** SQLite database file path. Defaults to ':memory:' for testing. */
  path?: string;
  /** Enable WAL mode for better concurrent read performance. Defaults to true. */
  walMode?: boolean;
}

/**
 * Create a SQLite database connection backed by better-sqlite3 and wrapped
 * with Drizzle ORM for type-safe querying.
 */
export function createDatabaseConnection(options: ConnectionOptions = {}): {
  sqlite: Database.Database;
  db: MemoryDatabase;
} {
  const path = options.path ?? ':memory:';
  const walMode = options.walMode ?? true;

  const sqlite = new Database(path);

  if (walMode) {
    sqlite.pragma('journal_mode = WAL');
  }

  const db = drizzle(sqlite, { schema });

  return { sqlite, db };
}
