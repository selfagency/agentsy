import { beforeAll, describe, expect, it } from 'vitest';

import { createMemoryEngine } from './cognitive/memory-engine.js';
import { createKnowledgeBaseManager } from './retrieval/rag/knowledge-base.js';
import { queryUnified } from './unified-query.js';
import { createWikiManager } from './wiki/wiki-manager.js';

let engine: ReturnType<typeof createMemoryEngine>;
let wiki: ReturnType<typeof createWikiManager>;
let kb: ReturnType<typeof createKnowledgeBaseManager>;

describe('queryUnified', () => {
  beforeAll(() => {
    engine = createMemoryEngine();
    wiki = createWikiManager();
    kb = createKnowledgeBaseManager();
  });

  it('returns empty array when all sources are empty', async () => {
    const results = await queryUnified(engine, wiki, kb, { query: 'test' });
    expect(results).toEqual([]);
  });

  it('defaults to querying all sources when no include flags specified', async () => {
    engine.ingest('tier data', { importance: 0.8 });
    await wiki.upsertPage({ pageId: 'p1', title: 'Wiki Data', body: 'wiki content', tags: ['t'] });
    await kb.ingest({
      sourceId: 's1',
      sourceType: 'document',
      title: 'RAG Data',
      content: 'rag content',
      updatedAt: new Date().toISOString()
    });

    const results = await queryUnified(engine, wiki, kb, { query: 'data' });

    expect(results.some(r => r.source === 'tier')).toBe(true);
    expect(results.some(r => r.source === 'wiki')).toBe(true);
    expect(results.some(r => r.source === 'rag')).toBe(true);
  });

  it('uses default weights when none provided', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    localEngine.ingest('alpha', { importance: 1 });
    await localWiki.upsertPage({ pageId: 'p1', title: 'Alpha', body: 'alpha wiki', tags: ['t'] });

    const resultsWithDefaults = await queryUnified(localEngine, localWiki, localKb, {
      query: 'alpha',
      includeRAG: false
    });
    const resultsWithExplicit = await queryUnified(localEngine, localWiki, localKb, {
      query: 'alpha',
      includeRAG: false,
      weights: { tierMemory: 0.3, wiki: 0.3, rag: 0.4 }
    });

    // Same ranking since default weights match explicit weights
    expect(resultsWithDefaults.map(r => r.source)).toEqual(resultsWithExplicit.map(r => r.source));
  });

  it('returns results sorted in descending order by weighted score', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    localEngine.ingest('low', { importance: 0.2 });
    localEngine.ingest('high', { importance: 0.9 });

    const results = await queryUnified(localEngine, localWiki, localKb, {
      query: 'high',
      includeWiki: false,
      includeRAG: false
    });

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]?.score).toBeGreaterThanOrEqual(results[i]?.score ?? 0);
    }
  });

  it('truncates wiki content to 500 characters', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    const longBody = 'x'.repeat(1000);
    await localWiki.upsertPage({ pageId: 'long', title: 'Long', body: longBody, tags: ['t'] });

    const results = await queryUnified(localEngine, localWiki, localKb, {
      query: 'x',
      includeTiers: false,
      includeRAG: false
    });

    const wikiResult = results.find(r => r.source === 'wiki');
    expect(wikiResult).toBeDefined();
    expect(wikiResult?.content.length).toBeLessThanOrEqual(500);
  });

  it('returns wiki and rag results even when tiers are empty', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    await localWiki.upsertPage({
      pageId: 'p1',
      title: 'Only Wiki',
      body: 'wiki here',
      tags: ['t']
    });
    await localKb.ingest({
      sourceId: 's1',
      sourceType: 'document',
      title: 'Only RAG',
      content: 'rag here',
      updatedAt: new Date().toISOString()
    });

    const results = await queryUnified(localEngine, localWiki, localKb, { query: 'here' });

    expect(results.some(r => r.source === 'wiki')).toBe(true);
    expect(results.some(r => r.source === 'rag')).toBe(true);
    expect(results.some(r => r.source === 'tier')).toBe(false);
  });

  it('returns tier results even when wiki and rag are empty', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    localEngine.ingest('only tier', { importance: 0.8 });

    const results = await queryUnified(localEngine, localWiki, localKb, { query: 'tier' });

    expect(results.some(r => r.source === 'tier')).toBe(true);
    expect(results.some(r => r.source === 'wiki')).toBe(false);
    expect(results.some(r => r.source === 'rag')).toBe(false);
  });

  it('returns tier results when tiers have data', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    localEngine.ingest('sensory event alpha', { importance: 0.9 });
    localEngine.ingest('working memory beta', { importance: 0.7, targetTier: 'working_memory' });

    const results = await queryUnified(localEngine, localWiki, localKb, {
      query: 'alpha',
      includeWiki: false,
      includeRAG: false
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      source: 'tier',
      content: 'sensory event alpha'
    });
    expect(results[0]?.score).toBeGreaterThan(0);
  });

  it('returns wiki results when wiki has pages', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    await localWiki.upsertPage({
      pageId: 'page-1',
      title: 'OAuth Guide',
      body: 'OAuth is an open standard for access delegation.',
      tags: ['auth']
    });

    const results = await queryUnified(localEngine, localWiki, localKb, {
      query: 'OAuth',
      includeTiers: false,
      includeRAG: false
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      source: 'wiki',
      title: 'OAuth Guide'
    });
  });

  it('returns RAG results when knowledge base has documents', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    await localKb.ingest({
      sourceId: 'doc-1',
      sourceType: 'document',
      title: 'RAG Overview',
      content: 'Retrieval Augmented Generation combines retrieval with generation.',
      updatedAt: new Date().toISOString()
    });

    const results = await queryUnified(localEngine, localWiki, localKb, {
      query: 'retrieval augmented',
      includeTiers: false,
      includeWiki: false
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      source: 'rag',
      title: 'RAG Overview'
    });
  });

  it('returns combined results from all three sources', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    localEngine.ingest('machine learning memory', { importance: 0.85 });
    await localWiki.upsertPage({
      pageId: 'ml-page',
      title: 'ML Basics',
      body: 'Machine learning is a subset of artificial intelligence.',
      tags: ['ml']
    });
    await localKb.ingest({
      sourceId: 'ml-doc',
      sourceType: 'document',
      title: 'ML Tutorial',
      content: 'Machine learning tutorial for beginners.',
      updatedAt: new Date().toISOString()
    });

    const results = await queryUnified(localEngine, localWiki, localKb, {
      query: 'machine learning'
    });

    const tierResults = results.filter(r => r.source === 'tier');
    const wikiResults = results.filter(r => r.source === 'wiki');
    const ragResults = results.filter(r => r.source === 'rag');

    expect(tierResults.length).toBeGreaterThan(0);
    expect(wikiResults.length).toBeGreaterThan(0);
    expect(ragResults.length).toBeGreaterThan(0);
  });

  it('applies custom weights during ranking', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    localEngine.ingest('alpha memory', { importance: 1 });
    await localWiki.upsertPage({
      pageId: 'alpha-page',
      title: 'Alpha Wiki',
      body: 'Alpha content here.',
      tags: ['alpha']
    });

    const results = await queryUnified(localEngine, localWiki, localKb, {
      query: 'alpha',
      weights: { tierMemory: 0.1, wiki: 0.9, rag: 0 }
    });

    // With wiki weighted heavily, wiki should outrank tier even with lower raw score
    const wikiIndex = results.findIndex(r => r.source === 'wiki');
    const tierIndex = results.findIndex(r => r.source === 'tier');
    expect(wikiIndex).toBeLessThan(tierIndex);
  });

  it('respects the limit parameter', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    for (let i = 0; i < 5; i++) {
      localEngine.ingest(`memory ${i}`, { importance: 0.5 + i * 0.1 });
    }

    const results = await queryUnified(localEngine, localWiki, localKb, {
      query: 'memory',
      limit: 3,
      includeWiki: false,
      includeRAG: false
    });

    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('filters tiers with includeTiers', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    localEngine.ingest('working item', { importance: 0.8, targetTier: 'working_memory' });
    localEngine.ingest('long term item', { importance: 0.6, targetTier: 'long_term_memory' });

    const results = await queryUnified(localEngine, localWiki, localKb, {
      query: 'item',
      includeTiers: ['working_memory'],
      includeWiki: false,
      includeRAG: false
    });

    expect(results.every(r => r.tier === 'working_memory')).toBe(true);
  });

  it('uses minImportance for tier filtering', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    localEngine.ingest('high importance', { importance: 0.9 });
    localEngine.ingest('low importance', { importance: 0.1 });

    const results = await queryUnified(localEngine, localWiki, localKb, {
      query: 'importance',
      minImportance: 0.5,
      includeWiki: false,
      includeRAG: false
    });

    expect(results.every(r => r.score >= 0.5)).toBe(true);
  });

  it('each result has required fields', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    localEngine.ingest('test memory', { importance: 0.7 });
    await localWiki.upsertPage({
      pageId: 'test-page',
      title: 'Test Page',
      body: 'Test body content.',
      tags: ['test']
    });
    await localKb.ingest({
      sourceId: 'test-doc',
      sourceType: 'document',
      title: 'Test Doc',
      content: 'Test document content.',
      updatedAt: new Date().toISOString()
    });

    const results = await queryUnified(localEngine, localWiki, localKb, { query: 'test' });

    for (const result of results) {
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('score');
      expect(['tier', 'wiki', 'rag']).toContain(result.source);
    }
  });

  it('wiki results include pageId and title', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    await localWiki.upsertPage({
      pageId: 'wiki-1',
      title: 'Wiki Title',
      body: 'Wiki body content.',
      tags: ['wiki']
    });

    const results = await queryUnified(localEngine, localWiki, localKb, {
      query: 'wiki',
      includeTiers: false,
      includeRAG: false
    });

    expect(results.length).toBeGreaterThan(0);
    const wikiResult = results.find(r => r.source === 'wiki');
    expect(wikiResult).toBeDefined();
    expect(wikiResult?.pageId).toBe('wiki-1');
    expect(wikiResult?.title).toBe('Wiki Title');
  });

  it('rag results include citations', async () => {
    const localEngine = createMemoryEngine();
    const localWiki = createWikiManager();
    const localKb = createKnowledgeBaseManager();
    await localKb.ingest({
      sourceId: 'rag-src',
      sourceType: 'document',
      title: 'RAG Doc',
      content: 'RAG document content for testing.',
      updatedAt: new Date().toISOString()
    });

    const results = await queryUnified(localEngine, localWiki, localKb, {
      query: 'RAG',
      includeTiers: false,
      includeWiki: false
    });

    expect(results.length).toBeGreaterThan(0);
    const ragResult = results.find(r => r.source === 'rag');
    expect(ragResult).toBeDefined();
    expect(ragResult?.citations).toBeDefined();
    expect(ragResult?.citations?.length).toBeGreaterThan(0);
  });
});
