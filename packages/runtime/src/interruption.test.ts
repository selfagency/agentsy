import { describe, expect, it, vi } from 'vitest';

import { createInterruption, resumeFromCheckpoint } from './interruption.js';

describe('createInterruption', () => {
  it('creates a checkpoint with the given reason and snapshot', async () => {
    const store = { setValue: vi.fn(), getValue: vi.fn() };
    const snapshot = {
      sessionId: 'sess_1',
      depth: 0,
      completedTaskIds: [],
      results: [],
      childSnapshots: [],
      updatedAt: Date.now()
    } as any;

    const checkpoint = await createInterruption('sess_1', 'user interrupted', snapshot, store);

    expect(checkpoint.sessionId).toBe('sess_1');
    expect(checkpoint.reason).toBe('user interrupted');
    expect(checkpoint.snapshot).toEqual(snapshot);
    expect(store.setValue).toHaveBeenCalledWith(expect.stringContaining('interruption_checkpoint:'), checkpoint);
  });

  it('includes metadata when provided', async () => {
    const store = { setValue: vi.fn(), getValue: vi.fn() };
    const snapshot = {} as any;

    const checkpoint = await createInterruption('sess_1', 'error', snapshot, store, {
      pendingToolCallId: 'call_123'
    });

    expect(checkpoint.metadata).toEqual({ pendingToolCallId: 'call_123' });
  });
});

describe('resumeFromCheckpoint', () => {
  it('returns null when no checkpoint exists', async () => {
    const store = { getValue: vi.fn().mockReturnValue(null) };
    const result = await resumeFromCheckpoint('chk_123', store as any);
    expect(result).toBeNull();
  });

  it('returns the checkpoint when found', async () => {
    const checkpoint = {
      id: 'chk_123',
      sessionId: 'sess_1',
      reason: 'interrupted',
      timestamp: Date.now(),
      snapshot: { depth: 0, completedTaskIds: [], results: [], childSnapshots: [], updatedAt: Date.now() }
    };
    const store = { getValue: vi.fn().mockReturnValue(checkpoint) };

    const result = await resumeFromCheckpoint('chk_123', store as any);
    expect(result).toEqual(checkpoint);
  });

  it('returns null for invalid checkpoint structure', async () => {
    const store = { getValue: vi.fn().mockReturnValue({ id: 123, sessionId: 'sess_1' }) };
    const result = await resumeFromCheckpoint('chk_bad', store as any);
    expect(result).toBeNull();
  });
});
