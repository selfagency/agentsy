import { blob, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Cognitive tier storage
// ---------------------------------------------------------------------------

export const memoryItems = sqliteTable(
  'memory_items',
  {
    id: text('id').notNull(),
    tier: text('tier').notNull(),
    kind: text('kind').notNull(),
    content: text('content').notNull(),
    tokenCount: integer('token_count').notNull(),
    importance: real('importance').notNull(),
    writeHeap: text('write_heap').notNull(),
    reuseClass: text('reuse_class').notNull(),
    createdAt: integer('created_at').notNull(),
    lastAccessedAt: integer('last_accessed_at').notNull(),
    accessCount: integer('access_count').notNull().default(0),
    fingerprint: text('fingerprint').notNull(),
    metadata: text('metadata').notNull().default('{}')
  },
  table => [
    primaryKey({ columns: [table.id, table.tier] }),
    index('idx_memory_items_tier').on(table.tier),
    index('idx_memory_items_importance').on(table.importance),
    index('idx_memory_items_kind').on(table.kind),
    index('idx_memory_items_created').on(table.createdAt),
    index('idx_memory_items_fingerprint').on(table.fingerprint)
  ]
);

// ---------------------------------------------------------------------------
// Wiki storage
// ---------------------------------------------------------------------------

export const wikiPages = sqliteTable('wiki_pages', {
  pageId: text('page_id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  tags: text('tags').notNull().default('[]'),
  format: text('format').notNull(),
  writerIds: text('writer_ids').notNull().default('[]'),
  version: integer('version').notNull().default(1),
  updatedAt: integer('updated_at').notNull()
});

export const wikiPageHistory = sqliteTable('wiki_page_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pageId: text('page_id')
    .notNull()
    .references(() => wikiPages.pageId, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  body: text('body').notNull(),
  actorId: text('actor_id').notNull(),
  editedAt: integer('edited_at').notNull()
});

export const wikiVectors = sqliteTable('wiki_vectors', {
  pageId: text('page_id')
    .primaryKey()
    .references(() => wikiPages.pageId, { onDelete: 'cascade' }),
  embedding: text('embedding').notNull()
});

export const wikiConcepts = sqliteTable(
  'wiki_concepts',
  {
    fromPageId: text('from_page_id')
      .notNull()
      .references(() => wikiPages.pageId, { onDelete: 'cascade' }),
    toPageId: text('to_page_id')
      .notNull()
      .references(() => wikiPages.pageId, { onDelete: 'cascade' }),
    relation: text('relation').notNull()
  },
  table => [primaryKey({ columns: [table.fromPageId, table.toPageId, table.relation] })]
);

export const wikiBacklinks = sqliteTable(
  'wiki_backlinks',
  {
    fromPageId: text('from_page_id')
      .notNull()
      .references(() => wikiPages.pageId, { onDelete: 'cascade' }),
    toPageId: text('to_page_id')
      .notNull()
      .references(() => wikiPages.pageId, { onDelete: 'cascade' })
  },
  table => [primaryKey({ columns: [table.fromPageId, table.toPageId] })]
);

// ---------------------------------------------------------------------------
// RAG chunked documents
// ---------------------------------------------------------------------------

export const ragDocuments = sqliteTable(
  'rag_documents',
  {
    id: text('id').primaryKey(),
    sourceId: text('source_id').notNull(),
    sourceType: text('source_type').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    updatedAt: integer('updated_at').notNull(),
    metadata: text('metadata').notNull().default('{}'),
    fingerprint: text('fingerprint').notNull().default(''),
    version: integer('version').notNull().default(1)
  },
  table => [index('idx_rag_documents_source_id').on(table.sourceId)]
);

export const ragVectors = sqliteTable('rag_vectors', {
  docId: text('doc_id')
    .primaryKey()
    .references(() => ragDocuments.id, { onDelete: 'cascade' }),
  embedding: text('embedding').notNull()
});

// ---------------------------------------------------------------------------
// Sync state and conflicts
// ---------------------------------------------------------------------------

export const syncState = sqliteTable('sync_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
});

export const syncConflicts = sqliteTable('sync_conflicts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  recordKey: text('record_key').notNull(),
  localRecord: text('local_record').notNull(),
  remoteRecord: text('remote_record').notNull(),
  createdAt: integer('created_at').notNull()
});

// ---------------------------------------------------------------------------
// AgentFS base tables (Phase 8)
// ---------------------------------------------------------------------------

export const fsConfig = sqliteTable('fs_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
});

export const fsInode = sqliteTable('fs_inode', {
  ino: integer('ino').primaryKey({ autoIncrement: true }),
  mode: integer('mode').notNull(),
  nlink: integer('nlink').notNull().default(0),
  uid: integer('uid').notNull().default(0),
  gid: integer('gid').notNull().default(0),
  size: integer('size').notNull().default(0),
  atime: integer('atime').notNull(),
  mtime: integer('mtime').notNull(),
  ctime: integer('ctime').notNull(),
  rdev: integer('rdev').notNull().default(0),
  atimeNsec: integer('atime_nsec').notNull().default(0),
  mtimeNsec: integer('mtime_nsec').notNull().default(0),
  ctimeNsec: integer('ctime_nsec').notNull().default(0)
});

export const fsDentry = sqliteTable(
  'fs_dentry',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    parentIno: integer('parent_ino').notNull(),
    ino: integer('ino').notNull()
  },
  table => [uniqueIndex('idx_fs_dentry_parent').on(table.parentIno, table.name)]
);

export const fsData = sqliteTable(
  'fs_data',
  {
    ino: integer('ino').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    data: blob('data').notNull()
  },
  table => [primaryKey({ columns: [table.ino, table.chunkIndex] })]
);

export const fsSymlink = sqliteTable('fs_symlink', {
  ino: integer('ino').primaryKey(),
  target: text('target').notNull()
});

export const kvStore = sqliteTable(
  'kv_store',
  {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at')
  },
  table => [index('idx_kv_store_created_at').on(table.createdAt)]
);

export const fsWhiteout = sqliteTable(
  'fs_whiteout',
  {
    path: text('path').primaryKey(),
    parentPath: text('parent_path').notNull(),
    createdAt: integer('created_at').notNull()
  },
  table => [index('idx_fs_whiteout_parent').on(table.parentPath)]
);

export const fsOrigin = sqliteTable('fs_origin', {
  deltaIno: integer('delta_ino').primaryKey(),
  baseIno: integer('base_ino').notNull()
});

export const toolCalls = sqliteTable(
  'tool_calls',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    parameters: text('parameters'),
    result: text('result'),
    error: text('error'),
    startedAt: integer('started_at').notNull(),
    completedAt: integer('completed_at').notNull(),
    durationMs: integer('duration_ms').notNull()
  },
  table => [index('idx_tool_calls_name').on(table.name), index('idx_tool_calls_started_at').on(table.startedAt)]
);
