import type Database from 'better-sqlite3';

import { runMigrations } from '../database/migrate.js';

export interface AgentFsInitOptions {
  sqlite: Database.Database;
}

export interface AgentFsStatus {
  hasAgentFsTables: boolean;
  rootIno: number | null;
  schemaVersion: number;
}

/**
 * Initialize AgentFS base tables in an open SQLite database.
 * Idempotent: safe to call multiple times.
 */
export function initAgentFs(options: AgentFsInitOptions): AgentFsStatus {
  const { sqlite } = options;

  runMigrations(sqlite);
  const version = sqlite.pragma('user_version', { simple: true }) as number;

  const rootRow = sqlite.prepare('SELECT ino FROM fs_inode WHERE ino = 1').get() as { ino: number } | undefined;

  return {
    schemaVersion: version,
    hasAgentFsTables: version >= 2,
    rootIno: rootRow?.ino ?? null
  };
}

/**
 * Detect whether AgentFS tables are present in the database.
 */
export function detectAgentFs(sqlite: Database.Database): boolean {
  const row = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'fs_inode'`).get() as
    | { name: string }
    | undefined;

  return row !== undefined;
}
