import { describe, expect, it } from 'vitest';

import { createDriftMonitor } from './drift-monitor.js';

describe('createDriftMonitor', () => {
  it('tracks coherence over compression cycles', () => {
    const monitor = createDriftMonitor();

    monitor.recordCompression({ cycle: 1, coherence: 0.95, droppedMessages: 0 });
    monitor.recordCompression({ cycle: 2, coherence: 0.92, droppedMessages: 5 });

    const stats = monitor.getStats();
    expect(stats.cycles).toBe(2);
    expect(stats.minCoherence).toBe(0.92);
    expect(stats.avgCoherence).toBeCloseTo(0.935, 3);
  });

  it('flags drift when coherence drops below threshold', () => {
    const monitor = createDriftMonitor({ driftThreshold: 0.7 });

    monitor.recordCompression({ cycle: 1, coherence: 0.75, droppedMessages: 0 });
    monitor.recordCompression({ cycle: 2, coherence: 0.65, droppedMessages: 10 });

    expect(monitor.isDrifting()).toBe(true);
  });
});
