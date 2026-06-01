import { mkdtempSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TierConfig } from '../cognitive/tier-types.js';
import { createDatabaseConnection } from '../database/connection.js';
import { createRagFsAdapter, createTierFsAdapter, createWikiFsAdapter, detectAgentFs, initAgentFs } from './index.js';
import { createSnapshot, restoreSnapshot } from './snapshot.js';

describe('AgentFS init', () => {
  it('detects absence before init and presence after init', () => {
    const { sqlite } = createDatabaseConnection({ path: ':memory:', walMode: false });
    expect(detectAgentFs(sqlite)).toBe(false);

    const status = initAgentFs({ sqlite });
    expect(status.hasAgentFsTables).toBe(true);
    expect(status.rootIno).toBe(1);
    expect(detectAgentFs(sqlite)).toBe(true);
  });

  it('is idempotent', () => {
    const { sqlite } = createDatabaseConnection({ path: ':memory:', walMode: false });
    initAgentFs({ sqlite });
    const status = initAgentFs({ sqlite });
    expect(status.hasAgentFsTables).toBe(true);
    expect(status.schemaVersion).toBe(2);
  });
});

describe('TierFsAdapter', () => {
  it('round-trips memory items via kv_store', () => {
    const { db, sqlite } = createDatabaseConnection({ path: ':memory:', walMode: false });
    initAgentFs({ sqlite });

    const config: TierConfig = {
      name: 'short_term_memory',
      level: 4,
      maxItems: 100,
      maxTokens: 1000,
      ttlMs: Number.POSITIVE_INFINITY,
      consolidationThreshold: 0.5,
      compressionTarget: 0.8
    };

    const tier = createTierFsAdapter({ db, tierName: 'short_term_memory', config });
    const item = {
      id: 'test-1',
      kind: 'episodic' as const,
      content: 'hello world',
      tokenCount: 2,
      importance: 0.8,
      writeHeap: 'event' as const,
      reuseClass: 'hot' as const,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
      fingerprint: 'fp-1',
      metadata: { source: 'test' }
    };

    const written = tier.write(item);
    expect(written).not.toBeNull();
    if (!written) {
      throw new Error('Expected written to be non-null');
    }
    expect(written.id).toBe('test-1');

    const readResult = tier.read();
    expect(readResult.items).toHaveLength(1);
    expect(readResult.items[0]?.content).toBe('hello world');

    const stats = tier.capacity();
    expect(stats.usedItems).toBe(1);
    expect(stats.usedTokens).toBe(2);

    tier.clear();
    expect(tier.capacity().usedItems).toBe(0);
  });
});

describe('WikiFsAdapter', () => {
  it('round-trips wiki pages via kv_store', async () => {
    const { db, sqlite } = createDatabaseConnection({ path: ':memory:', walMode: false });
    initAgentFs({ sqlite });

    const wiki = createWikiFsAdapter({ db });

    const page = await wiki.upsertPage({
      pageId: 'getting-started',
      title: 'Getting Started',
      body: '# Hello\n\nWelcome.',
      tags: ['intro'],
      format: 'markdown',
      actorId: 'test'
    });

    expect(page.pageId).toBe('getting-started');
    expect(page.version).toBe(1);

    const fetched = await wiki.getPage('getting-started');
    expect(fetched?.title).toBe('Getting Started');

    const updated = await wiki.updatePage('getting-started', { body: '# Hello\n\nWelcome to Agentsy.' }, 'test');
    expect(updated.version).toBe(2);

    const history = await wiki.getPageHistory('getting-started');
    expect(history).toHaveLength(2);

    const diff = await wiki.diffPageVersions('getting-started', 1, 2);
    expect(diff.addedLines.length).toBeGreaterThan(0);
  });

  it('searches full text and vector', async () => {
    const { db, sqlite } = createDatabaseConnection({ path: ':memory:', walMode: false });
    initAgentFs({ sqlite });

    const wiki = createWikiFsAdapter({ db });

    await wiki.upsertPage({
      pageId: 'alpha',
      title: 'Alpha Page',
      body: 'alpha content here',
      format: 'markdown',
      actorId: 'test'
    });
    await wiki.upsertPage({
      pageId: 'beta',
      title: 'Beta Page',
      body: 'beta content here',
      format: 'markdown',
      actorId: 'test'
    });

    await wiki.upsertVector('alpha', [1, 0, 0]);
    await wiki.upsertVector('beta', [0, 1, 0]);

    const textResults = await wiki.searchFullText('alpha', 10);
    expect(textResults.length).toBeGreaterThan(0);
    expect(textResults[0]?.pageId).toBe('alpha');

    const vectorResults = await wiki.searchVector([1, 0, 0], 10);
    expect(vectorResults.length).toBeGreaterThan(0);
    expect(vectorResults[0]?.pageId).toBe('alpha');

    const hybridResults = await wiki.searchHybrid('alpha', [1, 0, 0], 10);
    expect(hybridResults.length).toBeGreaterThan(0);
  });
});

