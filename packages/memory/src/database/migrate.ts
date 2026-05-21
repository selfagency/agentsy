import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
-- Cognitive tier storage
CREATE TABLE IF NOT EXISTS memory_items (
  id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('sensory_buffer','sensory_register','working_memory','short_term_memory','long_term_memory')),
  kind TEXT NOT NULL CHECK(kind IN ('semantic','episodic','procedural','sensory')),
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  importance REAL NOT NULL,
  write_heap TEXT NOT NULL CHECK(write_heap IN ('event','query','doc','ref')),
  reuse_class TEXT NOT NULL CHECK(reuse_class IN ('hot','warm','cold')),
  created_at INTEGER NOT NULL,
  last_accessed_at INTEGER NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  fingerprint TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, tier)
);

CREATE INDEX IF NOT EXISTS idx_memory_items_tier ON memory_items(tier);
CREATE INDEX IF NOT EXISTS idx_memory_items_importance ON memory_items(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memory_items_kind ON memory_items(kind);
CREATE INDEX IF NOT EXISTS idx_memory_items_created ON memory_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_items_fingerprint ON memory_items(fingerprint);

-- Wiki storage
CREATE TABLE IF NOT EXISTS wiki_pages (
  page_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  format TEXT NOT NULL CHECK(format IN ('markdown','text','code','json')),
  writer_ids TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS wiki_pages_fts USING fts5(page_id, title, body);

-- Wiki page history
CREATE TABLE IF NOT EXISTS wiki_page_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT NOT NULL REFERENCES wiki_pages(page_id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  edited_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wiki_page_history_page_id ON wiki_page_history(page_id);

-- Wiki vectors
CREATE TABLE IF NOT EXISTS wiki_vectors (
  page_id TEXT PRIMARY KEY REFERENCES wiki_pages(page_id) ON DELETE CASCADE,
  embedding TEXT NOT NULL
);

-- Wiki concepts
CREATE TABLE IF NOT EXISTS wiki_concepts (
  from_page_id TEXT NOT NULL REFERENCES wiki_pages(page_id) ON DELETE CASCADE,
  to_page_id TEXT NOT NULL REFERENCES wiki_pages(page_id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  PRIMARY KEY (from_page_id, to_page_id, relation)
);

-- Wiki backlinks
CREATE TABLE IF NOT EXISTS wiki_backlinks (
  from_page_id TEXT NOT NULL REFERENCES wiki_pages(page_id) ON DELETE CASCADE,
  to_page_id TEXT NOT NULL REFERENCES wiki_pages(page_id) ON DELETE CASCADE,
  PRIMARY KEY (from_page_id, to_page_id)
);

-- RAG documents
CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('wiki','file','document','web')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  fingerprint TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_rag_documents_source_id ON rag_documents(source_id);

CREATE VIRTUAL TABLE IF NOT EXISTS rag_documents_fts USING fts5(id, title, content);

-- RAG vectors
CREATE TABLE IF NOT EXISTS rag_vectors (
  doc_id TEXT PRIMARY KEY REFERENCES rag_documents(id) ON DELETE CASCADE,
  embedding TEXT NOT NULL
);

-- Sync state
CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Sync conflicts
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_key TEXT NOT NULL,
  local_record TEXT NOT NULL,
  remote_record TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`
  }
];

/**
 * Run pending migrations against an open better-sqlite3 database.
 * Tracks schema version via SQLite's built-in `user_version` pragma.
 * Migrations are idempotent (use IF NOT EXISTS) and safe to re-run.
 */
export function runMigrations(sqlite: Database.Database): number {
  const userVersion = sqlite.pragma('user_version', { simple: true }) as number;
  let applied = 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > userVersion) {
      sqlite.exec(migration.sql);
      sqlite.pragma(`user_version = ${migration.version}`);
      applied++;
    }
  }

  return applied;
}

export function getCurrentVersion(sqlite: Database.Database): number {
  return sqlite.pragma('user_version', { simple: true }) as number;
}
