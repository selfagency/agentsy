import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
