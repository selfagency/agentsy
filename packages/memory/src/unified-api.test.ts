import { describe, expect, it, vi } from 'vitest';
import { createUnifiedMemory } from './unified-api.js';

function makeEngine() {
  return {
    ingest: vi.fn(),
    recall: vi.fn().mockReturnValue([]),
    reset: vi.fn(),
    awaken: vi.fn(),
    budget: {} as never,
    scheduler: {} as never,
    snapshot: vi.fn(),
    stats: vi.fn(),
    tiers: {} as never
  };
}

function makeWiki() {
  return {
    upsertPage: vi.fn().mockResolvedValue(undefined)
  };
}

function makeSessionStore() {
  return {
    getRecent: vi.fn().mockResolvedValue([])
  };
}

describe('createUnifiedMemory', () => {
  describe('remember', () => {
    it('stores a qa entry', async () => {
      const engine = makeEngine();
      const wiki = makeWiki();
      const memory = createUnifiedMemory({ engine, wiki });

      const result = await memory.remember({ type: 'qa', question: 'What is X?', answer: 'X is Y' });

      expect(result.status).toBe('session_stored');
      expect(engine.ingest).toHaveBeenCalled();
    });

    it('stores to session cache when sessionId is provided', async () => {
      const engine = makeEngine();
      const wiki = makeWiki();
      const sessionStore = makeSessionStore();
      const memory = createUnifiedMemory({ engine, wiki, sessionStore });

      await memory.remember(
        { type: 'fact', content: 'dark mode preferred', confidence: 0.9, kind: 'user_preference' },
        's1'
      );

      expect(engine.ingest).toHaveBeenCalled();
      expect(sessionStore.getRecent).toHaveBeenCalled();
    });

    it('returns a RememberResult', async () => {
      const engine = makeEngine();
      const wiki = makeWiki();
      const memory = createUnifiedMemory({ engine, wiki });

      const result = await memory.remember({
        type: 'trace',
        toolName: 'fs_read',
        status: 'success',
        args: {},
        result: {}
      });

      expect(result.entryType).toBe('trace');
      expect(result.done).toBe(true);
    });

    it('extracts facts from qa entries when extractor is provided', async () => {
      const engine = makeEngine();
      const wiki = makeWiki();
      const extractor = {
        extract: vi.fn().mockResolvedValue([{ content: 'X is Y', confidence: 0.9, kind: 'entity' }])
      };
      const memory = createUnifiedMemory({ engine, wiki, extractor: extractor as never });

      await memory.remember({ type: 'qa', question: 'What is X?', answer: 'X is Y' });

      expect(extractor.extract).toHaveBeenCalled();
      expect(engine.ingest).toHaveBeenCalledTimes(2);
    });
  });

  describe('recall', () => {
    it('returns empty array when nothing matches', async () => {
      const engine = makeEngine();
      const wiki = makeWiki();
      const memory = createUnifiedMemory({ engine, wiki });

      const results = await memory.recall('nothing exists');

      expect(results).toEqual([]);
    });

    it('returns results from engine recall', async () => {
      const engine = makeEngine();
      engine.recall = vi
        .fn()
        .mockReturnValue([{ tierName: 'stm', items: [{ id: '1', content: 'dark mode preferred', importance: 0.8 }] }]);
      const wiki = makeWiki();
      const memory = createUnifiedMemory({ engine, wiki });

      const results = await memory.recall('dark mode');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?._source).toBe('graph');
    });

    it('routes query by strategy', async () => {
      const engine = makeEngine();
      engine.recall = vi
        .fn()
        .mockReturnValue([
          { tierName: 'stm', items: [{ id: '1', content: 'function foo() { return 1 }', importance: 0.8 }] }
        ]);
      const wiki = makeWiki();
      const memory = createUnifiedMemory({ engine, wiki });

      const results = await memory.recall('code review best practices');

      expect(results.length).toBeGreaterThan(0);
    });

    it('scopes to session when scope=session', async () => {
      const engine = makeEngine();
      const wiki = makeWiki();
      const sessionStore = makeSessionStore();
      sessionStore.getRecent = vi.fn().mockResolvedValue([{ content: 'session data', id: 's1', score: 0.9 }]);
      const memory = createUnifiedMemory({ engine, wiki, sessionStore });

      const results = await memory.recall('dark mode', { sessionId: 's1', scope: 'session' });

      expect(results.length).toBe(1);
      expect(results[0]?._source).toBe('session');
    });
  });

  describe('forget', () => {
    it('resets the engine', () => {
      const engine = makeEngine();
      const wiki = makeWiki();
      const memory = createUnifiedMemory({ engine, wiki });

      memory.forget();

      expect(engine.reset).toHaveBeenCalled();
    });
  });

  describe('improve', () => {
    it('returns synced=0 (no-op for now)', () => {
      const engine = makeEngine();
      const wiki = makeWiki();
      const memory = createUnifiedMemory({ engine, wiki });

      const result = memory.improve({ sessionIds: ['s1'] });

      expect(result.synced).toBe(0);
    });
  });
});
