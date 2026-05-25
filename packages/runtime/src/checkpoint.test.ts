import { describe, expect, it, vi } from 'vitest';

import { checkpoint, loadCheckpoint, clearCheckpoint } from './checkpoint.js';

describe('checkpoint', () => {
  it('saves a checkpoint to the store', async () => {
    const store = { setValue: vi.fn(), getValue: vi.fn(), deleteValue: vi.fn() };

    const cp = await checkpoint(
      {
        pendingToolCalls: [{ id: 'call_1', name: 'search', args: { q: 'hello' } }],
        messageQueue: [{ role: 'user', content: 'hello' }],
        subagentStates: []
      },
      store
    );

    expect(cp.id).toBeDefined();
    expect(cp.timestamp).toBeGreaterThan(0);
    expect(cp.pendingToolCalls).toHaveLength(1);
    expect(cp.messageQueue).toHaveLength(1);
    expect(store.setValue).toHaveBeenCalledWith('runtime_checkpoint', cp);
  });
});

describe('loadCheckpoint', () => {
  it('returns null when no checkpoint exists', () => {
    const store = { getValue: vi.fn().mockReturnValue(null) } as any;
    expect(loadCheckpoint(store)).toBeNull();
  });

  it('returns the checkpoint when found', () => {
    const cp = {
      id: 'rtchk_1',
      timestamp: Date.now(),
      pendingToolCalls: [],
      messageQueue: [],
      subagentStates: []
    };
    const store = { getValue: vi.fn().mockReturnValue(cp) } as any;

    const result = loadCheckpoint(store);
    expect(result).toEqual(cp);
  });

  it('returns null for invalid structure', () => {
    const store = { getValue: vi.fn().mockReturnValue({ id: 123 }) } as any;
    expect(loadCheckpoint(store)).toBeNull();
  });
});

describe('clearCheckpoint', () => {
  it('deletes the checkpoint key', () => {
    const store = { removeValue: vi.fn() } as any;
    clearCheckpoint(store);
    expect(store.removeValue).toHaveBeenCalledWith('runtime_checkpoint');
  });
});
