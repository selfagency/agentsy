import { describe, expect, it } from 'vitest';

import { createDatabaseConnection } from '../../database/connection.js';
import { runMigrations } from '../../database/migrate.js';
import { createKnowledgeBaseManager } from './knowledge-base.js';

describe('KnowledgeBaseManager with SQLite', () => {
  it('ingests a source and returns summary', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const kb = createKnowledgeBaseManager({ db });
    const source = {
      content: 'hello world',
      sourceId: 'doc1',
      sourceType: 'file' as const,
      title: 'Doc 1'
    };

    const summary = await kb.ingest(source);
    expect(summary.inserted).toBeGreaterThan(0);

    sqlite.close();
  });

  it('searches for ingested content', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const kb = createKnowledgeBaseManager({ db });
    await kb.ingest({
      content: 'The capital of France is Paris.',
      sourceId: 'doc2',
      sourceType: 'file' as const,
      title: 'France'
    });

    const results = await kb.search({
      limit: 5,
      query: 'What is the capital of France?',
      scope: 'test-scope',
      weights: { entity: 0, lexical: 0, temporal: 0, vector: 1 }
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results?.[0]).toBeDefined();

    sqlite.close();
  });

  it('ingests a document with metadata', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const kb = createKnowledgeBaseManager({ db });
    const source = {
      content: 'Metadata content',
      metadata: { author: 'AI' },
      sourceId: 'doc_meta',
      sourceType: 'file' as const,
      title: 'Meta'
    };

    const summary = await kb.ingest(source);
    expect(summary.inserted).toBe(1);

    const results = await kb.search({
      query: 'Metadata',
      weights: { entity: 0, lexical: 1, temporal: 0, vector: 1 }
    });
    const firstResult = results.find(r => r.metadata?.author === 'AI');
    expect(firstResult?.metadata?.author).toBe('AI');

    sqlite.close();
  });

  it('removes a document', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const kb = createKnowledgeBaseManager({ db });
    await kb.ingest({
      content: 'To be removed',
      sourceId: 'doc3',
      sourceType: 'file' as const,
      title: 'Trash'
    });

    const results = await kb.search({
      query: 'removed',
      weights: { entity: 0, lexical: 1, temporal: 0, vector: 1 }
    });

    const docId = results[0]?.id;
    if (!docId) {
      throw new Error('Document ID should exist');
    }

    const removed = await kb.remove(docId);
    expect(removed).toBeTruthy();

    const resultsAfter = await kb.search({
      query: 'removed',
      weights: { entity: 0, lexical: 1, temporal: 0, vector: 1 }
    });
    expect(resultsAfter.find(r => r.id === docId)).toBeUndefined();

    sqlite.close();
  });

  it('skips unchanged documents on re-ingest', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const kb = createKnowledgeBaseManager({ db });
    const source = {
      content: 'Unchanged content',
      sourceId: 'doc-dedup',
      sourceType: 'file' as const,
      title: 'Dedup Test',
      updatedAt: '2024-01-01T00:00:00.000Z'
    };

    const first = await kb.ingest(source);
    expect(first.inserted).toBe(1);
    expect(first.skipped).toBe(0);

    const second = await kb.ingest(source);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(1);

    sqlite.close();
  });

  it('detects updates when same-id document has different metadata', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const kb = createKnowledgeBaseManager({ db });
    const source = {
      content: 'Same content',
      sourceId: 'doc-update',
      sourceType: 'file' as const,
      title: 'Update Test',
      updatedAt: '2024-01-01T00:00:00.000Z'
    };

    const first = await kb.ingest(source);
    expect(first.inserted).toBe(1);

    // Same content but different title changes fingerprint while ID stays the same
    const updated = await kb.ingest({ ...source, title: 'Updated Title' });
    expect(updated.updated).toBe(1);
    expect(updated.inserted).toBe(0);

    sqlite.close();
  });
});
