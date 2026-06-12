import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { resolveCortexKitDbPath, ensureCortexKitDbDir } from './db-path.js';

export type CortexKitDb = DatabaseType;

const MAX_BUSY_RETRIES = 5;
const BUSY_RETRY_MS = 50;

/**
 * Open a read-write connection to Magic Context's SQLite database.
 *
 * The database is created at XDG_DATA_HOME/cortexkit/magic-context/context.db
 * if it doesn't exist. WAL mode is enabled for concurrent access.
 *
 * @param retries - Number of busy-retries before throwing (default 5)
 */
export function openCortexKitDb(retries = MAX_BUSY_RETRIES): CortexKitDb {
  ensureCortexKitDbDir();
  const dbPath = resolveCortexKitDbPath();

  const db = new Database(dbPath, {
    // WAL mode allows concurrent readers while the dreamer/historian writes
    nativeBinding: undefined
  });

  // Enable WAL mode for concurrent access
  db.pragma('journal_mode = WAL');

  // Busy timeout
  db.pragma(`busy_timeout = ${BUSY_RETRY_MS * retries}`);

  return db;
}

/**
 * Open a read-only connection to Magic Context's database.
 * Returns null if the database doesn't exist yet.
 */
export function openCortexKitDbReadOnly(): CortexKitDb | null {
  const dbPath = resolveCortexKitDbPath();

  try {
    const db = new Database(dbPath, { readonly: true });
    db.pragma('journal_mode = WAL');
    return db;
  } catch {
    return null;
  }
}

/**
 * Execute a query with retry on SQLITE_BUSY.
 */
export function withRetry<T>(_db: CortexKitDb, fn: () => T, retries = MAX_BUSY_RETRIES): T {
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      return fn();
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'SQLITE_BUSY') {
        lastError = error;
        // Backoff
        const delay = BUSY_RETRY_MS * Math.pow(2, i);
        // Synchronous wait — better-sqlite3 is sync, so keep it simple
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error('Max retries exceeded');
}
