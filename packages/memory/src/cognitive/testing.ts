import type { MemoryItem, MemoryKind, ReuseClass, WriteHeap } from './tier-types.js';

export interface TierTestClock {
  advance: (ms: number) => void;
  now: () => number;
  set: (ms: number) => void;
}

export function createTierTestClock(startMs = 10_000): TierTestClock {
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
  accessCount?: number;
  content?: string;
  createdAt?: number;
  fingerprint?: string;
  id?: string;
  importance?: number;
  kind?: MemoryKind;
  lastAccessedAt?: number;
  metadata?: Record<string, unknown>;
  reuseClass?: ReuseClass;
  tokenCount?: number;
  writeHeap?: WriteHeap;
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
