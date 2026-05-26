import { describe, expect, it } from 'vitest';

import { createDatabaseConnection } from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';
import { createWikiManager } from './wiki-manager.js';

describe('createWikiManager with SQLite', () => {
  it('upserts and retrieves a wiki page', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const wiki = createWikiManager({ db });

    const page = await wiki.upsertPage({
      pageId: 'wiki-test-1',
      title: 'Test Page',
      body: '# Hello\nWorld',
      tags: ['intro'],
      format: 'markdown'
    });

    expect(page.pageId).toBe('wiki-test-1');
    expect(page.title).toBe('Test Page');
    expect(page.version).toBe(1);

    const retrieved = await wiki.getPage('wiki-test-1');
    expect(retrieved?.title).toBe('Test Page');
    expect(retrieved?.tags).toEqual(['intro']);

    sqlite.close();
  });

  it('auto-generates embeddings on upsert', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const wiki = createWikiManager({ db });
    await wiki.upsertPage({
      pageId: 'wiki-vec-1',
      title: 'Vector Test',
      body: 'Some content here'
    });

    const results = await wiki.searchVector(await createMockEmbedding('Some content here'), 1);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.pageId).toBe('wiki-vec-1');

    sqlite.close();
  });

  it('updates a page and tracks version history', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const wiki = createWikiManager({ db });

    await wiki.upsertPage({
      actorId: 'alice',
      pageId: 'wiki-history',
      title: 'History Test',
      body: 'Initial body',
      writerIds: ['alice']
    });

    const updated = await wiki.updatePage('wiki-history', { body: 'Updated body' }, 'alice');
    expect(updated.version).toBe(2);

    const history = await wiki.getPageHistory('wiki-history');
    expect(history).toHaveLength(2);
    expect(history[0]?.body).toBe('Initial body');
    expect(history[1]?.body).toBe('Updated body');

    sqlite.close();
  });

  it('diffs page versions', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const wiki = createWikiManager({ db });

    await wiki.upsertPage({
      actorId: 'system',
      pageId: 'wiki-diff',
      title: 'Diff Test',
      body: 'line one\nline two'
    });

    await wiki.updatePage('wiki-diff', { body: 'line one\nline three' }, 'system');

    const diff = await wiki.diffPageVersions('wiki-diff', 1, 2);
    expect(diff.addedLines).toContain('line three');
    expect(diff.removedLines).toContain('line two');

    sqlite.close();
  });

  it('enforces write permissions', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const wiki = createWikiManager({ db });

    await wiki.upsertPage({
      actorId: 'owner',
      pageId: 'wiki-secure',
      title: 'Secure',
      body: 'private',
      writerIds: ['owner']
    });

    await expect(wiki.updatePage('wiki-secure', { body: 'hacked' }, 'intruder')).rejects.toThrow(
      'does not have write access'
    );

    sqlite.close();
  });

  it('searches full text across pages', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const wiki = createWikiManager({ db });

    await wiki.upsertPage({
      pageId: 'wiki-search-a',
      title: 'OAuth Guide',
      body: 'PKCE refresh token flow'
    });
    await wiki.upsertPage({
      pageId: 'wiki-search-b',
      title: 'GraphQL API',
      body: 'queries and mutations'
    });

    const results = await wiki.searchFullText('OAuth PKCE', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.pageId).toBe('wiki-search-a');

    sqlite.close();
  });

  it('performs hybrid search', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const wiki = createWikiManager({ db });

    await wiki.upsertPage({
      pageId: 'wiki-hybrid',
      title: 'Hybrid Search Target',
      body: 'target content for hybrid search'
    });

    const results = await wiki.searchHybrid('target hybrid', await createMockEmbedding('target content'), 5);
    expect(results.length).toBeGreaterThan(0);

    sqlite.close();
  });

  it('extracts entities from a page', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const wiki = createWikiManager({ db });

    await wiki.upsertPage({
      pageId: 'wiki-entities',
      title: 'Entities',
      body: 'OpenAI and Anthropic are AI companies. OpenAI is based in San Francisco.'
    });

    const entities = await wiki.extractEntities('wiki-entities');
    expect(entities).toContain('OpenAI');
    expect(entities).toContain('Anthropic');

    sqlite.close();
  });

  it('links concepts and retrieves relations', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const wiki = createWikiManager({ db });

    await wiki.upsertPage({ pageId: 'page-a', title: 'A', body: 'Page A' });
    await wiki.upsertPage({ pageId: 'page-b', title: 'B', body: 'Page B' });

    await wiki.linkConcepts('page-a', 'page-b', 'references');

    const relations = await wiki.getConceptRelations('page-a');
    expect(relations).toHaveLength(1);
    expect(relations[0]?.toPageId).toBe('page-b');
    expect(relations[0]?.relation).toBe('references');

    sqlite.close();
  });

  it('links pages and retrieves backlinks', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const wiki = createWikiManager({ db });

    await wiki.upsertPage({ pageId: 'home', title: 'Home', body: 'Home page' });
    await wiki.upsertPage({ pageId: 'about', title: 'About', body: 'About page' });

    await wiki.linkPages('about', 'home');

    const backlinks = await wiki.getBacklinks('home');
    expect(backlinks).toContain('about');

    sqlite.close();
  });

  it('upserts external vectors and searches them', async () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const wiki = createWikiManager({ db });

    await wiki.upsertPage({ pageId: 'vec-test', title: 'Vector', body: 'test' });
    await wiki.upsertVector('vec-test', [1, 0, 0, 0]);

    const results = await wiki.searchVector([1, 0, 0, 0], 5);
    expect(results[0]?.pageId).toBe('vec-test');
    expect(results[0]?.score).toBeCloseTo(1, 5);

    sqlite.close();
  });
});

function createMockEmbedding(_text: string): number[] {
  // Deterministic mock embedding for test stability
  return [0.1, 0.2, 0.3, 0.4];
}
