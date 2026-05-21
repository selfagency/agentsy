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

function nextTestId(): string {
  itemIdCounter++;
  return `test-item-${itemIdCounter}`;
}

export function createTestMemoryItem({
  id,
  kind = 'episodic',
  content,
  tokenCount = 10,
  importance = 0.5,
  writeHeap = 'event',
  reuseClass = 'warm',
  createdAt,
  lastAccessedAt,
  accessCount = 0,
  fingerprint,
  metadata = {}
}: TestMemoryItemOptions = {}): MemoryItem {
  const now = createdAt ?? performance.now();

  return {
    id: id ?? nextTestId(),
    kind,
    content: content ?? `Test content ${itemIdCounter}`,
    tokenCount,
    importance,
    writeHeap,
    reuseClass,
    createdAt: now,
    lastAccessedAt: lastAccessedAt ?? now,
    accessCount,
    fingerprint: fingerprint ?? `fp-${itemIdCounter}`,
    metadata
  };
}

export function resetTestItemIdCounter(): void {
  itemIdCounter = 0;
}
