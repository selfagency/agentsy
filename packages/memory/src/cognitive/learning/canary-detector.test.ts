import { describe, expect, it } from 'vitest';

import type { MemoryItem } from '../tier-types.js';
import { createCanaryDetector } from './canary-detector.js';
import type { Observation } from './observation-extractor.js';

function makeMemory(id: string, content: string, importance: number = 0.8, accessCount: number = 5): MemoryItem {
  const now = 1_000_000;
  return {
    id,
    kind: 'semantic',
    content,
    tokenCount: 10,
    importance,
    writeHeap: 'event',
    reuseClass: 'hot',
    createdAt: now - 1_000,
    lastAccessedAt: now - 100,
    accessCount,
    fingerprint: `fp-${id}`,
    metadata: { originalImportance: importance }
  };
}

function makeObs(id: string, content: string): Observation {
  return {
    id,
    kind: 'factual',
    content,
    sourceMemoryId: 'mem-test',
    confidence: 0.7,
    contradictsWith: [],
    supportsIds: [],
    extractedAt: 1_000_000
  };
}

describe('CanaryDetector', () => {
  const detector = createCanaryDetector();

  it('marks healthy memory as keep', () => {
    const memory = makeMemory('1', 'User likes dark mode');
    const result = detector.check(memory, []);
    expect(result.status).toBe('healthy');
    expect(result.action).toBe('keep');
  });

  it('marks stale memory as refresh', () => {
    const memory = makeMemory('1', 'User likes dark mode');
    memory.lastAccessedAt = 1_000_000 - 8 * 24 * 60 * 60 * 1_000; // 8 days ago
    const result = detector.check(memory, []);
    expect(result.status).toBe('stale');
    expect(result.action).toBe('refresh');
  });

  it('marks degraded memory as demote', () => {
    const memory = makeMemory('1', 'User likes dark mode', 0.3);
    memory.metadata = { originalImportance: 0.9 };
    const result = detector.check(memory, []);
    expect(result.status).toBe('degraded');
    expect(result.action).toBe('demote');
  });

  it('marks contradicted memory as flag_for_review', () => {
    const memory = makeMemory('1', 'User likes dark mode');
    const obs = [makeObs('c1', 'User dislikes dark mode')];
    const result = detector.check(memory, obs);
    expect(result.action).toBe('flag_for_review');
    expect(result.status).toBe('contradicted');
  });

  it('returns nextCheckMs in the future', () => {
    const memory = makeMemory('1', 'Test');
    const result = detector.check(memory, []);
    expect(result.nextCheckMs).toBeGreaterThan(0);
  });

  it('checks batch of memories', () => {
    const memories = [makeMemory('1', 'A'), makeMemory('2', 'B')];
    const results = detector.checkBatch(memories, []);
    expect(results.length).toBe(2);
  });
});