describe('RagFsAdapter', () => {
  it('ingests, searches, and removes documents via kv_store', async () => {
    const { db, sqlite } = createDatabaseConnection({ path: ':memory:', walMode: false });
    initAgentFs({ sqlite });

    const kb = createRagFsAdapter({ db });

    const summary = await kb.ingest({
      sourceId: 'doc-1',
      sourceType: 'document',
      title: 'Hello World',
      content: 'This is a test document about agent memory systems.',
      updatedAt: new Date().toISOString()
    });

    expect(summary.inserted).toBeGreaterThan(0);

    const results = await kb.search({
      query: 'agent memory',
      limit: 10,
      weights: { vector: 0.4, lexical: 0.3, entity: 0.2, temporal: 0.1 }
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toBe('Hello World');

    const firstResult = results[0];
    if (!firstResult) {
      throw new Error('Expected at least one result');
    }
    const docId = firstResult.id;
    const removed = await kb.remove(docId);
    expect(removed).toBe(true);

    const afterRemove = await kb.search({
      query: 'agent memory',
      limit: 10,
      weights: { vector: 0.4, lexical: 0.3, entity: 0.2, temporal: 0.1 }
    });
    expect(afterRemove.length).toBe(0);
  });

  it('skips unchanged documents on re-ingest', async () => {
    const { db, sqlite } = createDatabaseConnection({ path: ':memory:', walMode: false });
    initAgentFs({ sqlite });

    const kb = createRagFsAdapter({ db });

    const source = {
      sourceId: 'doc-1',
      sourceType: 'document' as const,
      title: 'Hello World',
      content: 'This is a test document about agent memory systems.',
      updatedAt: new Date().toISOString()
    };

    const first = await kb.ingest(source);
    expect(first.inserted).toBeGreaterThan(0);

    const second = await kb.ingest(source);
    expect(second.skipped).toBeGreaterThan(0);
  });
});

describe('AgentFS snapshot', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'agentsy-snapshot-'));
  });

  afterAll(() => {
    try {
      unlinkSync(tmpDir);
    } catch {
      // ignore cleanup failures
    }
  });

  it('creates and restores a snapshot via VACUUM INTO', () => {
    const dbPath = join(tmpDir, 'source.db');
    const { sqlite } = createDatabaseConnection({ path: dbPath, walMode: false });
    initAgentFs({ sqlite });

    // Insert some data
    sqlite.exec("INSERT INTO fs_config (key, value) VALUES ('test_key', 'test_value')");

    const snapshotPath = join(tmpDir, 'test-snapshot.db');
    const snap = createSnapshot({ sqlite, destinationPath: snapshotPath });
    expect(snap.destinationPath).toBe(snapshotPath);

    // Verify snapshot file exists by trying to open it
    const { sqlite: restoredSqlite } = createDatabaseConnection({
      path: snapshotPath,
      walMode: false
    });
    const row = restoredSqlite.prepare("SELECT value FROM fs_config WHERE key = 'test_key'").get() as
      | { value: string }
      | undefined;
    expect(row?.value).toBe('test_value');
    restoredSqlite.close();

    // Now restore onto a fresh file-based DB
    const targetPath = join(tmpDir, 'target.db');
    const { sqlite: targetSqlite } = createDatabaseConnection({ path: targetPath, walMode: false });
    const restore = restoreSnapshot({ sqlite: targetSqlite, sourcePath: snapshotPath });
    expect(restore.sourcePath).toBe(snapshotPath);

    const restoredRow = targetSqlite.prepare("SELECT value FROM fs_config WHERE key = 'test_key'").get() as
      | { value: string }
      | undefined;
    expect(restoredRow?.value).toBe('test_value');
  });
});
