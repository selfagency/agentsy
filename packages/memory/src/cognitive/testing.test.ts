import { describe, expect, it, beforeEach } from 'vitest';

import { createTierTestClock, createTestMemoryItem, resetTestItemIdCounter } from './testing.js';

describe('createTierTestClock', () => {
  it('starts at given time', () => {
    const clock = createTierTestClock(5_000);
    expect(clock.now()).toBe(5_000);
  });

  it('advances time', () => {
    const clock = createTierTestClock(10_000);
    clock.advance(1_500);
    expect(clock.now()).toBe(11_500);
  });

  it('sets absolute time', () => {
    const clock = createTierTestClock(10_000);
    clock.set(50_000);
    expect(clock.now()).toBe(50_000);
  });
});

describe('createTestMemoryItem', () => {
  beforeEach(() => {
    resetTestItemIdCounter();
  });

  it('creates item with sensible defaults', () => {
    const item = createTestMemoryItem();
    expect(item.id).toBe('test-item-1');
    expect(item.kind).toBe('episodic');
    expect(item.tokenCount).toBe(10);
    expect(item.importance).toBe(0.5);
    expect(item.writeHeap).toBe('event');
    expect(item.reuseClass).toBe('warm');
    expect(item.accessCount).toBe(0);
    expect(item.metadata).toEqual({});
  });

  it('allows overriding specific fields', () => {
    const item = createTestMemoryItem({
      importance: 0.9,
      kind: 'semantic',
      tokenCount: 50,
      content: 'custom content'
    });
    expect(item.importance).toBe(0.9);
    expect(item.kind).toBe('semantic');
    expect(item.tokenCount).toBe(50);
    expect(item.content).toBe('custom content');
  });

  it('auto-increments id', () => {
    const a = createTestMemoryItem();
    const b = createTestMemoryItem();
    expect(a.id).toBe('test-item-1');
    expect(b.id).toBe('test-item-2');
  });

  it('respects custom createdAt', () => {
    const item = createTestMemoryItem({ createdAt: 42_000, lastAccessedAt: 42_000 });
    expect(item.createdAt).toBe(42_000);
    expect(item.lastAccessedAt).toBe(42_000);
  });
});
