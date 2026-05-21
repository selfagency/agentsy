import { describe, expect, it, beforeEach } from 'vitest';

import { createInMemoryPubSubManager } from '../coordination/pub-sub-manager.js';
import { createInMemoryScheduler } from '../coordination/scheduler.js';
import { createLongTermMemory } from './long-term-memory.js';
import { createSensoryBuffer } from './sensory-buffer.js';
import { createSensoryRegister } from './sensory-register.js';
import { createShortTermMemory } from './short-term-memory.js';
import { createTierTestClock, createTestMemoryItem, resetTestItemIdCounter } from './testing.js';
import { createTierScheduler } from './tier-scheduler.js';
import { createWorkingMemory } from './working-memory.js';

describe('createTierScheduler', () => {
  let clock: ReturnType<typeof createTierTestClock>;

  beforeEach(() => {
    clock = createTierTestClock(10_000);
    resetTestItemIdCounter();
  });

  it('creates a scheduler that is not running by default', () => {
    const tierScheduler = createTierScheduler({}, { now: clock.now });
    expect(tierScheduler.isRunning()).toBe(false);
  });

  it('runs a decay pass and returns results', () => {
    const sensoryBuffer = createSensoryBuffer({ now: clock.now });
    const workingMemory = createWorkingMemory({ now: clock.now });
    const longTermMemory = createLongTermMemory({ now: clock.now });

    sensoryBuffer.write(createTestMemoryItem({ importance: 0.8, tokenCount: 5, createdAt: clock.now() }));
    workingMemory.write(createTestMemoryItem({ importance: 0.6, tokenCount: 10, createdAt: clock.now() }));
    longTermMemory.write(createTestMemoryItem({ importance: 0.9, tokenCount: 20, createdAt: clock.now() }));

    const tierScheduler = createTierScheduler(
      { sensory_buffer: sensoryBuffer, working_memory: workingMemory, long_term_memory: longTermMemory },
      { now: clock.now }
    );

    const result = tierScheduler.runDecayPass();
    expect(result.kept).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('starts and stops scheduling', () => {
    const coordScheduler = createInMemoryScheduler();
    const tierScheduler = createTierScheduler({}, { now: clock.now, scheduler: coordScheduler, intervalMs: 1000 });

    tierScheduler.start();
    expect(tierScheduler.isRunning()).toBe(true);

    tierScheduler.stop();
    expect(tierScheduler.isRunning()).toBe(false);
    expect(coordScheduler.pendingCount()).toBe(0);
  });

  it('emits events via PubSubManager on decay pass', () => {
    const pubsub = createInMemoryPubSubManager();
    const received: unknown[] = [];
    pubsub.subscribe('agentsy:memory:tier-scheduler', (payload: unknown) => {
      received.push(payload);
    });

    const tierScheduler = createTierScheduler({}, { now: clock.now, pubsub });
    tierScheduler.runDecayPass();

    expect(received).toHaveLength(1);
    const event = received[0] as Record<string, unknown>;
    expect(event).toHaveProperty('kept');
    expect(event).toHaveProperty('promoted');
    expect(event).toHaveProperty('demoted');
    expect(event).toHaveProperty('discarded');
    expect(event).toHaveProperty('durationMs');
    expect(event).toHaveProperty('timestamp');
  });

  it('detects items needing action after time passes', () => {
    const sensoryBuffer = createSensoryBuffer({ now: clock.now });
    sensoryBuffer.write(createTestMemoryItem({ importance: 0.5, tokenCount: 5, createdAt: clock.now() }));

    const tierScheduler = createTierScheduler(
      {
        sensory_buffer: sensoryBuffer,
        sensory_register: createSensoryRegister({ now: clock.now }),
        working_memory: createWorkingMemory({ now: clock.now }),
        short_term_memory: createShortTermMemory({ now: clock.now }),
        long_term_memory: createLongTermMemory({ now: clock.now })
      },
      { now: clock.now }
    );

    const freshResult = tierScheduler.runDecayPass();
    expect(freshResult.kept).toBeGreaterThan(0);

    clock.advance(10_000);
    const tierScheduler2 = createTierScheduler(
      {
        sensory_buffer: sensoryBuffer,
        sensory_register: createSensoryRegister({ now: clock.now }),
        working_memory: createWorkingMemory({ now: clock.now }),
        short_term_memory: createShortTermMemory({ now: clock.now }),
        long_term_memory: createLongTermMemory({ now: clock.now })
      },
      { now: clock.now }
    );
    const agedResult = tierScheduler2.runDecayPass();
    expect(agedResult.discarded + agedResult.demoted + agedResult.kept).toBeGreaterThan(0);
  });
});
