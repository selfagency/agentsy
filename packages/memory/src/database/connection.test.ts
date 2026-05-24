import { unlinkSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createDatabaseConnection } from './connection.js';
import { runMigrations } from './migrate.js';

describe('createDatabaseConnection', () => {
  it('creates an in-memory database by default', () => {
    const { sqlite, db } = createDatabaseConnection();

    expect(sqlite).toBeDefined();
    expect(db).toBeDefined();

    const result = sqlite.prepare('SELECT 1 as value').get() as { value: number };
    expect(result.value).toBe(1);

    sqlite.close();
  });

  it('creates a database at the specified path', () => {
    const { sqlite } = createDatabaseConnection({ path: ':memory:' });
    expect(sqlite.open).toBe(true);
    sqlite.close();
  });

  it('enables WAL mode by default for file-backed databases', () => {
    const { sqlite } = createDatabaseConnection({ path: '.test-wal.db' });
    const journalMode = sqlite.pragma('journal_mode', { simple: true }) as string;
    expect(journalMode.toLowerCase()).toBe('wal');
    sqlite.close();

    // Clean up
    try {
      unlinkSync('.test-wal.db');
    } catch {
      /* ignore cleanup errors */
    }
  });

  it('uses memory journal mode for in-memory databases', () => {
    const { sqlite } = createDatabaseConnection();
    const journalMode = sqlite.pragma('journal_mode', { simple: true }) as string;
    expect(journalMode.toLowerCase()).toBe('memory');
    sqlite.close();
  });

  it('can disable WAL mode', () => {
    const { sqlite } = createDatabaseConnection({ walMode: false });
    const journalMode = sqlite.pragma('journal_mode', { simple: true }) as string;
    expect(journalMode.toLowerCase()).not.toBe('wal');
    sqlite.close();
  });
});

describe('database with migrations', () => {
  it('exposes all Drizzle schema tables after migration', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    // Verify we can reference every schema table from the Drizzle client
    expect(db.query.memoryItems).toBeDefined();
    expect(db.query.wikiPages).toBeDefined();
    expect(db.query.wikiPageHistory).toBeDefined();
    expect(db.query.wikiVectors).toBeDefined();
    expect(db.query.wikiConcepts).toBeDefined();
    expect(db.query.wikiBacklinks).toBeDefined();
    expect(db.query.ragDocuments).toBeDefined();
    expect(db.query.ragVectors).toBeDefined();
    expect(db.query.syncState).toBeDefined();
    expect(db.query.syncConflicts).toBeDefined();

    sqlite.close();
  });
});
