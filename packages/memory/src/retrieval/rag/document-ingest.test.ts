import { describe, expect, it } from 'vitest';

import { createDocumentIngestor } from './document-ingest.js';

describe('DocumentIngestor', () => {
  it('chunks deterministically and preserves stable chunk IDs between runs', async () => {
    const ingestor = createDocumentIngestor();
    const payload = {
      content: 'Refresh tokens are long-lived. Access tokens are short-lived. Rotate refresh tokens when possible.',
      sourceId: 'wiki:oauth-refresh',
      sourceType: 'wiki' as const,
      title: 'OAuth Refresh Tokens'
    };

    const first = await ingestor.ingest(payload);
    const second = await ingestor.ingest(payload);

    expect(first.documents.length).toBeGreaterThan(0);
    expect(first.documents.map(item => item.id)).toStrictEqual(second.documents.map(item => item.id));
  });

  it('splits content that exceeds max chunk size', async () => {
    const ingestor = createDocumentIngestor();
    // Create content longer than default 280-char chunk boundary
    const longContent =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '.repeat(
        5
      );

    const result = await ingestor.ingest({
      content: longContent,
      sourceId: 'long-doc',
      sourceType: 'wiki'
    });

    expect(result.documents.length).toBeGreaterThan(1);
    // Each document should have a unique chunk index
    const indices = result.documents.map(d => d.chunkIndex);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('handles empty content returning no documents', async () => {
    const ingestor = createDocumentIngestor();

    const result = await ingestor.ingest({
      content: '',
      sourceId: 'empty',
      sourceType: 'text'
    });

    expect(result.documents).toStrictEqual([]);
  });

  it('handles whitespace-only content returning no documents', async () => {
    const ingestor = createDocumentIngestor();

    const result = await ingestor.ingest({
      content: '   \n\n  \t  ',
      sourceId: 'whitespace',
      sourceType: 'text'
    });

    expect(result.documents).toStrictEqual([]);
  });

  it('passes through metadata to all documents', async () => {
    const ingestor = createDocumentIngestor();
    const metadata = { source: 'wiki', version: 2, tags: ['oauth'] };

    const result = await ingestor.ingest({
      content: 'Session tokens should be rotated.',
      metadata,
      sourceId: 'wiki:session',
      sourceType: 'text',
      title: 'Session Tokens'
    });

    expect(result.documents.length).toBe(1);
    expect(result.documents[0]?.metadata).toStrictEqual(metadata);
  });

  it('uses sourceId as fallback title when title not provided', async () => {
    const ingestor = createDocumentIngestor();

    const result = await ingestor.ingest({
      content: 'Content without title.',
      sourceId: 'untitled-doc',
      sourceType: 'wiki'
    });

    expect(result.documents[0]?.title).toBe('untitled-doc');
  });

  it('provides updatedAt fallback when not specified', async () => {
    const ingestor = createDocumentIngestor();

    const result = await ingestor.ingest({
      content: 'Fresh content.',
      sourceId: 'fresh',
      sourceType: 'text'
    });

    expect(result.documents[0]?.updatedAt).toBeDefined();
    expect(typeof result.documents[0]?.updatedAt).toBe('string');
    expect(() => new Date(result.documents[0]?.updatedAt ?? '')).not.toThrow();
  });

  it('preserves explicit updatedAt when provided', async () => {
    const ingestor = createDocumentIngestor();
    const updatedAt = '2026-05-01T00:00:00.000Z';

    const result = await ingestor.ingest({
      content: 'Dated content.',
      sourceId: 'dated',
      sourceType: 'wiki',
      updatedAt
    });

    expect(result.documents[0]?.updatedAt).toBe(updatedAt);
  });

  it('generates unique chunk IDs per chunk index', async () => {
    const ingestor = createDocumentIngestor();
    const longContent = 'word '.repeat(300); // exceeds 280 chars

    const result = await ingestor.ingest({
      content: longContent,
      sourceId: 'multi-chunk',
      sourceType: 'wiki'
    });

    const ids = result.documents.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });
});
