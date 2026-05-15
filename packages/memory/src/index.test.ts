import { describe, expect, it, vi } from 'vitest';
import {
  createInMemoryPubSubManager,
  createInMemoryScheduler,
  createInMemoryTaskQueue,
  createLocalEmbeddingEngine,
  createWikiManager,
  loadHonkerExtension,
} from './index.js';

describe('Phase 1: coordination foundations', () => {
  it('returns fallback mode when honker extension is unavailable', async () => {
    const result = await loadHonkerExtension({
      dbPath: 'memory.db',
      extensionPath: '/tmp/does-not-exist/honker.so',
      blake3ExtensionPath: '/tmp/does-not-exist/blake3.so',
    });

    expect(result.mode).toBe('fallback');
    expect(result.features.pubSub).toBe(false);
    expect(result.features.taskQueue).toBe(false);
    expect(result.features.scheduler).toBe(false);
    expect(result.features.blake3).toBe(false);
  });

  it('publishes messages to subscribed listeners', async () => {
    const pubSub = createInMemoryPubSubManager();
    const received: string[] = [];

    const unsubscribe = pubSub.subscribe<string>('agent-lifecycle', payload => {
      received.push(payload);
    });

    await pubSub.publish('agent-lifecycle', 'agent-started');
    unsubscribe();
    await pubSub.publish('agent-lifecycle', 'agent-stopped');

    expect(received).toEqual(['agent-started']);
  });

  it('dequeues tasks in FIFO order', async () => {
    const queue = createInMemoryTaskQueue();

    await queue.enqueue({ id: 't1', type: 'ingest' });
    await queue.enqueue({ id: 't2', type: 'synthesize' });

    const first = await queue.dequeue();
    const second = await queue.dequeue();
    const third = await queue.dequeue();

    expect(first?.id).toBe('t1');
    expect(second?.id).toBe('t2');
    expect(third).toBeNull();
  });

  it('runs scheduled jobs when due', async () => {
    vi.useFakeTimers();
    const scheduler = createInMemoryScheduler();
    const calls: string[] = [];

    scheduler.schedule('job-1', 1_000, () => {
      calls.push('job-1');
    });

    await vi.advanceTimersByTimeAsync(1_100);
    scheduler.cancel('job-1');
    vi.useRealTimers();

    expect(calls).toEqual(['job-1']);
  });
});

describe('Phase 1: three-tier wiki foundation', () => {
  it('supports raw -> wiki -> vector flow and semantic ranking', async () => {
    const wiki = createWikiManager();

    const raw = await wiki.captureRaw({
      sourceId: 'doc-1',
      content: '# OAuth Login\nUse PKCE for public clients.',
      sourceType: 'document',
    });

    const page = await wiki.upsertPage({
      pageId: 'wiki-auth',
      title: 'OAuth Login',
      body: raw.normalizedContent,
      tags: ['auth'],
    });

    await wiki.upsertVector(page.pageId, [0.2, 0.8, 0.1]);
    await wiki.upsertVector('wiki-cache', [0.9, 0.1, 0.1]);

    const ranked = await wiki.searchVector([0.1, 0.9, 0.1], 1);

    expect(page.version).toBe(1);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.pageId).toBe('wiki-auth');
  });

  it('tracks page history and version diff', async () => {
    const wiki = createWikiManager();

    await wiki.upsertPage({
      pageId: 'wiki-auth-history',
      title: 'OAuth Login',
      body: 'Use PKCE',
      tags: ['auth'],
      actorId: 'owner',
      format: 'markdown',
      writerIds: ['owner'],
    });

    await wiki.updatePage('wiki-auth-history', { body: 'Use PKCE and state' }, 'owner');

    const history = await wiki.getPageHistory('wiki-auth-history');
    const diff = await wiki.diffPageVersions('wiki-auth-history', 1, 2);

    expect(history).toHaveLength(2);
    expect(diff.addedLines).toContain('Use PKCE and state');
    expect(diff.removedLines).toContain('Use PKCE');
  });

  it('enforces page write permissions', async () => {
    const wiki = createWikiManager();

    await wiki.upsertPage({
      pageId: 'wiki-secure',
      title: 'Secure Page',
      body: 'private',
      actorId: 'owner',
      format: 'text',
      writerIds: ['owner'],
    });

    await expect(wiki.updatePage('wiki-secure', { body: 'intrusion' }, 'intruder')).rejects.toThrow(
      'does not have write access',
    );
  });

  it('supports full-text and hybrid search', async () => {
    const wiki = createWikiManager();

    await wiki.upsertPage({
      pageId: 'wiki-auth-search',
      title: 'OAuth Search',
      body: 'OAuth PKCE refresh token flow',
      format: 'markdown',
      actorId: 'system',
    });

    await wiki.upsertPage({
      pageId: 'wiki-cache-search',
      title: 'Cache Search',
      body: 'Redis eviction policy',
      format: 'text',
      actorId: 'system',
    });

    await wiki.upsertVector('wiki-auth-search', [0.2, 0.9, 0.1]);
    await wiki.upsertVector('wiki-cache-search', [0.9, 0.1, 0.1]);

    const textResults = await wiki.searchFullText('refresh token', 2);
    const hybridResults = await wiki.searchHybrid('oauth', [0.1, 0.95, 0.1], 1);

    expect(textResults[0]?.pageId).toBe('wiki-auth-search');
    expect(hybridResults[0]?.pageId).toBe('wiki-auth-search');
  });

  it('extracts semantic entities and concept links', async () => {
    const wiki = createWikiManager();

    await wiki.upsertPage({
      pageId: 'wiki-entities',
      title: 'OAuth and OpenID',
      body: 'OAuth works with OpenID Connect and PKCE.',
      format: 'markdown',
      actorId: 'system',
    });

    await wiki.linkConcepts('wiki-entities', 'wiki-auth', 'related');

    const entities = await wiki.extractEntities('wiki-entities');
    const relations = await wiki.getConceptRelations('wiki-entities');

    expect(entities).toContain('OAuth');
    expect(entities).toContain('OpenID');
    expect(relations[0]).toEqual({ toPageId: 'wiki-auth', relation: 'related' });
  });

  it('generates local embeddings for vector indexing', async () => {
    const embeddings = createLocalEmbeddingEngine({ dimensions: 8 });
    const vector = embeddings.embed('OAuth PKCE');

    expect(vector).toHaveLength(8);
    expect(vector.some(value => value !== 0)).toBe(true);
  });
});
