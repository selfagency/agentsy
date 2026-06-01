import { describe, expect, it } from 'vitest';

import { createMemoryEngine } from '../cognitive/memory-engine.js';
import { onSessionEnd } from './on-session-end.js';
import { onSessionStart } from './on-session-start.js';

describe('on-session-start hook', () => {
  it('should run awaken and return warm memories', async () => {
    const engine = createMemoryEngine();
    engine.ingest('important context');
    engine.ingest('another memory');

    const result = await onSessionStart({ engine });

    expect(result.warmMemories).toBeInstanceOf(Array);
    expect(result.budgetAvailable).toBeGreaterThanOrEqual(0);
    expect(result.budgetAvailable).toBeLessThanOrEqual(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.awakenResult).toBeDefined();
  });

  it('should accept pending events', async () => {
    const engine = createMemoryEngine();

    const result = await onSessionStart({
      engine,
      pendingEvents: [{ content: 'pending event 1', importance: 0.7 }, { content: 'pending event 2' }]
    });

    expect(result.awakenResult.pendingIngested).toBeGreaterThan(0);
  });

  it('should include tier capacity info', async () => {
    const engine = createMemoryEngine();

    const result = await onSessionStart({ engine });

    expect(result.tierCapacity).toHaveProperty('sensory_buffer');
    expect(result.tierCapacity).toHaveProperty('long_term_memory');
  });
});

describe('on-session-end hook', () => {
  it('should ingest session events and consolidate', async () => {
    const engine = createMemoryEngine();

    const result = await onSessionEnd({
      engine,
      sessionEvents: [{ content: 'final event 1' }, { content: 'final event 2', importance: 0.8 }]
    });

    expect(result.persisted).toBe(2);
    expect(result.consolidated).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should work with no session events', async () => {
    const engine = createMemoryEngine();

    const result = await onSessionEnd({ engine });

    expect(result.persisted).toBe(0);
    expect(result.consolidated).toBeGreaterThanOrEqual(0);
  });

  it('should respect persist flag', async () => {
    const engine = createMemoryEngine();

    const result = await onSessionEnd({ engine, persist: false });

    expect(result.persisted).toBe(0);
  });
});
