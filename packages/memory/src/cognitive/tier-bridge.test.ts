import { beforeEach, describe, expect, it } from 'vitest';

import { createCompressor } from './compressor.js';
import { createLongTermMemory } from './long-term-memory.js';
import { createSensoryBuffer } from './sensory-buffer.js';
import { createSensoryRegister } from './sensory-register.js';
import { createShortTermMemory } from './short-term-memory.js';
import { createSummarizer } from './summarizer.js';
import { createSynthesizer } from './synthesizer.js';
import { createTestMemoryItem, createTierTestClock, resetTestItemIdCounter } from './testing.js';
import { createTierBridge, createTierBridgeWithData } from './tier-bridge.js';
import { createWorkingMemory } from './working-memory.js';

describe('createTierBridge', () => {
  it('creates bridge with from/to names', () => {
    const bridge = createTierBridge({ from: 'sensory_buffer', to: 'sensory_register' });
    expect(bridge.from).toBe('sensory_buffer');
    expect(bridge.to).toBe('sensory_register');
  });

  it('canTransfer returns true by default', () => {
    const bridge = createTierBridge({ from: 'sensory_buffer', to: 'sensory_register' });
    expect(bridge.canTransfer()).toBe(true);
  });

  it('transfer applies identity transform by default', () => {
    const bridge = createTierBridge({ from: 'sensory_buffer', to: 'sensory_register' });
    const items = [createTestMemoryItem()];
    const count = bridge.transfer(items, 'consolidation');
    expect(count).toBe(1);
  });

  it('transfer applies custom transform', () => {
    const bridge = createTierBridge({
      from: 'sensory_buffer',
      to: 'sensory_register',
      transform: items => items.filter(i => i.importance > 0.5)
    });
    const items = [createTestMemoryItem({ importance: 0.9 }), createTestMemoryItem({ importance: 0.2 })];
    const count = bridge.transfer(items, 'consolidation');
    expect(count).toBe(1);
  });
});

describe('createTierBridgeWithData', () => {
  let clock: ReturnType<typeof createTierTestClock>;

  beforeEach(() => {
    clock = createTierTestClock(10_000);
    resetTestItemIdCounter();
  });

  it('promotes items between tiers', () => {
    const source = createSensoryBuffer({ now: clock.now });
    const target = createSensoryRegister({ now: clock.now });

    const bridge = createTierBridgeWithData({ from: 'sensory_buffer', to: 'sensory_register' }, source, target);

    source.write(createTestMemoryItem({ importance: 0.8, tokenCount: 10, createdAt: clock.now() }));
    source.write(createTestMemoryItem({ importance: 0.3, tokenCount: 10, createdAt: clock.now() }));

    const promoted = bridge.promoteItems(1);
    expect(promoted).toBe(1);
    expect(source.items()).toHaveLength(1);
    expect(target.items()).toHaveLength(1);
    expect(target.items()[0]?.importance).toBe(0.8);
  });

  it('bridge integration — insert items then promote across tiers', () => {
    const source = createSensoryBuffer({ now: clock.now });
    const target = createSensoryRegister({ now: clock.now });

    const bridge = createTierBridgeWithData({ from: 'sensory_buffer', to: 'sensory_register' }, source, target);

    for (let i = 0; i < 10; i++) {
      source.write(createTestMemoryItem({ importance: 0.3 + i * 0.07, tokenCount: 5, createdAt: clock.now() }));
    }

    expect(source.items()).toHaveLength(10);
    const promoted = bridge.promoteItems(4);
    expect(promoted).toBe(4);
    expect(source.items()).toHaveLength(6);
    expect(target.items()).toHaveLength(4);
  });

  it('compressAndPromote uses compressor to move items', () => {
    const source = createSensoryRegister({ now: clock.now });
    const target = createWorkingMemory({ now: clock.now });
    const compressor = createCompressor({ now: clock.now });

    const bridge = createTierBridgeWithData(
      { from: 'sensory_register', to: 'working_memory', compressor },
      source,
      target
    );

    for (let i = 0; i < 4; i++) {
      source.write(createTestMemoryItem({ tokenCount: 30, createdAt: clock.now() }));
    }

    const promoted = bridge.compressAndPromote(4, 200);
    expect(promoted).toBeGreaterThan(0);
    expect(target.items().length).toBeGreaterThan(0);
  });

  it('synthesizeAndPromote uses synthesizer to merge items', () => {
    const source = createWorkingMemory({ now: clock.now });
    const target = createShortTermMemory({ now: clock.now });
    const synthesizer = createSynthesizer({ now: clock.now, similarityThreshold: 0.1 });

    const bridge = createTierBridgeWithData(
      { from: 'working_memory', to: 'short_term_memory', synthesizer },
      source,
      target
    );

    for (let i = 0; i < 7; i++) {
      source.write(
        createTestMemoryItem({
          content: 'Authentication OAuth2 token validation',
          tokenCount: 30,
          createdAt: clock.now()
        })
      );
    }

    const promoted = bridge.synthesizeAndPromote(7, 500);
    expect(promoted).toBeGreaterThan(0);
    expect(target.items().length).toBeGreaterThan(0);
  });

  it('summarizeAndPromote uses summarizer for long-term storage', () => {
    const source = createShortTermMemory({ now: clock.now });
    const target = createLongTermMemory({ now: clock.now });
    const summarizer = createSummarizer({ now: clock.now });

    const bridge = createTierBridgeWithData(
      { from: 'short_term_memory', to: 'long_term_memory', summarizer },
      source,
      target
    );

    for (let i = 0; i < 5; i++) {
      source.write(
        createTestMemoryItem({
          content: 'Error occurred during database connection timeout.',
          tokenCount: 30,
          createdAt: clock.now()
        })
      );
    }

    const promoted = bridge.summarizeAndPromote(5, 500);
    expect(promoted).toBeGreaterThan(0);
    expect(target.items().length).toBeGreaterThan(0);
  });
});

