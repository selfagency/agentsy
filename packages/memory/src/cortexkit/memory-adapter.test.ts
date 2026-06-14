import { describe, expect, it } from 'vitest';
import { createMemoryBridge } from './memory-adapter.js';

describe('Memory bridge', () => {
  it('maps MC categories to wiki kinds', () => {
    const bridge = createMemoryBridge({} as any);
    expect(bridge.mapCategory('PROJECT_RULES')).toBe('rule');
    expect(bridge.mapCategory('ARCHITECTURE')).toBe('architecture');
    expect(bridge.mapCategory('CONSTRAINTS')).toBe('constraint');
    expect(bridge.mapCategory('CONFIG_VALUES')).toBe('config');
    expect(bridge.mapCategory('NAMING')).toBe('naming');
    expect(bridge.mapCategory('UNKNOWN')).toBe('note');
  });

  it('converts a MC memory to wiki entry', () => {
    const bridge = createMemoryBridge({} as any);
    const entry = bridge.toWikiEntry({
      id: 1,
      content: 'Use functional patterns',
      category: 'CONSTRAINTS',
      importance: 0.8,
      created_at: '2026-01-01',
      updated_at: '2026-06-01'
    });

    expect(entry.content).toBe('Use functional patterns');
    expect(entry.kind).toBe('constraint');
    expect(entry.importance).toBe(0.8);
  });
});
