import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createDatabaseConnection } from './connection.js';
import { runMigrations } from './migrate.js';
import { memoryItems, wikiPages } from './schema.js';

describe('memoryItems schema', () => {
  it('inserts and selects a memory item', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const item = {
      id: 'mem-1',
      tier: 'sensory_buffer' as const,
      kind: 'episodic' as const,
      content: 'Hello world',
      tokenCount: 3,
      importance: 0.75,
      writeHeap: 'event' as const,
      reuseClass: 'hot' as const,
      createdAt: 1000,
      lastAccessedAt: 1000,
      accessCount: 0,
      fingerprint: 'abc123',
      metadata: '{}'
    };

    db.insert(memoryItems).values(item).run();

    const result = db
      .select()
      .from(memoryItems)
      .where(and(eq(memoryItems.id, 'mem-1'), eq(memoryItems.tier, 'sensory_buffer')))
      .get();
    expect(result).toBeDefined();
    expect(result?.content).toBe('Hello world');
    expect(result?.tier).toBe('sensory_buffer');
    expect(result?.importance).toBe(0.75);

    sqlite.close();
  });

  it('allows same id in different tiers via composite primary key', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const baseItem = {
      id: 'mem-shared',
      kind: 'episodic' as const,
      content: 'shared content',
      tokenCount: 2,
      importance: 0.5,
      writeHeap: 'event' as const,
      reuseClass: 'hot' as const,
      createdAt: 1000,
      lastAccessedAt: 1000,
      accessCount: 0,
      fingerprint: 'fp-shared',
      metadata: '{}'
    };

    db.insert(memoryItems)
      .values({ ...baseItem, tier: 'sensory_buffer' })
      .run();
    db.insert(memoryItems)
      .values({ ...baseItem, tier: 'working_memory' })
      .run();

    const bufferItem = db
      .select()
      .from(memoryItems)
      .where(and(eq(memoryItems.id, 'mem-shared'), eq(memoryItems.tier, 'sensory_buffer')))
      .get();
    const workingItem = db
      .select()
      .from(memoryItems)
      .where(and(eq(memoryItems.id, 'mem-shared'), eq(memoryItems.tier, 'working_memory')))
      .get();

    expect(bufferItem).toBeDefined();
    expect(workingItem).toBeDefined();

    sqlite.close();
  });

  it('enforces CHECK constraints at the SQLite level', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const invalidItem = {
      id: 'mem-bad',
      tier: 'invalid_tier',
      kind: 'episodic',
      content: 'x',
      tokenCount: 1,
      importance: 0.5,
      writeHeap: 'event',
      reuseClass: 'hot',
      createdAt: 0,
      lastAccessedAt: 0,
      accessCount: 0,
      fingerprint: 'fp',
      metadata: '{}'
    };

    expect(() => {
      db.insert(memoryItems).values(invalidItem).run();
    }).toThrow('CHECK constraint failed');

    sqlite.close();
  });
});

describe('wikiPages schema', () => {
  it('inserts and retrieves a wiki page', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const page = {
      pageId: 'page-1',
      title: 'Test Page',
      body: '# Hello',
      tags: '["intro"]',
      format: 'markdown' as const,
      writerIds: '["alice"]',
      version: 1,
      updatedAt: Date.now()
    };

    db.insert(wikiPages).values(page).run();

    const result = db.select().from(wikiPages).where(eq(wikiPages.pageId, 'page-1')).get();
    expect(result).toBeDefined();
    expect(result?.title).toBe('Test Page');
    expect(result?.format).toBe('markdown');

    sqlite.close();
  });
});
