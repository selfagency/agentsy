import { describe, expect, it } from 'vitest';

import { createDatabaseConnection } from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';
import { createMemoryEngine } from './memory-engine.js';

describe('createMemoryEngine with SQLite', () => {
  it('ingests items and persists them to the database', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const engine = createMemoryEngine({ db });
    const id = engine.ingest('Hello SQLite-backed memory', { importance: 0.8 });

    expect(id).not.toBeNull();

    const results = engine.recall();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.items.length).toBeGreaterThan(0);

    sqlite.close();
  });

  it('recalls items from specific tiers', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const engine = createMemoryEngine({ db });
    engine.ingest('First event');
    engine.ingest('Second event');

    const results = engine.recall({ tiers: ['sensory_buffer'] });
    expect(results[0]?.items.length).toBe(2);

    sqlite.close();
  });

  it('resets and clears all database-backed tiers', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const engine = createMemoryEngine({ db });
    engine.ingest('Event one');
    engine.ingest('Event two');
    expect(engine.stats().totalItems).toBe(2);

    engine.reset();
    expect(engine.stats().totalItems).toBe(0);

    sqlite.close();
  });

  it('reports stats correctly with SQLite backend', () => {
    const { sqlite, db } = createDatabaseConnection();
    runMigrations(sqlite);

    const engine = createMemoryEngine({ db });
    engine.ingest('Test content', { targetTier: 'sensory_buffer' });

    const stats = engine.stats();
    expect(stats.totalItems).toBe(1);
    expect(stats.tierStats.sensory_buffer?.items).toBe(1);

    sqlite.close();
  });
});
