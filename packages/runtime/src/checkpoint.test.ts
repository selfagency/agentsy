import type { SessionStore } from '@agentsy/types';
import { describe, expect, it, vi } from 'vitest';

import { checkpoint, clearCheckpoint, loadCheckpoint } from './checkpoint.js';

describe('checkpoint', () => {
  it('saves a checkpoint to the store', () => {
    const store: Pick<SessionStore, 'setValue'> = { setValue: vi.fn() };

    const cp = checkpoint(
      {
        pendingToolCalls: [{ id: 'call_1', name: 'search', args: ['hello'] }],
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
    const store: Pick<SessionStore, 'getValue'> = { getValue: vi.fn().mockReturnValue(null) };
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
    const store: Pick<SessionStore, 'getValue'> = { getValue: vi.fn().mockReturnValue(cp) };

    const result = loadCheckpoint(store);
    expect(result).toEqual(cp);
  });

  it('returns null for invalid structure', () => {
    const store: Pick<SessionStore, 'getValue'> = {
      getValue: vi.fn().mockReturnValue({ id: 123 })
    };
    expect(loadCheckpoint(store)).toBeNull();
  });
});

describe('clearCheckpoint', () => {
  it('deletes the checkpoint key', () => {
    const store: Pick<SessionStore, 'removeValue'> = { removeValue: vi.fn() };
    clearCheckpoint(store);
    expect(store.removeValue).toHaveBeenCalledWith('runtime_checkpoint');
  });
});
