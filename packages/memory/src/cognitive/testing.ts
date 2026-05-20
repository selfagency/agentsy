import type { MemoryItem, MemoryKind, ReuseClass, WriteHeap } from './tier-types.js';

export interface TierTestClock {
  now: () => number;
  advance: (ms: number) => void;
  set: (ms: number) => void;
}

export function createTierTestClock(startMs: number = 10_000): TierTestClock {
  let current = startMs;

  return {
    now(): number {
      return current;
    },

    advance(ms: number): void {
      current += ms;
    },

    set(ms: number): void {
      current = ms;
    }
  };
}

export interface TestMemoryItemOptions {
  id?: string;
  kind?: MemoryKind;
  content?: string;
  tokenCount?: number;
  importance?: number;
  writeHeap?: WriteHeap;
  reuseClass?: ReuseClass;
  createdAt?: number;
  lastAccessedAt?: number;
  accessCount?: number;
  fingerprint?: string;
  metadata?: Record<string, unknown>;
}

let itemIdCounter = 0;

export function createTestMemoryItem(options: TestMemoryItemOptions = {}): MemoryItem {
  itemIdCounter++;
  const now = options.createdAt ?? performance.now();

  return {
    id: options.id ?? `test-item-${itemIdCounter}`,
    kind: options.kind ?? 'episodic',
    content: options.content ?? `Test content ${itemIdCounter}`,
    tokenCount: options.tokenCount ?? 10,
    importance: options.importance ?? 0.5,
    writeHeap: options.writeHeap ?? 'event',
    reuseClass: options.reuseClass ?? 'warm',
    createdAt: now,
    lastAccessedAt: options.lastAccessedAt ?? now,
    accessCount: options.accessCount ?? 0,
    fingerprint: options.fingerprint ?? `fp-${itemIdCounter}`,
    metadata: options.metadata ?? {}
  };
}

export function resetTestItemIdCounter(): void {
  itemIdCounter = 0;
}
