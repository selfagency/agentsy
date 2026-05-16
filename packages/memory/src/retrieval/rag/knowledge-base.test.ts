import { describe, expect, it } from 'vitest';

import { createKnowledgeBaseManager } from './knowledge-base.js';

describe('KnowledgeBaseManager', () => {
  it('should ingest a source and return summary', async () => {
    const kb = createKnowledgeBaseManager();
    const source = {
      content: 'hello world',
      sourceId: 'doc1',
      sourceType: 'file' as const,
      title: 'Doc 1'
    };

    const summary = await kb.ingest(source);
    expect(summary.inserted).toBeGreaterThan(0);
  });

  it('should search for ingested content', async () => {
    const kb = createKnowledgeBaseManager();
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
    const firstResult = results[0];
    if (!firstResult) {
      throw new Error('Search result should exist');
    }
    expect(firstResult.content).toContain('Paris');
  });

  it('should ingest a document with metadata', async () => {
    const kb = createKnowledgeBaseManager();
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
    const firstResult = results[0];
    if (!firstResult) {
      throw new Error('Search result should exist');
    }
    expect(firstResult.metadata?.author).toBe('AI');
  });

  it('should remove a document', async () => {
    const kb = createKnowledgeBaseManager();
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
  });
});