describe('full pipeline integration', () => {
  let clock: ReturnType<typeof createTierTestClock>;

  beforeEach(() => {
    clock = createTierTestClock(10_000);
    resetTestItemIdCounter();
  });

  it('insert event → SensoryBuffer → flows through all tiers → produces long-term item', () => {
    const sensoryBuffer = createSensoryBuffer({ now: clock.now });
    const sensoryRegister = createSensoryRegister({ now: clock.now });
    const workingMemory = createWorkingMemory({ now: clock.now });
    const shortTermMemory = createShortTermMemory({ now: clock.now });
    const longTermMemory = createLongTermMemory({ now: clock.now });

    const compressor = createCompressor({ now: clock.now });
    const synthesizer = createSynthesizer({ now: clock.now, similarityThreshold: 0.1 });
    const summarizer = createSummarizer({ now: clock.now });

    const bridge12 = createTierBridgeWithData(
      { from: 'sensory_buffer', to: 'sensory_register' },
      sensoryBuffer,
      sensoryRegister
    );
    const bridge23 = createTierBridgeWithData(
      { from: 'sensory_register', to: 'working_memory', compressor },
      sensoryRegister,
      workingMemory
    );
    const bridge34 = createTierBridgeWithData(
      { from: 'working_memory', to: 'short_term_memory', synthesizer },
      workingMemory,
      shortTermMemory
    );
    const bridge45 = createTierBridgeWithData(
      { from: 'short_term_memory', to: 'long_term_memory', summarizer },
      shortTermMemory,
      longTermMemory
    );

    // Insert 10 events into SensoryBuffer
    for (let i = 0; i < 10; i++) {
      sensoryBuffer.write(
        createTestMemoryItem({
          content: 'Error occurred during database connection timeout.',
          tokenCount: 5,
          createdAt: clock.now()
        })
      );
    }

    // Bridge 1→2: promote
    bridge12.promoteItems(4);
    expect(sensoryRegister.items().length).toBeGreaterThan(0);

    // Bridge 2→3: compress and promote
    bridge23.compressAndPromote(4, 500);
    expect(workingMemory.items().length).toBeGreaterThan(0);

    // Bridge 3→4: synthesize and promote
    bridge34.synthesizeAndPromote(7, 500);
    expect(shortTermMemory.items().length).toBeGreaterThan(0);

    // Bridge 4→5: summarize and promote
    bridge45.summarizeAndPromote(12, 500);
    expect(longTermMemory.items().length).toBeGreaterThan(0);
  });
});
