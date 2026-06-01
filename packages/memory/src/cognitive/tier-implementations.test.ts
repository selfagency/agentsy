import { beforeEach, describe, expect, it } from 'vitest';

import { createLongTermMemory } from './long-term-memory.js';
import { createSensoryBuffer } from './sensory-buffer.js';
import { createSensoryRegister } from './sensory-register.js';
import { createShortTermMemory } from './short-term-memory.js';
import { createTestMemoryItem, createTierTestClock, resetTestItemIdCounter } from './testing.js';
import { createWorkingMemory } from './working-memory.js';

describe('concrete tier implementations', () => {
  let clock: ReturnType<typeof createTierTestClock>;

  beforeEach(() => {
    clock = createTierTestClock(10_000);
    resetTestItemIdCounter();
  });

  it('createSensoryBuffer has correct defaults', () => {
    const tier = createSensoryBuffer({ now: clock.now });
    expect(tier.name).toBe('sensory_buffer');
    expect(tier.level).toBe(1);
    expect(tier.config.maxTokens).toBe(200);
    expect(tier.config.maxItems).toBe(50);
    expect(tier.config.ttlMs).toBe(5000);
    expect(tier.config.consolidationThreshold).toBe(0.6);
  });

  it('createSensoryRegister has correct defaults', () => {
    const tier = createSensoryRegister({ now: clock.now });
    expect(tier.name).toBe('sensory_register');
    expect(tier.level).toBe(2);
    expect(tier.config.maxTokens).toBe(400);
    expect(tier.config.maxItems).toBe(4);
    expect(tier.config.ttlMs).toBe(2000);
  });

  it('createWorkingMemory has correct defaults', () => {
    const tier = createWorkingMemory({ now: clock.now });
    expect(tier.name).toBe('working_memory');
    expect(tier.level).toBe(3);
    expect(tier.config.maxTokens).toBe(1000);
    expect(tier.config.maxItems).toBe(7);
    expect(tier.config.ttlMs).toBe(30_000);
  });

  it('createShortTermMemory has correct defaults', () => {
    const tier = createShortTermMemory({ now: clock.now });
    expect(tier.name).toBe('short_term_memory');
    expect(tier.level).toBe(4);
    expect(tier.config.maxTokens).toBe(2000);
    expect(tier.config.maxItems).toBe(12);
    expect(tier.config.ttlMs).toBe(3_600_000);
  });

  it('createLongTermMemory has correct defaults', () => {
    const tier = createLongTermMemory({ now: clock.now });
    expect(tier.name).toBe('long_term_memory');
    expect(tier.level).toBe(5);
    expect(tier.config.maxTokens).toBe(Number.POSITIVE_INFINITY);
    expect(tier.config.maxItems).toBe(Number.POSITIVE_INFINITY);
    expect(tier.config.ttlMs).toBe(Number.POSITIVE_INFINITY);
  });

  it('sensory buffer overflow is rejected', () => {
    const tier = createSensoryBuffer({ now: clock.now });
    // 50 items max, write 51
    for (let i = 0; i < 50; i++) {
      tier.write(createTestMemoryItem({ tokenCount: 1, createdAt: clock.now() }));
    }
    const result = tier.write(createTestMemoryItem({ tokenCount: 1, createdAt: clock.now() }));
    expect(result).toBeNull();
  });

  it('sensory register overflow is rejected at 4 items', () => {
    const tier = createSensoryRegister({ now: clock.now });
    for (let i = 0; i < 4; i++) {
      expect(tier.write(createTestMemoryItem({ tokenCount: 50, createdAt: clock.now() }))).not.toBeNull();
    }
    expect(tier.write(createTestMemoryItem({ tokenCount: 50, createdAt: clock.now() }))).toBeNull();
  });

  it('long-term memory never rejects based on capacity', () => {
    const tier = createLongTermMemory({ now: clock.now });
    for (let i = 0; i < 100; i++) {
      expect(tier.write(createTestMemoryItem({ tokenCount: 100, createdAt: clock.now() }))).not.toBeNull();
    }
    expect(tier.items()).toHaveLength(100);
  });

  it('sensory buffer TTL expiration works with injectable clock', () => {
    const tier = createSensoryBuffer({ now: clock.now });
    tier.write(createTestMemoryItem({ tokenCount: 10, createdAt: clock.now() }));
    expect(tier.items()).toHaveLength(1);
    clock.advance(6000); // past 5000ms TTL
    expect(tier.read().items).toHaveLength(0);
  });

  it('custom config overrides defaults', () => {
    const tier = createSensoryBuffer({ config: { maxTokens: 500 }, now: clock.now });
    expect(tier.config.maxTokens).toBe(500);
    // other defaults preserved
    expect(tier.config.maxItems).toBe(50);
    expect(tier.config.ttlMs).toBe(5000);
  });
});
