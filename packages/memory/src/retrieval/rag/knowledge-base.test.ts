import { describe, it, expect } from 'vitest';
import { createKnowledgeBaseManager } from './knowledge-base.js';

describe('KnowledgeBaseManager', () => {
  it('should ingest a source and return summary', async () => {
    const kb = createKnowledgeBaseManager();
    const source = {
      sourceId: 'doc1',
      sourceType: 'file' as const,
      content: 'hello world',
      title: 'Doc 1'
    };

    const summary = await kb.ingest(source);
    expect(summary.inserted).toBeGreaterThan(0);
  });

  it('should search for ingested content', async () => {
    const kb = createKnowledgeBaseManager();
    await kb.ingest({
      sourceId: 'doc2',
      sourceType: 'file' as const,
      content: 'The capital of France is Paris.',
      title: 'France'
    });

    const results = await kb.search({
      query: 'What is the capital of France?',
      scope: 'test-scope',
      limit: 5,
      weights: { vector: 1, lexical: 0, entity: 0, temporal: 0 }
    });

    expect(results.length).toBeGreaterThan(0);
    const firstResult = results[0];
    expect(firstResult).toBeDefined();
    if (firstResult) {
      expect(firstResult.content).toContain('Paris');
    }
  });

  it('should ingest a document with metadata', async () => {
    const kb = createKnowledgeBaseManager();
    const source = {
      sourceId: 'doc_meta',
      sourceType: 'file' as const,
      content: 'Metadata content',
      title: 'Meta',
      metadata: { author: 'AI' }
    };

    const summary = await kb.ingest(source);
    expect(summary.inserted).toBe(1);

    const results = await kb.search({
      query: 'Metadata',
      weights: { vector: 1, lexical: 1, entity: 0, temporal: 0 }
    });
    const firstResult = results[0];
    expect(firstResult).toBeDefined();
    if (firstResult) {
      expect(firstResult.metadata?.author).toBe('AI');
    }
  });

  it('should remove a document', async () => {
    const kb = createKnowledgeBaseManager();
    await kb.ingest({
      sourceId: 'doc3',
      sourceType: 'file' as const,
      content: 'To be removed',
      title: 'Trash'
    });

    const results = await kb.search({
      query: 'removed',
      weights: { vector: 1, lexical: 1, entity: 0, temporal: 0 }
    });

    const docId = results[0]?.id;
    expect(docId).toBeDefined();

    if (docId) {
      const removed = await kb.remove(docId);
      expect(removed).toBe(true);

      const resultsAfter = await kb.search({
        query: 'removed',
        weights: { vector: 1, lexical: 1, entity: 0, temporal: 0 }
      });
      expect(resultsAfter.find(r => r.id === docId)).toBeUndefined();
    }
  });
});
