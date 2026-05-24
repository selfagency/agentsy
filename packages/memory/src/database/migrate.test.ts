import { describe, expect, it } from 'vitest';

import { createDatabaseConnection } from './connection.js';
import { getCurrentVersion, runMigrations } from './migrate.js';

describe('runMigrations', () => {
  it('applies all migrations on first run', () => {
    const { sqlite } = createDatabaseConnection();
    const applied = runMigrations(sqlite);
    expect(applied).toBeGreaterThan(0);
    expect(getCurrentVersion(sqlite)).toBeGreaterThan(0);

    // Verify core tables exist
    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%'"
      )
      .all() as Array<{ name: string }>;

    const tableNames = tables.map(t => t.name).sort();

    expect(tableNames).toContain('memory_items');
    expect(tableNames).toContain('wiki_pages');
    expect(tableNames).toContain('wiki_page_history');
    expect(tableNames).toContain('wiki_vectors');
    expect(tableNames).toContain('wiki_concepts');
    expect(tableNames).toContain('wiki_backlinks');
    expect(tableNames).toContain('rag_documents');
    expect(tableNames).toContain('rag_vectors');
    expect(tableNames).toContain('sync_state');
    expect(tableNames).toContain('sync_conflicts');

    sqlite.close();
  });

  it('is idempotent — second run applies zero new migrations', () => {
    const { sqlite } = createDatabaseConnection();
    runMigrations(sqlite);
    const version = getCurrentVersion(sqlite);

    const appliedAgain = runMigrations(sqlite);
    expect(appliedAgain).toBe(0);
    expect(getCurrentVersion(sqlite)).toBe(version);

    sqlite.close();
  });

  it('creates FTS5 virtual tables', () => {
    const { sqlite } = createDatabaseConnection();
    runMigrations(sqlite);

    const vtables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND sql LIKE '%VIRTUAL%'")
      .all() as Array<{ name: string }>;

    const names = vtables.map(v => v.name);
    expect(names).toContain('wiki_pages_fts');
    expect(names).toContain('rag_documents_fts');

    sqlite.close();
  });

  it('creates expected indexes', () => {
    const { sqlite } = createDatabaseConnection();
    runMigrations(sqlite);

    const indexes = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{
      name: string;
    }>;

    const names = indexes.map(i => i.name);

    expect(names).toContain('idx_memory_items_tier');
    expect(names).toContain('idx_memory_items_importance');
    expect(names).toContain('idx_memory_items_kind');
    expect(names).toContain('idx_memory_items_created');
    expect(names).toContain('idx_memory_items_fingerprint');
    expect(names).toContain('idx_wiki_page_history_page_id');
    expect(names).toContain('idx_rag_documents_source_id');

    sqlite.close();
  });
});
